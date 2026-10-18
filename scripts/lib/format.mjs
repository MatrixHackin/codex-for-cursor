export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(payload) {
  printJson(payload);
}

export const USAGE = `MyCodex companion — delegate work to the local Codex CLI.

Usage:
  node scripts/codex-run.mjs <setup|exec|review|status|result|cancel> [options] [--] [args]

Common options:
  --plugin-root <dir>       Plugin install path
  --cursor-session <id>     Current Cursor conversation id
  --data-dir <dir>          Job store (default: ~/.cursor/codex-local)
  --codex-bin <path>        Codex CLI path
  --workspace-root <dir>    Cursor workspace root
  --cwd <rel-or-abs>        Working directory; must stay inside the workspace
  --wait                    Block until the job finishes
  --timeout-ms <n>          With --wait, return a receipt if still running
  --json                    Accepted for compatibility (stdout is always JSON)

exec:
  --read                    read-only sandbox (default is workspace-write)
  --resume                  Continue this conversation's last Codex session
  --fresh                   Force a new Codex session
  --model <name>            Only if the user wrote it
  --effort <level>          Only if the user wrote it

review:
  --base <branch>           Review against a base branch (default: --uncommitted)
  --adversarial             Challenge the change, still read-only
  --background              Do not wait (review waits by default)

status / result / cancel:
  [task-id]                 Defaults to this conversation's last job
  --wait                    status only: poll until the job finishes
`;
