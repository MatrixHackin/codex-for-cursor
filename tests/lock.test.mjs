import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { companion, FAKE_CODEX, ROOT, makeWorkspace, withTmp } from "./helpers.mjs";

function base(ws, dataDir, session = "chat-lock") {
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
    session,
  ];
}

test("a second write job is WRITE_BUSY while the first still runs", async () => {
  await withTmp(async (dir) => {
    const ws = await makeWorkspace(dir);
    const dataDir = join(dir, "state");
    const first = await companion(["exec", ...base(ws, dataDir), "--", "slow write"], {
      cwd: ws,
      env: { FAKE_CODEX_SLEEP: "2500" },
    });
    assert.equal(first.json.kind, "receipt", first.stdout);
    const second = await companion(
      ["exec", ...base(ws, dataDir, "chat-lock-2"), "--", "another write"],
      { cwd: ws },
    );
    assert.equal(second.code, 2, second.stdout);
    assert.equal(second.json.code, "WRITE_BUSY");
    assert.equal(second.json.existingJob.id, first.json.id);

    const review = await companion(
      ["review", ...base(ws, dataDir, "chat-review"), "--background", "--", "look around"],
      { cwd: ws },
    );
    assert.notEqual(review.json.code, "WRITE_BUSY", review.stdout);
    assert.ok(review.json.id);

    const cancelled = await companion(["cancel", ...base(ws, dataDir), first.json.id], {
      cwd: ws,
    });
    assert.equal(cancelled.json.id, first.json.id);
  });
});
