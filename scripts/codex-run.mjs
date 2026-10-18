#!/usr/bin/env node
import { runExec } from "./commands/exec.mjs";
import { runCancel, runResult, runStatus } from "./commands/jobs-cli.mjs";
import { runReview } from "./commands/review.mjs";
import { runSetup } from "./commands/setup.mjs";
import { parseLeadingOptions } from "./lib/args.mjs";
import { AppError, toPayload } from "./lib/errors.mjs";
import { printError, printJson, USAGE } from "./lib/format.mjs";
import { resolveDataDir, resolvePluginRoot } from "./lib/paths.mjs";
import { runWorker } from "./lib/runner.mjs";
import { resolveJobCwd, resolveWorkspaceRoot } from "./lib/workspace.mjs";

async function main(argv) {
  const [command, ...raw] = argv;
  if (!command || command === "--help" || command === "help") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const { options, rest } = parseLeadingOptions(raw);
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const pluginRoot = resolvePluginRoot({
    pluginRoot: typeof options.pluginRoot === "string" ? options.pluginRoot : undefined,
  });
  const dataDir = resolveDataDir({
    dataDir: typeof options.dataDir === "string" ? options.dataDir : undefined,
  });
  const workspaceRoot = resolveWorkspaceRoot({
    workspaceRoot:
      typeof options.workspaceRoot === "string" ? options.workspaceRoot : undefined,
  });
  const cwd = resolveJobCwd(
    workspaceRoot,
    typeof options.cwd === "string" ? options.cwd : undefined,
  );
  const cursorSessionId =
    (typeof options.cursorSession === "string" && options.cursorSession) ||
    process.env.MYCODEX_SESSION ||
    process.env.CURSOR_SESSION_ID ||
    null;

  const ctx = {
    pluginRoot,
    dataDir,
    workspaceRoot,
    cwd,
    cursorSessionId,
    codexBin: typeof options.codexBin === "string" ? options.codexBin : undefined,
  };

  if (command === "_worker") {
    const jobId = typeof options.jobId === "string" ? options.jobId : rest[0];
    if (!jobId) throw new AppError("BAD_ARGS", "Worker missing --job-id");
    await runWorker(ctx, jobId);
    return;
  }

  let payload;
  switch (command) {
    case "setup":
      payload = runSetup(ctx);
      break;
    case "exec":
    case "run":
      payload = await runExec(ctx, options, rest);
      break;
    case "review":
      payload = await runReview(ctx, options, rest);
      break;
    case "status":
      payload = await runStatus(ctx, options, rest);
      break;
    case "result":
      payload = await runResult(ctx, options, rest);
      break;
    case "cancel":
      payload = await runCancel(ctx, options, rest);
      break;
    default:
      throw new AppError("BAD_ARGS", `Unknown subcommand: ${command}`);
  }
  printJson(payload);
  if (payload && payload.ok === false) process.exitCode = 2;
}

main(process.argv.slice(2)).catch((err) => {
  printError(toPayload(err));
  process.exit(err instanceof AppError ? 2 : 1);
});
