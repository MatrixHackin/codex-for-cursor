import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.mjs";
import {
  acquireWriteLock,
  ensureDir,
  findRunningWriteJob,
  jobDir,
  killProcessGroup,
  loadConversation,
  loadJob,
  newJobId,
  pidAlive,
  reapJobIfDead,
  releaseWriteLock,
  saveConversation,
  saveJob,
} from "./jobs.mjs";

const COMPANION = fileURLToPath(new URL("../codex-run.mjs", import.meta.url));

/**
 * @param {object} input
 */
export function createJobRecord(input) {
  const id = newJobId();
  const dir = jobDir(input.dataDir, input.workspaceRoot, id);
  const now = new Date().toISOString();
  return {
    id,
    status: "queued",
    lane: input.lane,
    kind: input.kind,
    pid: null,
    pgid: null,
    cwd: input.cwd,
    workspaceRoot: input.workspaceRoot,
    cursorSessionId: input.cursorSessionId ?? null,
    codexSessionId: input.codexSessionId ?? null,
    argv: input.argv,
    prompt: input.prompt ?? "",
    promptPreview: String(input.prompt ?? "").slice(0, 200),
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    errorCode: null,
    errorMessage: null,
    stdoutPath: join(dir, "stdout.log"),
    stderrPath: join(dir, "stderr.log"),
    lastMessagePath: join(dir, "last-message.txt"),
    jsonlPath: join(dir, "events.jsonl"),
    promptPath: join(dir, "prompt.txt"),
    workerLogPath: join(dir, "worker.log"),
  };
}

/**
 * @param {object} ctx
 * @param {object} job
 * @param {{ wait?: boolean, timeoutMs?: number | null }} [opts]
 */
export async function startJob(ctx, job, opts = {}) {
  const dir = jobDir(ctx.dataDir, ctx.workspaceRoot, job.id);
  ensureDir(dir);
  writeFileSync(job.promptPath, job.prompt ?? "", "utf8");
  delete job.prompt;
  saveJob(ctx.dataDir, ctx.workspaceRoot, job);

  if (job.lane === "write") {
    const busy = findRunningWriteJob(ctx.dataDir, ctx.workspaceRoot);
    if (busy && busy.id !== job.id) {
      job.status = "failed";
      job.errorCode = "WRITE_BUSY";
      job.endedAt = new Date().toISOString();
      saveJob(ctx.dataDir, ctx.workspaceRoot, job);
      throw new AppError("WRITE_BUSY", "A write job is already running in this workspace", {
        existingJob: { id: busy.id, status: busy.status, pid: busy.pid },
      });
    }
    acquireWriteLock(ctx.dataDir, ctx.workspaceRoot, job);
  }

  const child = spawn(
    process.execPath,
    [
      COMPANION,
      "_worker",
      "--job-id",
      job.id,
      "--data-dir",
      ctx.dataDir,
      "--workspace-root",
      ctx.workspaceRoot,
      "--plugin-root",
      ctx.pluginRoot,
    ],
    {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        MYCODEX_DATA_DIR: ctx.dataDir,
        MYCODEX_PLUGIN_ROOT: ctx.pluginRoot,
      },
    },
  );
  child.unref();

  job.pid = child.pid ?? null;
  job.pgid = child.pid ?? null;
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.updatedAt = job.startedAt;
  saveJob(ctx.dataDir, ctx.workspaceRoot, job);

  if (job.lane === "write") {
    acquireWriteLock(ctx.dataDir, ctx.workspaceRoot, job);
  }
  bindConversation(ctx, job);

  if (opts.wait) {
    return waitForJob(ctx, job.id, opts.timeoutMs ?? null);
  }
  return receipt(loadJob(ctx.dataDir, ctx.workspaceRoot, job.id));
}

/**
 * @param {object} ctx
 * @param {string} id
 * @param {number | null} timeoutMs
 */
export async function waitForJob(ctx, id, timeoutMs) {
  const start = Date.now();
  while (true) {
    let job = loadJob(ctx.dataDir, ctx.workspaceRoot, id);
    job = reapJobIfDead(job);
    if (job.errorCode === "RECOVERY_REQUIRED") {
      saveJob(ctx.dataDir, ctx.workspaceRoot, job);
      if (job.lane === "write") releaseWriteLock(ctx.dataDir, ctx.workspaceRoot, job.id);
    }
    if (isTerminal(job.status)) {
      return resultPayload(job);
    }
    if (timeoutMs !== null && Date.now() - start >= timeoutMs) {
      return {
        ...receipt(job),
        timedOut: true,
        message: "Timed out waiting for the job. It is still running.",
      };
    }
    await sleep(50);
  }
}

/** @param {string} status */
export function isTerminal(status) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

/** @param {object} job */
export function receipt(job) {
  return {
    ok: true,
    kind: "receipt",
    id: job.id,
    status: job.status,
    lane: job.lane,
    kindJob: job.kind,
    pid: job.pid,
    cwd: job.cwd,
    cursorSessionId: job.cursorSessionId,
    codexSessionId: job.codexSessionId,
    message:
      "Job started. This is a receipt, not a completed result. Use /mycodex:status or /mycodex:result.",
  };
}

/** @param {object} job */
export function resultPayload(job) {
  const output = readOptional(job.lastMessagePath) || readOptional(job.stdoutPath) || "";
  if (!isTerminal(job.status)) {
    return {
      ok: false,
      code: "JOB_NOT_DONE",
      id: job.id,
      status: job.status,
      lane: job.lane,
      pid: job.pid,
      message: "Job is still running. Do not invent output. Wait or use /mycodex:status --wait.",
    };
  }
  return {
    ok: job.status === "completed",
    kind: "result",
    id: job.id,
    status: job.status,
    lane: job.lane,
    kindJob: job.kind,
    cwd: job.cwd,
    exitCode: job.exitCode,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    cursorSessionId: job.cursorSessionId,
    codexSessionId: job.codexSessionId,
    output,
  };
}

