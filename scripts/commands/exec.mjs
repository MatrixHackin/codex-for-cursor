import { AppError } from "../lib/errors.mjs";
import { isInside } from "../lib/workspace.mjs";
import { buildExecArgv } from "../lib/codex-argv.mjs";
import { loadConversation } from "../lib/jobs.mjs";
import { requireCodex } from "../lib/codex-bin.mjs";
import { createJobRecord, startJob } from "../lib/runner.mjs";
import { parseTimeoutMs } from "../lib/args.mjs";

/**
 * @param {object} ctx
 * @param {Record<string, string | boolean>} options
 * @param {string[]} rest
 */
export async function runExec(ctx, options, rest) {
  assertPosix();
  const prompt = rest.join(" ").trim();
  if (!prompt) {
    throw new AppError("EMPTY_PROMPT", "Pass a task after /mycodex:run");
  }
  if (options.resume && options.fresh) {
    throw new AppError("BAD_ARGS", "Use only one of --resume or --fresh");
  }

  const { bin } = requireCodex({ codexBin: ctx.codexBin, env: process.env });
  let resumeSessionId = null;
  let cwd = ctx.cwd;

  if (options.resume) {
    if (!ctx.cursorSessionId) {
      throw new AppError(
        "SESSION_CONTEXT_MISSING",
        "No Cursor conversation id. Open a new Agent chat and retry --resume.",
      );
    }
    const conv = loadConversation(ctx.dataDir, ctx.workspaceRoot, ctx.cursorSessionId);
    if (!conv?.lastCodexSessionId) {
      throw new AppError(
        "THREAD_NOT_FOUND",
        "This conversation has no Codex session to resume. Drop --resume or use --fresh.",
      );
    }
    if (conv.workspaceRoot && !isInside(conv.workspaceRoot, cwd) && cwd !== conv.workspaceRoot) {
      throw new AppError(
        "CWD_MISMATCH",
        "Cannot resume a Codex session in a different workspace tree.",
        { boundWorkspace: conv.workspaceRoot, cwd },
      );
    }
    resumeSessionId = conv.lastCodexSessionId;
    if (!options.cwd) cwd = conv.workspaceRoot || cwd;
  }

  const job = createJobRecord({
    dataDir: ctx.dataDir,
    workspaceRoot: ctx.workspaceRoot,
    lane: options.read ? "read" : "write",
    kind: "exec",
    cwd,
    cursorSessionId: ctx.cursorSessionId,
    codexSessionId: resumeSessionId,
    argv: [],
    prompt,
  });
  job.argv = buildExecArgv({
    bin,
    cwd,
    read: Boolean(options.read),
    model: typeof options.model === "string" ? options.model : undefined,
    effort: typeof options.effort === "string" ? options.effort : undefined,
    resumeSessionId,
    lastMessagePath: job.lastMessagePath,
  });
  if (job.argv.includes("--last")) {
    throw new AppError("INTERNAL", "Refusing to invoke resume --last");
  }

  return startJob(ctx, job, {
    wait: Boolean(options.wait),
    timeoutMs: parseTimeoutMs(
      typeof options.timeoutMs === "string" ? options.timeoutMs : undefined,
    ),
  });
}

export function assertPosix() {
  if (process.platform === "win32") {
    throw new AppError(
      "WINDOWS_UNSUPPORTED",
      "MyCodex v1 does not support Windows. Use macOS or Linux.",
    );
  }
}
