import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.mjs";

const DEFAULT_LOCAL_NAME = "mycodex";

export function companionDir() {
  return dirname(fileURLToPath(new URL("../codex-run.mjs", import.meta.url)));
}

export function repoPluginRoot() {
  return dirname(companionDir());
}

/**
 * @param {{ pluginRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function resolvePluginRoot(opts = {}) {
  const env = opts.env ?? process.env;
  if (opts.pluginRoot) return resolve(opts.pluginRoot);
  if (env.CURSOR_PLUGIN_ROOT) return resolve(env.CURSOR_PLUGIN_ROOT);
  if (env.MYCODEX_PLUGIN_ROOT) return resolve(env.MYCODEX_PLUGIN_ROOT);

  const bundled = repoPluginRoot();
  // Running from the git checkout or from ~/.cursor/plugins/local/mycodex.
  return bundled;
}

export function defaultInstallDir(home = homedir()) {
  return join(home, ".cursor", "plugins", "local", DEFAULT_LOCAL_NAME);
}

/**
 * @param {{ dataDir?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function resolveDataDir(opts = {}) {
  const env = opts.env ?? process.env;
  if (opts.dataDir) return resolve(opts.dataDir);
  if (env.MYCODEX_DATA_DIR) return resolve(env.MYCODEX_DATA_DIR);
  return join(homedir(), ".cursor", "codex-local");
}

/** @param {string} workspaceRoot */
export function workspaceHash(workspaceRoot) {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 16);
}

/** @param {string} dataDir @param {string} workspaceRoot */
export function workspaceStoreDir(dataDir, workspaceRoot) {
  return join(dataDir, workspaceHash(workspaceRoot));
}

/** @param {string} dataDir */
export function contextsDir(dataDir) {
  return join(dataDir, "contexts");
}

export function assertAbsoluteDir(label, value) {
  if (!value || !isAbsolute(value)) {
    throw new AppError("INTERNAL", `${label} must be an absolute path`);
  }
  return value;
}
