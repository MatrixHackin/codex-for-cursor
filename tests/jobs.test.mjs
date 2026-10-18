import assert from "node:assert/strict";
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
    "chat-jobs",
  ];
}

test("status/result/cancel follow the job state machine", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const dataDir = join(dir, "state");
    const started = await companion(["exec", ...base(ws, dataDir), "--", "background work"], {
      cwd: ws,
      env: { FAKE_CODEX_SLEEP: "800" },
    });
    assert.equal(started.json.kind, "receipt");

    const earlyResult = await companion(["result", ...base(ws, dataDir), started.json.id], {
      cwd: ws,
    });
    assert.equal(earlyResult.json.code, "JOB_NOT_DONE");

    const waited = await companion(
      ["status", ...base(ws, dataDir), "--wait", "--timeout-ms", "5000", started.json.id],
      { cwd: ws },
    );
    assert.equal(waited.json.status, "completed", waited.stdout);
    assert.match(waited.json.output, /background work/);

    const done = await companion(["result", ...base(ws, dataDir)], { cwd: ws });
    assert.equal(done.json.status, "completed");

    const cancelDone = await companion(["cancel", ...base(ws, dataDir), started.json.id], {
      cwd: ws,
    });
    assert.equal(cancelDone.json.status, "completed");
  });
});
