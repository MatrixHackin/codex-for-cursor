---
name: cancel
description: Stop a running MyCodex job and its process group. Optional task-xxxxxxxx id.
---

# /mycodex:cancel

Cancel the job, then report stdout. Do not start a replacement write unless the user asks.

Use the Shell tool with `required_permissions: ["all"]` on the first attempt.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" cancel \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the complete stdout.
