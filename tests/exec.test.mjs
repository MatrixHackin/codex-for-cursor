import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { companion, FAKE_CODEX, ROOT, makeWorkspace, withTmp } from "./helpers.mjs";

function base(ws, dataDir) {
  return [
    "--plugin-root",
    ROOT,
    "--workspace-root",
    ws,
    "--data-dir",
    dataDir,
    "--codex-bin",
    FAKE_CODEX,
    "--cursor-session",
    "chat-1",
  ];
}

test("exec feeds the prompt on stdin and records a session id", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const dataDir = join(dir, "state");
    const record = join(dir, "record");
    const result = await companion(
      ["exec", ...base(ws, dataDir), "--wait", "--", "add retries to login"],
      { cwd: ws, env: { FAKE_CODEX_RECORD: record } },
    );
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.equal(result.json.status, "completed");
    assert.match(result.json.output, /add retries to login/);
    assert.equal(result.json.codexSessionId, "sess-fake-001");

    const files = await readdir(record);
    assert.ok(files.length >= 1);
    const { readFile } = await import("node:fs/promises");
    const logged = JSON.parse(await readFile(join(record, files[0]), "utf8"));
    assert.equal(logged.argv.at(-1), "-");
    assert.ok(!logged.argv.includes("--last"));
    assert.ok(logged.argv.includes("workspace-write"));
  });
});

test("resume passes the stored session id and never --last", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const dataDir = join(dir, "state");
    const first = await companion(
      ["exec", ...base(ws, dataDir), "--wait", "--", "first turn"],
      { cwd: ws },
    );
    assert.equal(first.json.status, "completed");
    const record = join(dir, "record");
    const second = await companion(
      ["exec", ...base(ws, dataDir), "--wait", "--resume", "--", "second turn"],
      { cwd: ws, env: { FAKE_CODEX_RECORD: record } },
    );
    assert.equal(second.code, 0, second.stderr + second.stdout);
    assert.match(second.json.output, /second turn/);
    const files = await readdir(record);
    const { readFile } = await import("node:fs/promises");
    const logged = JSON.parse(await readFile(join(record, files[0]), "utf8"));
    assert.ok(logged.argv.includes("resume"));
    assert.ok(logged.argv.includes("sess-fake-001"));
    assert.ok(!logged.argv.includes("--last"));
  });
});

test("resume without a prior session is THREAD_NOT_FOUND", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const result = await companion(
      ["exec", ...base(ws, join(dir, "state")), "--resume", "--", "nope"],
      { cwd: ws },
    );
    assert.equal(result.code, 2);
    assert.equal(result.json.code, "THREAD_NOT_FOUND");
  });
});
