import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { AppError } from "./errors.mjs";

/**
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, workspaceRoot?: string }} opts
 */
export function resolveWorkspaceRoot(opts = {}) {
  const env = opts.env ?? process.env;
  if (opts.workspaceRoot) return realExisting(opts.workspaceRoot);
  if (env.CURSOR_PROJECT_DIR) return realExisting(env.CURSOR_PROJECT_DIR);
  if (env.MYCODEX_WORKSPACE_ROOT) return realExisting(env.MYCODEX_WORKSPACE_ROOT);

  const start = resolve(opts.cwd ?? process.cwd());
  const gitRoot = findGitRoot(start);
  if (gitRoot) return gitRoot;
  return realExisting(start);
}

/** @param {string} start */
export function findGitRoot(start) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".git"))) return realExisting(dir);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve `--cwd` against the workspace root. The result must stay inside
 * that workspace (after realpath), including the root itself.
 *
 * @param {string} workspaceRoot
 * @param {string | undefined} cwdOption
 */
export function resolveJobCwd(workspaceRoot, cwdOption) {
  const root = realExisting(workspaceRoot);
  if (!cwdOption) return root;

  const candidate = isAbsolute(cwdOption)
    ? resolve(cwdOption)
    : resolve(root, cwdOption);

  if (!existsSync(candidate)) {
    throw new AppError("CWD_OUTSIDE_WORKSPACE", `cwd does not exist: ${candidate}`, {
      cwd: candidate,
      workspaceRoot: root,
    });
  }

  const real = realExisting(candidate);
  if (!isInside(root, real)) {
    throw new AppError(
      "CWD_OUTSIDE_WORKSPACE",
      `--cwd must resolve inside the Cursor workspace (${root})`,
      { cwd: real, workspaceRoot: root },
    );
  }
  return real;
}

/** @param {string} root @param {string} path */
export function isInside(root, path) {
  const rel = relative(root, path);
  if (rel === "") return true;
  return !rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("..");
}

/** @param {string} path */
function realExisting(path) {
  const abs = resolve(path);
  try {
    const st = statSync(abs);
    if (!st.isDirectory()) {
      throw new AppError("CWD_OUTSIDE_WORKSPACE", `Not a directory: ${abs}`);
    }
    return realpathSync(abs);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("CWD_OUTSIDE_WORKSPACE", `Path does not exist: ${abs}`);
  }
}
