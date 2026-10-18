---
name: review
description: Read-only Codex review of the working tree or a base-branch diff. Does not take the write lock. Flags --base --adversarial --background.
---

# /mycodex:review

Ask the local Codex CLI for an independent review. Do **not** apply the findings yourself unless the user then runs `/mycodex:run`.

Review is read-only and may run while a write job is in progress. Do not pass `--resume` here; a review thread is not a coding session.

Use the Shell tool with `required_permissions: ["all"]` on the first attempt.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" review \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the complete stdout. If the user named a base branch, it is `--base <branch>` in `$ARGUMENTS`. Default target is the working tree.
