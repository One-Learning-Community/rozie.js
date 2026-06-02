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

# Phase 22 / REQ-6 (T-22-07-01): a generated `<Name>.d.rozie.ts` sidecar that
# lags its `.rozie` source is a type lie — tsc trusts a declaration that no
# longer matches the component. This gate re-hashes every demo `.rozie` source
# and fails if any sidecar header hash is stale. The typecheck above already ran
# `turbo run typecheck` (which `^build`s the upstream packages); the demo
# sidecars are regenerated on each `vite build`. `--self-test` first proves the
# gate can actually catch a tampered sidecar (negative path, automated).
echo ""
echo "▶ node scripts/check-sidecar-staleness.mjs --self-test (negative-path proof)"
echo ""
node scripts/check-sidecar-staleness.mjs --self-test

echo ""
echo "▶ node scripts/check-sidecar-staleness.mjs (sidecar staleness gate — REQ-6)"
echo ""
node scripts/check-sidecar-staleness.mjs

echo ""
echo "▶ turbo run test --force --continue --concurrency=4"
echo ""
# --concurrency=4 caps parallelism so the heavier suites
# (target-react/vue/svelte/angular + dist-parity, all running vitest with
# its own per-test process budget) don't all run at once. Without a cap, turbo
# runs every task in parallel and the heavy suites race vitest's per-test
# timeout under CPU starvation — classic turbo-parallel-CPU-starvation flake
# (memory turbo_parallel_test_flake).
#
# The cap REDUCES but does not eliminate the flake class on its own: individual
# heavy tests still flake if their own per-test deadline is too tight for a
# loaded box. The durable fix is per-test, not concurrency-wide — hoist
# in-it() dynamic imports to static top-level imports (commits dcfb717,
# 86ef214, and tests/timing/SearchInput.debounce.parity.test.ts) and raise
# load-tolerant deadlines on genuinely heavy single tests (commit 112352c5
# cli-smoke; exposeValidator ROZ121 SWEEP). Treat any remaining cross-package
# failure under this gate as a not-yet-hardened heavy test, not a c=4 problem.
turbo run test --force --continue --concurrency=4

end=$(date +%s)
elapsed=$((end - start))

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ci-prepush PASSED in ${elapsed}s"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
