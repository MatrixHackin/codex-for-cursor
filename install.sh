#!/usr/bin/env bash
set -euo pipefail

if [[ "${OS:-}" == "Windows_NT" ]]; then
  echo "MyCodex v1 does not support Windows." >&2
  exit 1
fi

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${MYCODEX_INSTALL_DIR:-$HOME/.cursor/plugins/local/mycodex}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required (node not found on PATH)." >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if (( node_major < 20 )); then
  echo "Node.js 20+ is required (found $(node -v))." >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Note: Codex CLI is not on PATH. Install the official CLI and run: codex login" >&2
  echo "      macOS/Linux: curl -fsSL https://chatgpt.com/codex/install.sh | sh" >&2
fi

mkdir -p "$(dirname "$dest")"
if [[ -d "$dest" ]]; then
  bak="${dest}.bak.$(date +%Y%m%d%H%M%S)"
  echo "Backing up existing install to $bak"
  mv "$dest" "$bak"
fi
mkdir -p "$dest"

if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'tmp/' \
    --exclude 'tests/tmp/' \
    "$src/" "$dest/"
else
  cp -a "$src/." "$dest/"
  rm -rf "$dest/.git" "$dest/node_modules" "$dest/tmp" "$dest/tests/tmp"
fi

cat <<EOF

MyCodex installed to:
  $dest

Slash commands (path A only):
  /mycodex:setup
  /mycodex:run
  /mycodex:review
  /mycodex:status
  /mycodex:result
  /mycodex:cancel

Next:
  1. Cursor Settings → enable third-party plugins / local plugin imports
  2. Developer: Reload Window
  3. Open a new Agent chat
  4. Run /mycodex:setup  (ready should be true)

Uninstall: $src/uninstall.sh
EOF
