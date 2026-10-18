import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  findCodexBin,
  hasCodexAuth,
  looksLikeFakeCodex,
  readCodexVersion,
  requireCodex,
} from "../lib/codex-bin.mjs";
import { AppError } from "../lib/errors.mjs";
import { defaultInstallDir } from "../lib/paths.mjs";

/**
 * @param {object} ctx
 */
export function runSetup(ctx) {
  if (process.platform === "win32") {
    return {
      ok: false,
      ready: false,
      code: "WINDOWS_UNSUPPORTED",
      message: "MyCodex v1 does not support Windows. Use macOS or Linux.",
      platform: process.platform,
    };
  }

  const notes = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) {
    notes.push(`Node ${process.versions.node} is too old; need 20+`);
  }

  const pluginOk = existsSync(join(ctx.pluginRoot, ".cursor-plugin", "plugin.json"));
  if (!pluginOk) {
    notes.push("plugin.json missing; re-run ./install.sh and Reload Window");
  }

  const bin = findCodexBin({ codexBin: ctx.codexBin, env: process.env });
  let codex = {
    path: bin,
    version: null,
    auth: false,
    ok: false,
  };

  try {
    if (!bin) throw new AppError("NOT_READY", "Codex CLI not found on PATH");
    const resolved = requireCodex({ codexBin: bin, env: process.env });
    codex = {
      path: resolved.bin,
      version: resolved.version,
      auth: looksLikeFakeCodex(bin) ? true : hasCodexAuth(process.env),
      ok: true,
    };
  } catch (err) {
    if (bin) {
      try {
        codex.version = readCodexVersion(bin, process.env);
      } catch {
        // keep null
      }
    }
    codex.auth = hasCodexAuth(process.env);
    notes.push(err instanceof Error ? err.message : String(err));
  }

  const ready =
    nodeMajor >= 20 &&
    pluginOk &&
    Boolean(codex.ok) &&
    (codex.auth || looksLikeFakeCodex(bin ?? ""));

  return {
    ok: true,
    ready,
    node: process.versions.node,
    platform: process.platform,
    pluginRoot: ctx.pluginRoot,
    installDir: defaultInstallDir(),
    dataDir: ctx.dataDir,
    codexHome: process.env.CODEX_HOME || join(homedir(), ".codex"),
    codex,
    notes,
    next: ready
      ? "Run /mycodex:run <task> in this Agent chat."
      : "Install the official Codex CLI, run `codex login`, then Reload Window and retry /mycodex:setup.",
  };
}