/** @param {object} ctx @param {object} job */
function bindConversation(ctx, job) {
  if (!job.cursorSessionId) return;
  const previous = loadConversation(ctx.dataDir, ctx.workspaceRoot, job.cursorSessionId) ?? {};
  saveConversation(ctx.dataDir, ctx.workspaceRoot, {
    cursorSessionId: job.cursorSessionId,
    lastJobId: job.id,
    lastCodexSessionId: job.codexSessionId ?? previous.lastCodexSessionId ?? null,
    workspaceRoot: ctx.workspaceRoot,
    updatedAt: new Date().toISOString(),
  });
}

/** @param {object} ctx @param {object} job */
export function bindCodexSession(ctx, job) {
  if (!job.cursorSessionId || !job.codexSessionId) return;
  saveConversation(ctx.dataDir, ctx.workspaceRoot, {
    cursorSessionId: job.cursorSessionId,
    lastJobId: job.id,
    lastCodexSessionId: job.codexSessionId,
    workspaceRoot: ctx.workspaceRoot,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Worker entry: run the recorded Codex argv with the prompt on stdin.
 * @param {object} ctx
 * @param {string} jobId
 */
export async function runWorker(ctx, jobId) {
  const job = loadJob(ctx.dataDir, ctx.workspaceRoot, jobId);
  job.status = "running";
  job.pid = process.pid;
  job.pgid = process.pid;
  job.startedAt = job.startedAt ?? new Date().toISOString();
  job.updatedAt = new Date().toISOString();
  saveJob(ctx.dataDir, ctx.workspaceRoot, job);
  if (job.lane === "write") acquireWriteLock(ctx.dataDir, ctx.workspaceRoot, job);

  const stdout = createWriteStream(job.stdoutPath, { flags: "a" });
  const stderr = createWriteStream(job.stderrPath, { flags: "a" });
  const jsonl = createWriteStream(job.jsonlPath, { flags: "a" });

  await new Promise((resolve, reject) => {
    const launched = launchArgv(job.argv);
    const child = spawn(launched.cmd, launched.args, {
      cwd: job.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    job.pid = child.pid ?? job.pid;
    job.pgid = child.pid ?? job.pgid;
    saveJob(ctx.dataDir, ctx.workspaceRoot, job);
    if (job.lane === "write") acquireWriteLock(ctx.dataDir, ctx.workspaceRoot, job);

    if (job.promptPath) {
      createReadStream(job.promptPath).pipe(child.stdin);
    } else {
      child.stdin.end();
    }

    let lineBuf = "";
    child.stdout.on("data", (chunk) => {
      stdout.write(chunk);
      jsonl.write(chunk);
      lineBuf += chunk.toString("utf8");
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) consumeJsonlLine(ctx, job, line);
    });
    child.stderr.on("data", (chunk) => stderr.write(chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (lineBuf) consumeJsonlLine(ctx, job, lineBuf);
      job.exitCode = code;
      job.endedAt = new Date().toISOString();
      job.updatedAt = job.endedAt;
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        job.status = "cancelled";
      } else if (code === 0) {
        job.status = "completed";
      } else {
        job.status = "failed";
        job.errorCode = job.errorCode ?? "CODEX_EXIT";
        job.errorMessage = job.errorMessage ?? `codex exited ${code}`;
      }
      saveJob(ctx.dataDir, ctx.workspaceRoot, job);
      bindCodexSession(ctx, job);
      if (job.lane === "write") releaseWriteLock(ctx.dataDir, ctx.workspaceRoot, job.id);
      resolve();
    });
  });

  stdout.end();
  stderr.end();
  jsonl.end();
}

/** @param {object} ctx @param {object} job @param {string} line */
function consumeJsonlLine(ctx, job, line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return;
  try {
    const event = JSON.parse(trimmed);
    const threadId = event.thread_id || event.session_id || event?.thread?.id;
    if ((event.type === "thread.started" || event.type === "session_created") && threadId) {
      job.codexSessionId = threadId;
      job.updatedAt = new Date().toISOString();
      saveJob(ctx.dataDir, ctx.workspaceRoot, job);
      bindCodexSession(ctx, job);
    }
  } catch {
    // not JSON
  }
}

/**
 * @param {object} ctx
 * @param {object} job
 */
export function cancelJob(ctx, job) {
  const current = reapJobIfDead(job);
  if (isTerminal(current.status)) {
    saveJob(ctx.dataDir, ctx.workspaceRoot, current);
    return current;
  }
  if (current.pgid) killProcessGroup(current.pgid, "SIGTERM");
  if (current.pid && current.pid !== current.pgid && pidAlive(current.pid)) {
    try {
      process.kill(current.pid, "SIGTERM");
    } catch {
      // ignore
    }
  }
  current.status = "cancelled";
  current.endedAt = new Date().toISOString();
  current.updatedAt = current.endedAt;
  saveJob(ctx.dataDir, ctx.workspaceRoot, current);
  if (current.lane === "write") releaseWriteLock(ctx.dataDir, ctx.workspaceRoot, current.id);
  return current;
}

function readOptional(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {string[]} argv */
function launchArgv(argv) {
  const [bin, ...args] = argv;
  if (bin.endsWith(".mjs") || bin.endsWith(".js")) {
    return { cmd: process.execPath, args: [bin, ...args] };
  }
  return { cmd: bin, args };
}

