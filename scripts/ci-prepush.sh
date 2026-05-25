#!/usr/bin/env bash
#
# scripts/ci-prepush.sh — pre-push CI-mirror gate.
#
# Runs the cold-cache equivalent of what GitHub Actions runs on a push.
# Targets the failure class that bit commit 711e2eb: a stale turbo cache
# masking @rozie/core snapshot drift while local `turbo run test` reported
# all-green. The `--force` flag is the difference between "8/8 matrices
# green on push" and "6/8 matrices red on push" — see memory
# feedback_target_suite_snapshots_drift_on_emitter_change.md addendum.
#
# Runs:
#   1. `turbo run typecheck --force --continue` (~16s cold)
#   2. `turbo run test --force --continue` (~30s cold)
#
# Skips (too slow / belongs to CI):
#   - VR matrix (Docker, ~50s — run via `tools/ci-repro/vr.sh` when an
#     emitter or VR-relevant change touches scoping/stylesheet emit)
#   - Consumer-demo e2e (~30s each × 6 demos)
#
# Bypass — standard git: `git push --no-verify` skips the hook entirely.
# Or run directly: `bash scripts/ci-prepush.sh` (same gate, no push).
#
# Install as the git pre-push hook: `pnpm run install-hooks` (writes
# `.git/hooks/pre-push` pointing at this script).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

start=$(date +%s)

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ci-prepush — cold-cache typecheck + test (CI-mirror)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "▶ turbo run typecheck --force --continue --concurrency=4"
echo ""
turbo run typecheck --force --continue --concurrency=4

echo ""
echo "▶ turbo run test --force --continue --concurrency=4"
echo ""
# --concurrency=4 keeps the gate stable. Without a cap, turbo runs every
# task in parallel; on a 10-core box that's fine, but the heavier suites
# (target-react/vue/svelte/angular + dist-parity, all running vitest with
# its own per-test process budget) race vitest's 5s default timeout under
# CPU starvation. Failed packages varied between runs — classic
# turbo-parallel-CPU-starvation flake (memory turbo_parallel_test_flake).
# At --concurrency=4 the gate is reliably green at ~36s cold cache.
turbo run test --force --continue --concurrency=4

end=$(date +%s)
elapsed=$((end - start))

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ci-prepush PASSED in ${elapsed}s"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
