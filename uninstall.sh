#!/usr/bin/env bash
set -euo pipefail

dest="${MYCODEX_INSTALL_DIR:-$HOME/.cursor/plugins/local/mycodex}"
state="${MYCODEX_DATA_DIR:-$HOME/.cursor/codex-local}"
purge=0

for arg in "$@"; do
  case "$arg" in
    --purge-state) purge=1 ;;
    --help|-h)
      echo "Usage: ./uninstall.sh [--purge-state]"
      echo "Removes ~/.cursor/plugins/local/mycodex"
      echo "--purge-state also deletes ~/.cursor/codex-local (job receipts)."
      echo "Never touches ~/.codex."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -e "$dest" ]]; then
  rm -rf "$dest"
  echo "Removed $dest"
else
  echo "No install at $dest"
fi

if (( purge )); then
  rm -rf "$state"
  echo "Removed $state"
else
  echo "Left job state in $state (pass --purge-state to delete it)"
fi

echo "Did not touch ~/.codex"
echo "Reload Window so Cursor drops the plugin."
