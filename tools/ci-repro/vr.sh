#!/usr/bin/env bash
#
# tools/ci-repro/vr.sh — reproduce the Visual Regression Matrix locally in the
# exact digest-pinned CI Playwright container, WITHOUT clobbering the host
# checkout's macOS native bindings.
#
# Why this exists
# ---------------
# `.github/workflows/visual-regression.yml` runs inside a sha256-pinned
# Playwright container — the only environment whose screenshots match the
# committed `tests/visual-regression/__screenshots__/` baselines. Running that
# container against the host checkout means a Linux `pnpm install` overwrites
# the host's rolldown/esbuild/swc native binaries in the shared `node_modules`,
# forcing a recovery `pnpm install` on the host every single time.
#
# This script keeps a separate "Linux mirror" of the repo — a sibling
# `<repo>-ci-linux` directory. The host checkout's `node_modules` is NEVER
# mounted or touched. The mirror's `node_modules` is Linux and is reused across
# runs, so repeat runs are fast. Uncommitted changes in the host checkout ARE
# included (rsync copies the working tree, minus build output), so you can edit
# in your normal checkout and just re-run this.
#
# Usage
# -----
#   tools/ci-repro/vr.sh                 # full VR matrix (exactly what CI runs)
#   tools/ci-repro/vr.sh Uppy            # only cells matching --grep "Uppy"
#   tools/ci-repro/vr.sh 'Uppy|Table'    # the argument is a Playwright --grep regex
#
# Artifacts (diff/actual/expected PNGs) are reported at the end; they live in
# the mirror under tests/visual-regression/test-results/.
#
set -euo pipefail

case "${1:-}" in
  -h|--help)
    sed -n '3,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
MIRROR="$(dirname "$REPO_ROOT")/$(basename "$REPO_ROOT")-ci-linux"
GREP="${1:-}"

# Pinned Playwright image — read straight from the workflow so it can never
# drift from what CI actually uses.
IMAGE="$(grep -oE 'mcr\.microsoft\.com/playwright:[^ ]+' \
  "$REPO_ROOT/.github/workflows/visual-regression.yml" | head -1)"
[ -n "$IMAGE" ] || {
  echo "ERROR: could not read the pinned Playwright image from .github/workflows/visual-regression.yml" >&2
  exit 1
}

docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker daemon is not running — start Docker/OrbStack and retry." >&2
  exit 1
}

echo "▶ VR container repro"
echo "  image:  $IMAGE"
echo "  mirror: $MIRROR"
if [ -n "$GREP" ]; then echo "  scope:  --grep \"$GREP\""; else echo "  scope:  full matrix"; fi
echo

# Sync host working tree -> Linux mirror. `node_modules` (and build output) are
# excluded, so --delete cannot touch them — the mirror's Linux install survives
# and is reused. Uncommitted host changes ARE copied.
echo "▶ syncing working tree → mirror (rsync; node_modules preserved)…"
mkdir -p "$MIRROR"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.turbo' \
  --exclude 'test-results' \
  --exclude 'playwright-report' \
  --exclude '.pnpm-store' \
  "$REPO_ROOT/" "$MIRROR/"

# Run the pinned container against the mirror. The body is single-quoted so the
# host shell does not interpolate it; the --grep value is passed via -e to keep
# it clear of quoting hazards.
echo "▶ running pinned Playwright container…"
echo
set +e
docker run --rm \
  -e CI=true \
  -e VR_GREP="$GREP" \
  -v "$MIRROR":/work \
  -w /work \
  "$IMAGE" \
  bash -lc '
    set -e
    corepack enable
    pnpm install --frozen-lockfile
    pnpm turbo run build
    cd tests/visual-regression
    if [ -n "${VR_GREP:-}" ]; then
      pnpm exec playwright test --grep "$VR_GREP" --reporter=list
    else
      pnpm exec playwright test --reporter=list
    fi
  '
STATUS=$?
set -e

RESULTS="$MIRROR/tests/visual-regression/test-results"
echo
if [ "$STATUS" -eq 0 ]; then
  echo "✓ VR repro passed (exit 0)"
else
  echo "✗ VR repro failed (exit $STATUS)"
  if [ -d "$RESULTS" ]; then
    echo "  artifacts (diff/actual/expected PNGs):"
    echo "    $RESULTS/"
    find "$RESULTS" -name '*.png' 2>/dev/null | sed 's|^|    |' | head -30
  fi
fi
echo
echo "Host checkout untouched — no recovery 'pnpm install' needed."
exit "$STATUS"
