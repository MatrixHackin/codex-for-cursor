---
name: result
description: Print the completed output of a MyCodex job. Optional task-xxxxxxxx id. Does not invent output if the job is still running.
---

# /mycodex:result

If stdout says `JOB_NOT_DONE`, tell the user the job is still running. Do not fabricate a result.

Use the Shell tool with `required_permissions: ["all"]` on the first attempt.

```sh
plugin_root="${CURSOR_PLUGIN_ROOT:-$HOME/.cursor/plugins/local/mycodex}"
session="<cursorSessionId from additional_context>"
node "$plugin_root/scripts/codex-run.mjs" result \
  --plugin-root "$plugin_root" \
  --cursor-session "$session" \
  -- \
  $ARGUMENTS
```

Return the complete stdout.
