import { AppError } from "../lib/errors.mjs";
import { isJobId } from "../lib/args.mjs";
import { loadConversation, loadJob, reapJobIfDead, saveJob } from "../lib/jobs.mjs";
import { cancelJob, isTerminal, receipt, resultPayload, waitForJob } from "../lib/runner.mjs";
import { parseTimeoutMs } from "../lib/args.mjs";

/**
 * @param {object} ctx
 * @param {string[]} rest
 */
export function resolveTargetJob(ctx, rest) {
  const maybeId = rest[0];
  if (maybeId && isJobId(maybeId)) {
    return loadJob(ctx.dataDir, ctx.workspaceRoot, maybeId);
  }
  if (!ctx.cursorSessionId) {
    throw new AppError(
      "SESSION_CONTEXT_MISSING",
      "Pass a task-xxxxxxxx id, or run this from a MyCodex Agent chat so the last job is known.",
    );
  }
  const conv = loadConversation(ctx.dataDir, ctx.workspaceRoot, ctx.cursorSessionId);
  if (!conv?.lastJobId) {
    throw new AppError("JOB_NOT_FOUND", "This conversation has no MyCodex job yet");
  }
  return loadJob(ctx.dataDir, ctx.workspaceRoot, conv.lastJobId);
}

export async function runStatus(ctx, options, rest) {
  let job = resolveTargetJob(ctx, rest);
  job = reapJobIfDead(job);
  saveJob(ctx.dataDir, ctx.workspaceRoot, job);
  if (options.wait && !isTerminal(job.status)) {
    return waitForJob(
      ctx,
      job.id,
      parseTimeoutMs(typeof options.timeoutMs === "string" ? options.timeoutMs : undefined),
    );
  }
  if (isTerminal(job.status)) return resultPayload(job);
  return receipt(job);
}

export async function runResult(ctx, _options, rest) {
  let job = resolveTargetJob(ctx, rest);
  job = reapJobIfDead(job);
  saveJob(ctx.dataDir, ctx.workspaceRoot, job);
  return resultPayload(job);
}

export async function runCancel(ctx, _options, rest) {
  let job = resolveTargetJob(ctx, rest);
  job = cancelJob(ctx, job);
  return {
    ok: true,
    kind: "cancelled",
    id: job.id,
    status: job.status,
    message: job.status === "cancelled" ? "Job cancelled." : `Job already ${job.status}.`,
  };
}
