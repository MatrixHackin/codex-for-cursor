import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { AppError } from "./errors.mjs";
import { contextsDir, workspaceStoreDir } from "./paths.mjs";

export const JOB_ID_RE = /^task-[0-9a-f]{8}$/;

export function newJobId() {
  return `task-${randomBytes(4).toString("hex")}`;
}

/** @param {string} dataDir @param {string} workspaceRoot */
export function storePaths(dataDir, workspaceRoot) {
  const root = workspaceStoreDir(dataDir, workspaceRoot);
  return {
    root,
    jobsDir: join(root, "jobs"),
    conversationsDir: join(root, "conversations"),
    lockPath: join(root, "write.lock"),
  };
}

/** @param {string} dir */
export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** @param {string} path @param {unknown} value */
export function writeJsonAtomic(path, value) {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/** @param {string} path */
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** @param {string} path */
export function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

/** @param {number} pid */
export function pidAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} dataDir @param {string} workspaceRoot @param {string} id */
export function jobDir(dataDir, workspaceRoot, id) {
  return join(storePaths(dataDir, workspaceRoot).jobsDir, id);
}

/** @param {string} dataDir @param {string} workspaceRoot @param {string} id */
export function jobJsonPath(dataDir, workspaceRoot, id) {
  return join(jobDir(dataDir, workspaceRoot, id), "job.json");
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 * @param {object} job
 */
export function saveJob(dataDir, workspaceRoot, job) {
  const dir = jobDir(dataDir, workspaceRoot, job.id);
  ensureDir(dir);
  writeJsonAtomic(join(dir, "job.json"), job);
  return job;
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 * @param {string} id
 */
export function loadJob(dataDir, workspaceRoot, id) {
  const job = readJsonIfExists(jobJsonPath(dataDir, workspaceRoot, id));
  if (!job) {
    throw new AppError("JOB_NOT_FOUND", `No job ${id} in this workspace`, { id });
  }
  return job;
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 */
export function listJobs(dataDir, workspaceRoot) {
  const { jobsDir } = storePaths(dataDir, workspaceRoot);
  if (!existsSync(jobsDir)) return [];
  return readdirSync(jobsDir)
    .filter((name) => JOB_ID_RE.test(name))
    .map((id) => readJsonIfExists(jobJsonPath(dataDir, workspaceRoot, id)))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * @param {object} job
 */
export function reapJobIfDead(job) {
  if (job.status !== "running" && job.status !== "queued") return job;
  if (!job.pid) {
    const created = Date.parse(job.startedAt || job.createdAt || "");
    if (!Number.isFinite(created) || Date.now() - created < 15_000) return job;
  } else if (pidAlive(job.pid)) {
    return job;
  }
  job.status = "failed";
  job.errorCode = "RECOVERY_REQUIRED";
  job.errorMessage =
    "Worker process is gone. Inspect the working tree before starting another write; do not replay the same mutation blindly.";
  job.endedAt = new Date().toISOString();
  job.updatedAt = job.endedAt;
  return job;
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 */
export function findRunningWriteJob(dataDir, workspaceRoot) {
  for (const job of listJobs(dataDir, workspaceRoot)) {
    const current = reapJobIfDead(job);
    if (current !== job || current.errorCode === "RECOVERY_REQUIRED") {
      saveJob(dataDir, workspaceRoot, current);
    }
    if (current.lane === "write" && (current.status === "running" || current.status === "queued")) {
      if (current.pid && pidAlive(current.pid)) return current;
      if (current.status === "queued") return current;
    }
  }
  return null;
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 * @param {object} job
 */
export function acquireWriteLock(dataDir, workspaceRoot, job) {
  const { lockPath } = storePaths(dataDir, workspaceRoot);
  ensureDir(dirname(lockPath));
  const busy = findRunningWriteJob(dataDir, workspaceRoot);
  if (busy && busy.id !== job.id) {
    throw new AppError("WRITE_BUSY", "A write job is already running in this workspace", {
      existingJob: { id: busy.id, status: busy.status, pid: busy.pid },
    });
  }
  const payload = `${JSON.stringify({
    jobId: job.id,
    pid: job.pid ?? null,
    pgid: job.pgid ?? null,
    acquiredAt: new Date().toISOString(),
  }, null, 2)}\n`;

  try {
    const fd = openSync(lockPath, "wx");
    try {
      writeFileSync(fd, payload);
    } finally {
      closeSync(fd);
    }
    return;
  } catch (err) {
    if (err && err.code !== "EEXIST") throw err;
  }

  const existing = readJsonIfExists(lockPath);
  if (existing?.jobId === job.id) {
    writeJsonAtomic(lockPath, JSON.parse(payload));
    return;
  }
  if (existing?.pid && pidAlive(existing.pid)) {
    throw new AppError("WRITE_BUSY", "A write job is already running in this workspace", {
      existingJob: { id: existing.jobId, pid: existing.pid },
    });
  }
  try {
    rmSync(lockPath);
  } catch {
    // ignore
  }
  const fd = openSync(lockPath, "wx");
  try {
    writeFileSync(fd, payload);
  } finally {
    closeSync(fd);
  }
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 * @param {string} [jobId]
 */
export function releaseWriteLock(dataDir, workspaceRoot, jobId) {
  const { lockPath } = storePaths(dataDir, workspaceRoot);
  const existing = readJsonIfExists(lockPath);
  if (!existing) return;
  if (jobId && existing.jobId && existing.jobId !== jobId) return;
  try {
    rmSync(lockPath);
  } catch {
    // ignore
  }
}

/** @param {string} dataDir @param {string} cursorSessionId */
export function contextPath(dataDir, cursorSessionId) {
  return join(contextsDir(dataDir), `${cursorSessionId}.json`);
}

/** @param {string} dataDir @param {object} context */
export function saveContext(dataDir, context) {
  ensureDir(contextsDir(dataDir));
  writeJsonAtomic(contextPath(dataDir, context.cursorSessionId), context);
}

/** @param {string} dataDir @param {string} cursorSessionId */
export function loadContext(dataDir, cursorSessionId) {
  return readJsonIfExists(contextPath(dataDir, cursorSessionId));
}

/** @param {string} dataDir @param {string} cursorSessionId */
export function deleteContext(dataDir, cursorSessionId) {
  try {
    rmSync(contextPath(dataDir, cursorSessionId));
  } catch {
    // ignore
  }
}

/** @param {string} dataDir @param {string} workspaceRoot @param {string} cursorSessionId */
export function conversationPath(dataDir, workspaceRoot, cursorSessionId) {
  return join(storePaths(dataDir, workspaceRoot).conversationsDir, `${cursorSessionId}.json`);
}

/** @param {string} dataDir @param {string} workspaceRoot @param {string} cursorSessionId */
export function loadConversation(dataDir, workspaceRoot, cursorSessionId) {
  return readJsonIfExists(conversationPath(dataDir, workspaceRoot, cursorSessionId));
}

/**
 * @param {string} dataDir
 * @param {string} workspaceRoot
 * @param {object} conversation
 */
export function saveConversation(dataDir, workspaceRoot, conversation) {
  ensureDir(storePaths(dataDir, workspaceRoot).conversationsDir);
  writeJsonAtomic(
    conversationPath(dataDir, workspaceRoot, conversation.cursorSessionId),
    conversation,
  );
}

/**
 * @param {number | null | undefined} pgid
 * @param {NodeJS.Signals | number} signal
 */
export function killProcessGroup(pgid, signal = "SIGTERM") {
  if (!pgid) return false;
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    try {
      process.kill(pgid, signal);
      return true;
    } catch {
      return false;
    }
  }
}
