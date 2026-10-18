---
name: status
description: Show a MyCodex job. Optional task-xxxxxxxx id; --wait polls until it finishes.
---

# /mycodex:status

Do not invent job output. If the job is still running, say so.

Use the Shell tool with `required_permissions: ["all"]` on the first attempt.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" status \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the complete stdout. With no id, this conversation's last job is used.
