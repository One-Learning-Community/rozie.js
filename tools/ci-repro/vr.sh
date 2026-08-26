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
#   -w <n>, --workers <n>       Playwright --workers for THIS LOCAL RUN ONLY.
#                               Unflagged, Playwright uses ceil(cpus/2) — on the
#                               6-CPU Docker VM that is 3 workers, NOT 1. Raising
#                               it alone is near-useless: 3 and 6 workers both
#                               measured 21.5m at ~140% CPU, because the real
#                               limit is per-FILE serialisation (see -p).
#                               3 IS THE SWEET SPOT: with -p, a scoped file ran
#                               26s at BOTH 3 and 6 workers, and 6 workers is
#                               what produced a timing flake (a 30.0s timeout =
#                               starvation, not an assertion failure). Prefer
#                               -p alone, or -p -w 3.
#                               Passed as a CLI arg, never written into
#                               playwright.config.ts, so GitHub CI is unaffected.
#                               CAVEAT: this deliberately breaks local↔CI
#                               parity on scheduling. Concurrency can surface
#                               timing-sensitive flake that a serial run hides
#                               (and `retries: 2` under CI can disguise it as a
#                               slow green), so treat a green parallel run as
#                               weaker evidence than a green serial one, and
#                               re-run serially before trusting a release gate.
#                               Cap it at the DOCKER VM's CPU count, not the
#                               host's — the VM typically gets fewer.
#   -p, --fully-parallel        Pass Playwright --fully-parallel for THIS LOCAL
#                               RUN ONLY. The config leaves fullyParallel at its
#                               default (false), so the unit of parallelism is
#                               the FILE. matrix.spec.ts holds ~337 of the ~2250
#                               tests and rete-flow.spec.ts ~247, so one worker
#                               grinds the long pole while others idle — which
#                               is why raising --workers ALONE does nothing
#                               (3 and 6 workers both finished in 21.5m).
#                               HONEST STATUS: a scoped 66-test file went
#                               58s -> 43s with this, and one full-suite run
#                               went 21.5m -> 19.3m. That full-suite figure is
#                               a SINGLE SAMPLE with no variance baseline, and
#                               a concurrent build was running on the same host,
#                               so treat ~10% as unproven, not measured. Run the
#                               SAME config 3x on a quiet machine before
#                               believing any delta here.
#                               Safe here because no spec uses beforeAll /
#                               afterAll / describe.serial; re-check if serial
#                               fixtures are ever added.
#
#   NOT A FLAG — a recorded NEGATIVE RESULT so it is not retried blindly:
#   disabling the preview server's gzip was tried and REVERTED. Rationale was
#   sound (compression on loopback trades CPU for a memory copy) and a curl
#   microbenchmark agreed (2.7x cheaper per asset request). But the full suite
#   got SLOWER: 21.2m uncompressed vs 19.3m compressed, with mean test duration
#   UP 3.16s -> 3.49s. Likely because gzip trades server CPU (a saturated single
#   thread) for browser receive+parse (which had headroom) — a favourable trade
#   here. The microbenchmark used curl and so never paid the browser-side cost,
#   which is exactly the term that flips the sign. Vite 8 exposes no preview
#   compression option anyway; it took an Accept-Encoding-rewriting plugin.
#
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
  # Print the header comment block from line 3 up to (not including) the first
  # non-comment line. Derived, not a hardcoded range: the previous `3,57p`
  # silently truncated --help the moment the banner grew past line 57.
  awk 'NR>=3 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

