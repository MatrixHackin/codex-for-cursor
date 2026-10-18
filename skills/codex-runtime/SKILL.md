---
name: codex-runtime
description: How to invoke the MyCodex companion from Cursor Agent chat. Use when the user runs /mycodex:run, /mycodex:setup, /mycodex:review, /mycodex:status, /mycodex:result, or /mycodex:cancel, or when delegating work to the local Codex CLI.
---

# MyCodex runtime

Cursor plans and checks. The local `codex` binary executes. You are not Codex.

## Invoke

Always Shell, first try `required_permissions: ["all"]`.

```sh
node "$pluginRoot/scripts/codex-run.mjs" <setup|exec|review|status|result|cancel> \
  --plugin-root "$pluginRoot" \
  --cursor-session "$cursorSessionId" \
  -- \
  <user argv>
```

`pluginRoot` and `cursorSessionId` come from MyCodex additional_context, not from guessed env vars.

## Flags (user-authored only)

| Flag | Meaning |
| --- | --- |
| `--read` | exec in a read-only sandbox |
| `--wait` | block until the job finishes |
| `--resume` | continue this chat's last Codex session id (never `--last`) |
| `--fresh` | new Codex session |
| `--cwd <path>` | must resolve inside the Cursor workspace |
| `--model` / `--effort` | pass through only if the user wrote them |
| `--base <branch>` | review against that branch |
| `--adversarial` | review that challenges the change |
| `--background` | review without waiting (review waits by default) |

Parse nothing yourself. Put user text after `--` so a prompt that starts with `--` is safe.

## Lanes

- `/mycodex:run` defaults to **write** (`workspace-write`) and **background**.
- One write job per workspace. Second write returns `WRITE_BUSY`.
- `/mycodex:review` is **read-only** and does **not** take the write lock.

## Errors

| Code | What you do |
| --- | --- |
| `NOT_READY` | Tell the user to run `/mycodex:setup` |
| `WRITE_BUSY` | Report the existing id; do not start another write |
| `CWD_OUTSIDE_WORKSPACE` | Ask for a path inside the workspace |
| `THREAD_NOT_FOUND` | Drop `--resume` or use `--fresh` |
| `JOB_NOT_DONE` | Do not invent output |
| `RECOVERY_REQUIRED` | Ask the user to inspect the tree; do not replay the same write |
| `SESSION_CONTEXT_MISSING` | New Agent chat |

## Discipline

- Prompt goes to Codex on stdin (`codex exec … -`). Never hang a prompt on argv without `-`.
- A receipt is not completion.
- Do not edit the same files as a running write job.
- Review findings are not applied until the user runs `/mycodex:run`.
