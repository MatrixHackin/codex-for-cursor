import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const COMPANION = join(ROOT, "scripts", "codex-run.mjs");
export const FAKE_CODEX = join(ROOT, "tests", "fixtures", "fake-codex.mjs");
export const SESSION_START = join(ROOT, "scripts", "hooks", "session-start.mjs");
export const SESSION_END = join(ROOT, "scripts", "hooks", "session-end.mjs");

export async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), "mycodex-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function makeWorkspace(dir) {
  const ws = join(dir, "ws");
  await mkdir(ws, { recursive: true });
  await mkdir(join(ws, "src"), { recursive: true });
  await writeFile(join(ws, "src", "app.txt"), "ok\n");
  return ws;
}

export function parseJson(stdout) {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`Not JSON:\n${stdout}`);
  }
}

export function runNode(script, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    if (opts.stdin != null) child.stdin.end(opts.stdin);
    else child.stdin.end();
    child.on("close", (code) => {
      resolve({ code, stdout, stderr, json: tryParse(stdout) });
    });
  });
}

function tryParse(stdout) {
  try {
    return parseJson(stdout);
  } catch {
    return null;
  }
}

export function companion(args, opts) {
  return runNode(COMPANION, args, opts);
}
