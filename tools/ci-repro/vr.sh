#!/usr/bin/env bash
#
# tools/ci-repro/vr.sh — reproduce the Visual Regression Matrix locally in the
# exact digest-pinned CI Playwright container, WITHOUT clobbering the host
# checkout's macOS native bindings. Doubles as the baseline-regen tool
# (--update) and an interactive debug shell (--shell) inside the same pinned
# environment.
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
# Modes
# -----
#   tools/ci-repro/vr.sh                       # full matrix (CI parity)
#   tools/ci-repro/vr.sh Uppy                  # legacy positional --grep
#   tools/ci-repro/vr.sh -g 'Uppy|Table'       # explicit --grep
#   tools/ci-repro/vr.sh -u -g ThemedButton    # regen baselines for that grep
#   tools/ci-repro/vr.sh --shell               # interactive bash in the
#                                              # mirror, container already up
#   tools/ci-repro/vr.sh -h | --help           # this banner
#
# Flags
# -----
#   -g <pat>, --grep <pat>      Playwright --grep regex (named form). The
#                               legacy single positional arg is still accepted
#                               for backward-compat.
#   -u, --update                Pass --update-snapshots to playwright; after
#                               the container exits 0, rsync the mirror's
#                               tests/visual-regression/__screenshots__/ back
#                               to the host repo so the new/updated PNGs are
#                               committable from the host.
#   -b <names>, --bootstrap <names>
#                               Comma-separated example names to set in the
#                               container's ROZIE_VR_BOOTSTRAP_BASELINE env
#                               var — temporarily ungates matrix.spec.ts cells
#                               whose `.png` baseline does not yet exist (the
#                               chicken-and-egg escape hatch documented in
#                               matrix.spec.ts). Only meaningful with --update.
#   -s, --shell                 Drop into an interactive bash shell inside the
#                               pinned container at /work (mirror). Mutually
#                               exclusive with --update.
#   -h, --help                  Print this help.
#
# Artifacts (diff/actual/expected PNGs) are reported at the end; they live in
# the mirror under tests/visual-regression/test-results/.
#
set -euo pipefail

usage() {
  sed -n '3,57p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

GREP=""
UPDATE=false
SHELL_MODE=false
BOOTSTRAP=""

# Parse args. Pure bash, no getopt. Accepts:
#   - explicit flags (-g/--grep, -u/--update, -s/--shell, -b/--bootstrap, -h/--help)
#   - exactly one bare positional → legacy --grep
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -u|--update)
      UPDATE=true
      shift
      ;;
    -s|--shell)
      SHELL_MODE=true
      shift
      ;;
    -g|--grep)
      [ $# -ge 2 ] || { echo "ERROR: $1 requires an argument" >&2; exit 2; }
      GREP="$2"
      shift 2
      ;;
    -b|--bootstrap)
      [ $# -ge 2 ] || { echo "ERROR: $1 requires an argument" >&2; exit 2; }
      BOOTSTRAP="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "ERROR: unknown flag $1 — try --help" >&2
      exit 2
      ;;
    *)
      # Backward-compat: a single bare positional is the --grep pattern.
      if [ -n "$GREP" ]; then
        echo "ERROR: unexpected positional '$1' (--grep already set to '$GREP')" >&2
        exit 2
      fi
      GREP="$1"
      shift
      ;;
  esac
done

if $UPDATE && $SHELL_MODE; then
  echo "ERROR: --update and --shell are mutually exclusive" >&2
  exit 2
fi

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
MIRROR="$(dirname "$REPO_ROOT")/$(basename "$REPO_ROOT")-ci-linux"

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

# Detect the daemon flavor (OrbStack vs Docker Desktop vs plain dockerd) by
# inspecting `docker info` server fields. Purely informational — the run path
# is identical across daemons.
DAEMON="docker"
DOCKER_INFO="$(docker info 2>/dev/null || true)"
if printf '%s' "$DOCKER_INFO" | grep -qi 'orbstack'; then
  DAEMON="OrbStack"
elif printf '%s' "$DOCKER_INFO" | grep -qi 'docker desktop'; then
  DAEMON="Docker Desktop"
fi

echo "▶ VR container repro"
echo "  daemon: $DAEMON"
echo "  image:  $IMAGE"
echo "  mirror: $MIRROR"
if $SHELL_MODE; then
  echo "  mode:   interactive shell"
elif $UPDATE; then
  if [ -n "$GREP" ]; then echo "  mode:   regen baselines  (--grep \"$GREP\")"; else echo "  mode:   regen baselines  (full matrix)"; fi
  [ -n "$BOOTSTRAP" ] && echo "  bootstrap: $BOOTSTRAP"
