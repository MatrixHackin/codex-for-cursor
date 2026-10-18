import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { companion, ROOT, runNode, SESSION_END, SESSION_START, withTmp } from "./helpers.mjs";

test("command files include $ARGUMENTS and never eval", async () => {
  const dir = join(ROOT, "commands");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  assert.deepEqual(
    files.sort(),
    ["cancel.md", "result.md", "review.md", "run.md", "setup.md", "status.md"],
  );
  for (const name of files) {
    const text = await readFile(join(dir, name), "utf8");
    assert.match(text, /^---\nname:/);
    assert.match(text, /\$ARGUMENTS/);
    assert.doesNotMatch(text, /\beval\b/);
    assert.match(text, /scripts\/codex-run\.mjs/);
    assert.doesNotMatch(text, /~\/\.cursor\/commands\/codex\.md/);
    assert.doesNotMatch(text, /powershell/i);
  }
});

test("check-commands script passes", async () => {
  const result = await runNode(join(ROOT, "scripts", "check-commands.mjs"), []);
  assert.equal(result.code, 0, result.stderr);
});

test("sessionStart injects pluginRoot and session id", async () => {
  await withTmp(async (dir) => {
    const result = await runNode(SESSION_START, [], {
      env: {
        CURSOR_PLUGIN_ROOT: ROOT,
        MYCODEX_DATA_DIR: dir,
      },
      stdin: JSON.stringify({ session_id: "hook-session" }),
    });
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.match(payload.additional_context, /pluginRoot:/);
    assert.match(payload.additional_context, /cursorSessionId: hook-session/);
    assert.match(payload.additional_context, /codex-run\.mjs/);
  });
});

test("sessionEnd does not throw", async () => {
  await withTmp(async (dir) => {
    const result = await runNode(SESSION_END, [], {
      env: { MYCODEX_DATA_DIR: dir, CURSOR_PLUGIN_ROOT: ROOT },
      stdin: JSON.stringify({ session_id: "hook-session" }),
    });
    assert.equal(result.code, 0, result.stderr);
  });
});

test("companion help lists path-A subcommands", async () => {
  const result = await companion(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /setup\|exec\|review\|status\|result\|cancel/);
});
