import assert from "node:assert/strict";
import { test } from "node:test";
import { companion, FAKE_CODEX, ROOT, withTmp } from "./helpers.mjs";

test("setup is not ready when Codex is missing", async () => {
  await withTmp(async (dir) => {
    const result = await companion(
      ["setup", "--plugin-root", ROOT, "--data-dir", dir, "--workspace-root", dir, "--codex-bin", "/no/such/codex"],
      { cwd: dir, env: { PATH: "/usr/bin", MYCODEX_SKIP_AUTH: "1" } },
    );
    assert.equal(result.json?.ready, false);
    assert.equal(result.json?.ok, true);
  });
});

test("setup is ready with the fake Codex binary", async () => {
  await withTmp(async (dir) => {
    const result = await companion(
      [
        "setup",
        "--plugin-root",
        ROOT,
        "--data-dir",
        dir,
        "--workspace-root",
        dir,
        "--codex-bin",
        FAKE_CODEX,
      ],
      { cwd: dir, env: { MYCODEX_SKIP_AUTH: "1" } },
    );
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.json.ready, true);
    assert.match(result.json.codex.version, /mycodex-fake/);
  });
});
