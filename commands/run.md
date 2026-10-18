---
name: run
description: Delegate a coding task to the local Codex CLI (writable, background by default). Flags --read --wait --resume --fresh --cwd --model --effort.
---

# /mycodex:run

Dispatch this task to the local Codex CLI through the MyCodex companion. Do **not** implement the user's request yourself.

## Shell

Use the Shell tool. On the first attempt set `required_permissions: ["all"]` so Codex can read `~/.codex`. Do not start in the workspace-only sandbox.

Read `pluginRoot` and `cursorSessionId` from this conversation's MyCodex additional_context. Fallbacks: `$CURSOR_PLUGIN_ROOT` or `$HOME/.cursor/plugins/local/mycodex`.

Run **exactly one** invocation. Append the user's text as extra argv after `--`. Do not interpolate the prompt into a generated script. Do not wrap the prompt in `bash -c`. Do not add `--model` or `--effort` unless the user wrote them.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" exec \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the companion's complete stdout.

- A receipt (`kind: "receipt"`) means the job started, not that the work is done. Follow with `/mycodex:status` or `/mycodex:result`.
- `NOT_READY` → tell the user to run `/mycodex:setup`.
- `WRITE_BUSY` → report the existing job id; do not start another write.
- Do not edit the same files while a write job is running.
