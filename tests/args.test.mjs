import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLeadingOptions } from "../scripts/lib/args.mjs";
import { AppError } from "../scripts/lib/errors.mjs";

test("parses leading flags and leaves the prompt", () => {
  const { options, rest } = parseLeadingOptions([
    "--read",
    "--cwd",
    "src",
    "--model=gpt-test",
    "fix",
    "the",
    "bug",
  ]);
  assert.equal(options.read, true);
  assert.equal(options.cwd, "src");
  assert.equal(options.model, "gpt-test");
  assert.deepEqual(rest, ["fix", "the", "bug"]);
});

test("stops at -- so a prompt may start with dashes", () => {
  const { options, rest } = parseLeadingOptions(["--wait", "--", "--not-a-flag", "please"]);
  assert.equal(options.wait, true);
  assert.deepEqual(rest, ["--not-a-flag", "please"]);
});

test("rejects unknown flags before the prompt", () => {
  assert.throws(() => parseLeadingOptions(["--yolo", "task"]), (err) => {
    return err instanceof AppError && err.code === "BAD_ARGS";
  });
});