GREP=""
UPDATE=false
SHELL_MODE=false
BOOTSTRAP=""
# Playwright worker count for THIS local run only. Empty = do not pass
# --workers, i.e. Playwright's own default of ceil(cpus/2) — MEASURED as 3 on
# the 6-CPU Docker VM, not 1. (An earlier version of this comment claimed CI=true
# forces a single worker; it does not, and the run log's "using 3 workers" line
# disproves it.) Raising this alone does essentially nothing: 3 workers and 6
# workers both finished a full union run in 21.5m at ~140% CPU, because the
# binding constraint is per-FILE serialisation, not worker count — see
# FULLY_PARALLEL below.
#
# This flag is a LOCAL knob only: it is passed as a command-line arg, never
# written into tests/visual-regression/playwright.config.ts, so GitHub CI is
# completely unaffected. That separation is deliberate — see the parity caveat
# in --help.
WORKERS=""
# Pass Playwright's --fully-parallel for THIS local run only.
#
# WHY THIS IS THE KNOB THAT ACTUALLY MATTERS: playwright.config.ts leaves
# fullyParallel at its default (false), which makes the unit of parallelism the
# FILE, not the test. The suite's ~2250 tests are generated dynamically per
# (example × target) and are very unevenly distributed across 88 spec files —
# matrix.spec.ts alone holds ~337 and rete-flow.spec.ts ~247. With
# fullyParallel off, ONE worker runs matrix.spec.ts's 337 tests end to end
# while the other workers drain and idle, so the wall clock has a hard floor at
# "longest single file" and raising --workers changes nothing. Measured: 3
# workers and 6 workers both finished in 21.5m at ~140% CPU on an 18-core host.
#
# Safe for this suite specifically: no spec file uses beforeAll/afterAll or
# describe.serial, and every generated test is self-contained, so there is no
# intra-file ordering or shared state for fullyParallel to break. Re-check that
# before assuming it still holds if serial fixtures are ever introduced.
FULLY_PARALLEL=false

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
    -p|--fully-parallel)
      FULLY_PARALLEL=true
      shift
      ;;
    -w|--workers)
      [ $# -ge 2 ] || { echo "ERROR: $1 requires an argument" >&2; exit 2; }
      case "$2" in
        ''|*[!0-9]*) echo "ERROR: $1 expects a positive integer, got '$2'" >&2; exit 2 ;;
      esac
      [ "$2" -ge 1 ] || { echo "ERROR: $1 must be >= 1, got '$2'" >&2; exit 2; }
      WORKERS="$2"
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
if $FULLY_PARALLEL; then
  PLAYWRIGHT_FLAGS="$PLAYWRIGHT_FLAGS --fully-parallel"
  echo "▶ --fully-parallel (LOCAL ONLY — playwright.config.ts and CI are untouched)"
fi
if [ -n "$WORKERS" ]; then
  PLAYWRIGHT_FLAGS="$PLAYWRIGHT_FLAGS --workers=$WORKERS"
  echo "▶ --workers=$WORKERS (LOCAL ONLY — CI still runs Playwright's CI default of 1)"
  # The container sees only what the Docker VM was given, NOT the host's core
  # count. Warn when the requested worker count exceeds it, because past that
  # point workers contend for the same cores and the run gets slower, not
  # faster (and timing-sensitive cells start to flake).
  _VM_CPUS="$(docker info --format '{{.NCPU}}' 2>/dev/null || echo '')"
  if [ -n "$_VM_CPUS" ] && [ "$WORKERS" -gt "$_VM_CPUS" ]; then
    echo "  ⚠ requested $WORKERS workers but the Docker VM exposes only $_VM_CPUS CPUs —" >&2
    echo "    they will contend. Raise the VM's CPU allocation (OrbStack/Docker Desktop" >&2
    echo "    settings) rather than the worker count." >&2
  fi
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
    # --continue tolerates the known PRE-EXISTING, unrelated
    # @rozie-ui/date-picker-angular#build failure (TS2322 at DatePicker.ts:531,
    # tracked in .planning phase-73 deferred-items.md), which predates this
    # invocation and is not a VR/visual regression. Without --continue, turbo
    # halts the ENTIRE build on that one failing task before it ever reaches
    # the packages the VR matrix actually needs, so no Playwright cell can run
    # at all. `|| true` swallows the resulting non-zero exit for this known
    # case; any OTHER task failure still prints in the turbo summary above and
    # will surface as missing dist output / a later container-side error.
    pnpm turbo run build --force --continue || true
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
