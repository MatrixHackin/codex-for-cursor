import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { AppError } from "./errors.mjs";

/**
 * @param {{ codexBin?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string | null}
 */
export function findCodexBin(opts = {}) {
  const env = opts.env ?? process.env;
  if (opts.codexBin) return opts.codexBin;
  if (env.MYCODEX_CODEX_BIN) return env.MYCODEX_CODEX_BIN;

  const pathEnv = env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, "codex");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {string} bin
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readCodexVersion(bin, env = process.env) {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    env,
    timeout: 8_000,
  });
  if (result.error) {
    throw new AppError("NOT_READY", `Failed to run ${bin} --version: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new AppError("NOT_READY", `codex --version exited ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return (result.stdout || result.stderr || "").trim();
}

/** @param {string} versionText @param {string} bin */
export function assertRealCodex(versionText, bin) {
  const lower = versionText.toLowerCase();
  if (/kay[- ]compat|claude[- ]compat|cursor[- ]kay/.test(lower)) {
    throw new AppError(
      "NOT_READY",
      `Refusing compatibility alias at ${bin}. Install the official Codex CLI and put it first on PATH.`,
    );
  }
  if (!/codex/i.test(versionText)) {
    throw new AppError(
      "NOT_READY",
      `Binary at ${bin} did not look like Codex CLI (got: ${versionText.split("\n")[0] ?? ""})`,
    );
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function hasCodexAuth(env = process.env) {
  if (env.CODEX_API_KEY || env.OPENAI_API_KEY) return true;
  if (env.MYCODEX_SKIP_AUTH === "1") return true;
  const home = env.CODEX_HOME || join(homedir(), ".codex");
  return existsSync(join(home, "auth.json"));
}

/** @param {string} bin */
export function looksLikeFakeCodex(bin) {
  return /(^|[\\/])fake-codex(\.mjs)?$/.test(bin);
}

/**
 * @param {{ codexBin?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function requireCodex(opts = {}) {
  const env = opts.env ?? process.env;
  const bin = findCodexBin(opts);
  if (!bin) {
    throw new AppError(
      "NOT_READY",
      "Codex CLI not found on PATH. Install it, run `codex login`, then `/mycodex:setup`.",
    );
  }
  const resolved = isAbsolute(bin) ? bin : join(dirname(bin), bin);
  if (!existsSync(bin)) {
    throw new AppError("NOT_READY", `Codex CLI path does not exist: ${bin}`);
  }
  const version = readCodexVersion(bin, env);
  if (!looksLikeFakeCodex(bin)) {
    assertRealCodex(version, bin);
    if (!hasCodexAuth(env)) {
      throw new AppError(
        "NOT_READY",
        "Codex CLI is installed but not authenticated. Run `codex login` (or set CODEX_API_KEY), then `/mycodex:setup`.",
        { path: bin, version },
      );
    }
  }
  return { path: resolved || bin, version, bin };
}