else
  if [ -n "$GREP" ]; then echo "  scope:  --grep \"$GREP\""; else echo "  scope:  full matrix"; fi
fi
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

# Snapshot the host's __screenshots__ dir BEFORE the container run so we can
# diff afterward and report exactly which baselines moved.
HOST_SHOTS="$REPO_ROOT/tests/visual-regression/__screenshots__"
HOST_SHOTS_HASH_BEFORE=""
if [ -d "$HOST_SHOTS" ]; then
  HOST_SHOTS_HASH_BEFORE="$(find "$HOST_SHOTS" -type f -name '*.png' -exec md5 -q {} \; 2>/dev/null \
    | sort | md5 -q 2>/dev/null || true)"
fi

# --- SHELL MODE -------------------------------------------------------------
if $SHELL_MODE; then
  echo "▶ launching interactive shell in pinned container…"
  echo "  /work is the Linux mirror. node_modules is already populated."
  echo "  Exit the shell to return; the host checkout is untouched."
  echo
  exec docker run --rm -it \
    -e CI=true \
    -v "$MIRROR":/work \
    -w /work \
    "$IMAGE" \
    bash -l
fi

# --- TEST MODE (default, or --update) --------------------------------------

PLAYWRIGHT_FLAGS=""
if $UPDATE; then
  PLAYWRIGHT_FLAGS="--update-snapshots"
fi

# Run the pinned container against the mirror. The body is single-quoted so the
# host shell does not interpolate it; --grep / flags / bootstrap pass via -e.
echo "▶ running pinned Playwright container…"
echo
set +e
docker run --rm \
  -e CI=true \
  -e VR_GREP="$GREP" \
  -e VR_PLAYWRIGHT_FLAGS="$PLAYWRIGHT_FLAGS" \
  -e ROZIE_VR_BOOTSTRAP_BASELINE="$BOOTSTRAP" \
  -v "$MIRROR":/work \
  -w /work \
  "$IMAGE" \
  bash -lc '
    set -e
    corepack enable
    pnpm install --frozen-lockfile
    # --force is mandatory, not an optimization opt-out. The mirror reuses its
    # .turbo cache + dist across runs (both are rsync-excluded so a host edit
    # never overwrites them). CI, by contrast, always builds cold in a fresh
    # container. Without --force, a cross-package source edit (e.g. a data-table
    # .rzts/.rozie change) that is not hashed into the VR-host build task gets a
    # stale turbo cache hit, so the container silently tests the PREVIOUS build —
    # producing phantom greens/reds that do not match CI. --force restores CI
    # parity (cold build every run). node_modules is still reused, so the
    # expensive `pnpm install` is unaffected — only the build recompiles.
    pnpm turbo run build --force
    cd tests/visual-regression
    ARGS=(--reporter=list)
    if [ -n "${VR_GREP:-}" ]; then
      ARGS+=(--grep "$VR_GREP")
    fi
    if [ -n "${VR_PLAYWRIGHT_FLAGS:-}" ]; then
      # shellcheck disable=SC2206
      ARGS+=($VR_PLAYWRIGHT_FLAGS)
    fi
    pnpm exec playwright test "${ARGS[@]}"
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

# --- --update: rsync screenshots back to the host repo ----------------------
if $UPDATE; then
  MIRROR_SHOTS="$MIRROR/tests/visual-regression/__screenshots__"
  if [ -d "$MIRROR_SHOTS" ]; then
    echo
    echo "▶ rsync'ing updated baselines back to host repo…"
    mkdir -p "$HOST_SHOTS"
    # Copy (no --delete: a regen for one example must not nuke unrelated PNGs).
    rsync -a "$MIRROR_SHOTS/" "$HOST_SHOTS/"

    HOST_SHOTS_HASH_AFTER="$(find "$HOST_SHOTS" -type f -name '*.png' -exec md5 -q {} \; 2>/dev/null \
      | sort | md5 -q 2>/dev/null || true)"

    echo
    if [ "$HOST_SHOTS_HASH_BEFORE" = "$HOST_SHOTS_HASH_AFTER" ]; then
      echo "  (no baseline PNGs changed)"
    else
      echo "  changed baseline PNGs:"
      git -C "$REPO_ROOT" status --short -- tests/visual-regression/__screenshots__/ \
        | sed 's|^|    |' || true
    fi
  else
    echo
    echo "WARNING: --update was set but $MIRROR_SHOTS does not exist."
  fi
fi

echo
echo "Host checkout untouched — no recovery 'pnpm install' needed."
exit "$STATUS"
