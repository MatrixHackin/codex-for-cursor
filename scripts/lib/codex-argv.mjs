/**
 * Build `codex exec` / `codex review` argv.
 * Global exec flags go before `resume` for older Codex CLIs.
 */

/**
 * @param {object} opts
 * @returns {string[]}
 */
export function buildExecArgv(opts) {
  const args = [opts.bin, "exec", "-C", opts.cwd];
  args.push("--sandbox", opts.read ? "read-only" : "workspace-write");
  args.push("-a", "never");
  args.push("--color", "never");
  args.push("--skip-git-repo-check");
  args.push("--json");
  if (opts.lastMessagePath) args.push("--output-last-message", opts.lastMessagePath);
  if (opts.model) args.push("--model", opts.model);
  if (opts.effort) args.push("-c", `model_reasoning_effort=${opts.effort}`);
  if (opts.resumeSessionId) {
    args.push("resume", opts.resumeSessionId);
  }
  args.push("-");
  return args;
}

/**
 * Review targeting follows Codex CLI's exclusive targets:
 * --base, --uncommitted, --commit, or a custom prompt.
 *
 * @param {object} opts
 * @returns {{ argv: string[], prompt: string }}
 */
export function buildReviewArgv(opts) {
  const args = [opts.bin, "review", "-C", opts.cwd, "--color", "never"];
  const focus = (opts.prompt ?? "").trim();
  let prompt = "";

  if (opts.adversarial) {
    const baseLine = opts.base
      ? `Review the diff against base branch ${opts.base} adversarially.`
      : "Review the current working tree (staged, unstaged, and untracked) adversarially.";
    prompt = [
      baseLine,
      "Challenge the design. Look for security issues, incorrect assumptions, missing tests, and silent breakage.",
      focus ? `Focus: ${focus}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    args.push("-");
    return { argv: args, prompt };
  }

  if (opts.base && focus) {
    prompt = `Review the changes against base branch ${opts.base}.\nFocus: ${focus}`;
    args.push("-");
    return { argv: args, prompt };
  }
  if (opts.base) {
    args.push("--base", opts.base);
    return { argv: args, prompt: "" };
  }
  if (focus) {
    args.push("-");
    return { argv: args, prompt: focus };
  }
  args.push("--uncommitted");
  return { argv: args, prompt: "" };
}
