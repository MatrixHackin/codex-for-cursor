import { requireCodex } from "../lib/codex-bin.mjs";
import { parseTimeoutMs } from "../lib/args.mjs";
import { buildReviewArgv } from "../lib/codex-argv.mjs";
import { createJobRecord, startJob } from "../lib/runner.mjs";
import { assertPosix } from "./exec.mjs";

/**
 * Review is read-only and does not take the write lock.
 * It waits by default so findings come back in the same turn.
 *
 * @param {object} ctx
 * @param {Record<string, string | boolean>} options
 * @param {string[]} rest
 */
export async function runReview(ctx, options, rest) {
  assertPosix();
  const { bin } = requireCodex({ codexBin: ctx.codexBin, env: process.env });
  const { argv, prompt } = buildReviewArgv({
    bin,
    cwd: ctx.cwd,
    base: typeof options.base === "string" ? options.base : undefined,
    adversarial: Boolean(options.adversarial),
    prompt: rest.join(" ").trim(),
  });

  const job = createJobRecord({
    dataDir: ctx.dataDir,
    workspaceRoot: ctx.workspaceRoot,
    lane: "read",
    kind: "review",
    cwd: ctx.cwd,
    cursorSessionId: ctx.cursorSessionId,
    argv,
    prompt,
  });

  const wait = options.background ? false : options.wait !== false;
  return startJob(ctx, job, {
    wait,
    timeoutMs: parseTimeoutMs(
      typeof options.timeoutMs === "string" ? options.timeoutMs : undefined,
    ),
  });
}
