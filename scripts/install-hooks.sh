#!/usr/bin/env bash
#
# scripts/install-hooks.sh — install Rozie's local git hooks.
#
# Writes `.git/hooks/pre-push` to invoke `scripts/ci-prepush.sh`. Idempotent
# (overwrites any prior pre-push hook). Run via `pnpm run install-hooks` or
# directly: `bash scripts/install-hooks.sh`.
#
# Why this exists (no husky / simple-git-hooks): keeps the install side
# effect explicit + visible. The repo doesn't auto-install hooks on
# `pnpm install` — each clone opts in. Bypass any single push with
# `git push --no-verify` (standard git behavior).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DIR="$ROOT/.git/hooks"
HOOK_FILE="$HOOK_DIR/pre-push"

if [ ! -d "$HOOK_DIR" ]; then
  echo "ERROR: $HOOK_DIR does not exist — is this a git checkout?" >&2
  exit 1
fi

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
#
# pre-push — invokes scripts/ci-prepush.sh.
#
# Auto-installed by `pnpm run install-hooks`. Bypass with
# `git push --no-verify`. To uninstall: `rm .git/hooks/pre-push`.

set -e
ROOT="$(git rev-parse --show-toplevel)"
exec bash "$ROOT/scripts/ci-prepush.sh"
EOF

chmod +x "$HOOK_FILE"

echo "✓ installed $HOOK_FILE"
echo "  bypass single push: git push --no-verify"
echo "  uninstall:          rm $HOOK_FILE"
