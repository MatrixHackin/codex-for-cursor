import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
    "chat-review",
  ];
}

test("review defaults to --uncommitted and waits", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const dataDir = join(dir, "state");
    const record = join(dir, "record");
    const result = await companion(["review", ...base(ws, dataDir)], {
      cwd: ws,
      env: { FAKE_CODEX_RECORD: record },
    });
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.equal(result.json.status, "completed");
    assert.equal(result.json.lane, "read");
    const files = await readdir(record);
    const logged = JSON.parse(await readFile(join(record, files[0]), "utf8"));
    assert.ok(logged.argv.includes("--uncommitted"));
  });
});

test("review --base uses the base-branch target", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const record = join(dir, "record");
    const result = await companion(
      ["review", ...base(ws, join(dir, "state")), "--base", "main"],
      { cwd: ws, env: { FAKE_CODEX_RECORD: record } },
    );
    assert.equal(result.code, 0, result.stdout);
    const files = await readdir(record);
    const logged = JSON.parse(await readFile(join(record, files[0]), "utf8"));
    assert.ok(logged.argv.includes("--base"));
    assert.ok(logged.argv.includes("main"));
    assert.ok(!logged.argv.includes("--uncommitted"));
  });
});
