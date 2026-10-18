import { AppError } from "./errors.mjs";

const BOOLEAN_FLAGS = new Set([
  "read",
  "wait",
  "resume",
  "fresh",
  "json",
  "adversarial",
  "background",
  "help",
  "purge-state",
]);

const VALUE_FLAGS = new Set([
  "cwd",
  "model",
  "effort",
  "cursor-session",
  "plugin-root",
  "timeout-ms",
  "base",
  "data-dir",
  "codex-bin",
  "workspace-root",
  "job-id",
]);

/** @param {string} name */
function camelCase(name) {
  return name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Parse flags only before the first non-option (or `--`).
 * Prompt text that starts with `--` must be placed after a `--` separator.
 *
 * @param {string[]} argv
 * @returns {{ options: Record<string, string | boolean>, rest: string[] }}
 */
export function parseLeadingOptions(argv) {
  /** @type {Record<string, string | boolean>} */
  const options = {};
  /** @type {string[]} */
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      rest.push(...argv.slice(i + 1));
      return { options, rest };
    }
    if (token === "-") {
      rest.push(...argv.slice(i));
      return { options, rest };
    }
    if (!token.startsWith("-")) {
      rest.push(...argv.slice(i));
      return { options, rest };
    }
    if (!token.startsWith("--") || token === "--") {
      throw new AppError("BAD_ARGS", `Unknown option: ${token}`);
    }

    let name = token.slice(2);
    /** @type {string | undefined} */
    let rawValue;
    const eq = name.indexOf("=");
    if (eq !== -1) {
      rawValue = name.slice(eq + 1);
      name = name.slice(0, eq);
    }

    if (BOOLEAN_FLAGS.has(name)) {
      options[camelCase(name)] = rawValue === undefined ? true : rawValue !== "false";
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      if (rawValue === undefined) {
        i += 1;
        if (i >= argv.length) {
          throw new AppError("BAD_ARGS", `Missing value for --${name}`);
        }
        rawValue = argv[i];
      }
      options[camelCase(name)] = rawValue;
      continue;
    }
    throw new AppError("BAD_ARGS", `Unknown option: --${name}`);
  }

  return { options, rest };
}

/** @param {string | undefined} value */
export function parseTimeoutMs(value) {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError("BAD_ARGS", `--timeout-ms must be a non-negative number`);
  }
  return n;
}

/** @param {string} value */
export function isJobId(value) {
  return /^task-[0-9a-f]{8}$/.test(value);
}
