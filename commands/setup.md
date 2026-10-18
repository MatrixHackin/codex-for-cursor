---
name: setup
description: Diagnose local Codex CLI, auth, Node, and the MyCodex plugin install. Does not log in or change files.
---

# /mycodex:setup

Only diagnose. Do not run `codex login` or install packages unless the user asked.

Use the Shell tool with `required_permissions: ["all"]` on the first attempt.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" setup \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the complete stdout. If `ready` is false, explain the `notes` and stop; do not try to do the user's coding task yourself.
