#!/usr/bin/env node
// scripts/probe-dynamic-rebuild.mjs — Phase 22 Plan 07 (SPEC AC-3 dynamic round-trip).
//
// SPEC Acceptance Criterion 3: editing a `<props>` type in a consumed `.rozie`
// and rebuilding (the unplugin `buildStart` hook regenerates the sidecar — NO
// manual `rozie types` / codegen command) must propagate to a CONSUMER-SIDE type
// error; restoring the `.rozie` and rebuilding must CLEAR it.
//
// This script gate-tests that round-trip end-to-end against the real react-vite
// demo:
//   1. snapshot examples/consumers/react-vite/src/Counter.rozie
//   2. EDIT a <props> type so a current consumer usage becomes invalid
//      (Counter `step` Number → String; the REQ-9 probe uses `step: 2`)
//   3. `pnpm --filter react-vite-demo run build`  (buildStart regenerates the
//      Counter.d.rozie.ts sidecar from the edited source — no manual codegen)
//   4. `pnpm --filter react-vite-demo run typecheck`  → ASSERT non-zero (the
//      consumer-side prop-type error appeared)
//   5. RESTORE Counter.rozie, rebuild, typecheck  → ASSERT zero (error cleared)
//
// Exits 0 only if the error appeared-then-cleared. The Plan 07 Task 3 human
// checkpoint confirms the same thing on top of this automated gate.
//
// Structure mirrors scripts/check-runtime-isolation.mjs / check-sidecar-staleness.mjs.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROZIE = join(ROOT, 'examples', 'consumers', 'react-vite', 'src', 'Counter.rozie');

function run(cmd) {
  // Returns { code, out }. Never throws — we assert on the exit code ourselves.
  try {
    const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function build() {
  return run('pnpm --filter react-vite-demo run build');
}
function typecheck() {
  return run('pnpm --filter react-vite-demo run typecheck');
}

const original = readFileSync(ROZIE, 'utf8');

// The narrowing edit: Counter's `step` is `type: Number`; the REQ-9 probe
// (src/typed-import.probe.tsx) uses `step: 2`. Flipping `step` to `type: String`
// makes the sidecar type `step?: string`, so `step: 2` becomes a consumer-side
// TS error — a genuine <props>-type change propagating through the regenerated
// sidecar.
const STEP_NUMBER = 'step:  { type: Number, default: 1 },';
const STEP_STRING = 'step:  { type: String, default: 1 },';

if (!original.includes(STEP_NUMBER)) {
  console.error(
    `✗ probe setup: could not find the expected <props> line in Counter.rozie:\n    ${STEP_NUMBER}\n  The source shape changed — update probe-dynamic-rebuild.mjs to pick another narrowable prop.`,
  );
  process.exit(1);
}

let failed = false;
function restore() {
  writeFileSync(ROZIE, original, 'utf8');
}

// Ensure restoration even on an unexpected throw.
process.on('exit', () => {
  if (readFileSync(ROZIE, 'utf8') !== original) restore();
});

try {
  console.log('▶ [1/5] baseline: typecheck should be GREEN before any edit');
  {
    const b = build();
    if (b.code !== 0) {
      console.error('✗ baseline build failed (unrelated to the probe edit):');
      console.error(b.out.slice(-2000));
      process.exit(1);
    }
    const t = typecheck();
    if (t.code !== 0) {
      console.error('✗ baseline typecheck is already RED — fix the demo before running this probe:');
      console.error(t.out.slice(-2000));
      process.exit(1);
    }
    console.log('  ✓ baseline typecheck green');
  }

  console.log('▶ [2/5] editing Counter.rozie <props>: step Number → String');
  writeFileSync(ROZIE, original.replace(STEP_NUMBER, STEP_STRING), 'utf8');

  console.log('▶ [3/5] rebuild (buildStart regenerates Counter.d.rozie.ts — no manual codegen)');
  {
    const b = build();
    if (b.code !== 0) {
      console.error('✗ rebuild after the edit failed unexpectedly:');
      console.error(b.out.slice(-2000));
      failed = true;
    }
  }

  console.log('▶ [4/5] typecheck should now be RED (consumer-side prop-type error appeared)');
  if (!failed) {
    const t = typecheck();
    if (t.code === 0) {
      console.error(
        '✗ AC-3 FAILED: after narrowing `step` to String and rebuilding, the consumer typecheck is STILL GREEN — the regenerated sidecar did NOT propagate the prop-type change (or buildStart did not regenerate it).',
      );
      failed = true;
    } else {
      console.log('  ✓ typecheck went RED as expected (the prop-type error propagated)');
    }
  }

  console.log('▶ [5/5] restore Counter.rozie, rebuild, typecheck should be GREEN again');
  restore();
  if (!failed) {
    const b = build();
    if (b.code !== 0) {
      console.error('✗ rebuild after restore failed unexpectedly:');
      console.error(b.out.slice(-2000));
      failed = true;
    }
  }
  if (!failed) {
    const t = typecheck();
    if (t.code !== 0) {
      console.error(
        '✗ AC-3 FAILED: after restoring Counter.rozie and rebuilding, the consumer typecheck is STILL RED — the error did not clear:',
      );
      console.error(t.out.slice(-2000));
      failed = true;
    } else {
      console.log('  ✓ typecheck green again (error cleared after restore)');
    }
  }
} finally {
  restore();
}

if (failed) {
  console.error('\n✗ dynamic round-trip probe FAILED (SPEC AC-3 not satisfied).');
  process.exit(1);
}
console.log(
  '\n✓ dynamic round-trip probe passed — a <props> type edit + rebuild (buildStart regen, no manual codegen) propagated a consumer-side type error, and restore cleared it (SPEC AC-3).',
);
process.exit(0);
