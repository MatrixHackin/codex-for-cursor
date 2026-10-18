# MyCodex

Cursor plugin that hands work to the **local Codex CLI** (`codex exec` / `codex review`) from Agent chat.

Slash commands are plugin-namespaced only:

```text
/mycodex:setup
/mycodex:run
/mycodex:review
/mycodex:status
/mycodex:result
/mycodex:cancel
```

There is no user-level `/codex` alias. v1 is macOS/Linux only.

This project is independent. It is not affiliated with OpenAI or Cursor.

## Install

```sh
git clone https://github.com/MatrixHackin/codex-for-cursor.git
cd codex-for-cursor
./install.sh
```

`install.sh` copies the plugin to `~/.cursor/plugins/local/mycodex`. It does not install Codex or run `codex login`.

Then:

1. Enable third-party / local plugins in Cursor
2. **Developer: Reload Window**
3. Open a **new** Agent chat
4. Run `/mycodex:setup` and confirm `ready: true`

Needs **Node 20+** and the official **Codex CLI** on `PATH`.

```sh
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex login
```

Uninstall:

```sh
./uninstall.sh           # keep job receipts
./uninstall.sh --purge-state
```

`~/.codex` is never deleted.

## Usage

| Command | What it does |
| --- | --- |
| `/mycodex:run <task>` | Writable `codex exec`, background, returns a job receipt |
| `/mycodex:run --read <task>` | Read-only sandbox |
| `/mycodex:run --wait <task>` | Block until Codex exits |
| `/mycodex:run --resume <task>` | Continue this chat’s last Codex session (never `--last`) |
| `/mycodex:run --fresh <task>` | Force a new session |
| `/mycodex:run --cwd src <task>` | Subdirectory of the current workspace |
| `/mycodex:review [--base main] [focus]` | Read-only review; does not take the write lock |
| `/mycodex:status [task-id] [--wait]` | Last job in this chat, or an explicit id |
| `/mycodex:result [task-id]` | Finished output only; will not invent a result |
| `/mycodex:cancel [task-id]` | Stop the process group |

`--model` / `--effort` are passed through only when you type them.

A **receipt is not completion**. Check `/mycodex:status` or `/mycodex:result`. Cursor should not edit the same files as a running write job.

One write job per workspace at a time (`WRITE_BUSY`). Reviews may run in parallel.

## How it works

- Companion: `scripts/codex-run.mjs`
- Jobs: `~/.cursor/codex-local/<workspace-hash>/`
- Codex sessions stay in `~/.codex/sessions`
- `sessionStart` injects `pluginRoot` + `cursorSessionId` so Agent Shell does not need env vars
- Prompt is sent on stdin (`codex exec … -`)

## Develop

```sh
node --test tests/*.test.mjs
npm run check-commands
```

Tests use `tests/fixtures/fake-codex.mjs` and never call a real Codex account.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
