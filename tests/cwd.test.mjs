import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { companion, FAKE_CODEX, ROOT, makeWorkspace, withTmp } from "./helpers.mjs";

test("rejects --cwd that escapes the workspace", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const outside = join(dir, "outside");
    await mkdir(outside);
    const result = await companion(
      [
        "exec",
        "--plugin-root",
        ROOT,
        "--workspace-root",
        ws,
        "--data-dir",
        join(dir, "state"),
        "--codex-bin",
        FAKE_CODEX,
        "--cursor-session",
        "chat-cwd",
        "--cwd",
        outside,
        "--",
        "do not escape",
      ],
      { cwd: ws },
    );
    assert.equal(result.code, 2);
    assert.equal(result.json.code, "CWD_OUTSIDE_WORKSPACE");
  });
});

test("allows a relative cwd inside the workspace", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const result = await companion(
      [
        "exec",
        "--plugin-root",
        ROOT,
        "--workspace-root",
        ws,
        "--data-dir",
        join(dir, "state"),
        "--codex-bin",
        FAKE_CODEX,
        "--cursor-session",
        "chat-cwd",
        "--cwd",
        "src",
        "--wait",
        "--",
        "stay inside",
      ],
      { cwd: ws },
    );
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.equal(result.json.status, "completed");
    assert.equal(result.json.cwd, join(ws, "src"));
  });
});
