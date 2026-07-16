/**
 * react-show-emit.test.ts — STATIC emit gate for the React `show()` lowering
 * (T6). No DOM mount: the toast package has only a Vue mount harness, so the
 * React-only bulk-loss + duplicate-id bugs are proven at the emitted-source
 * level (the fallback the finding authorizes) — compile() the .rozie to React
 * and assert on show()'s emitted body.
 *
 * Two React-specific bugs this locks down:
 *   (a) BULK LOSS — show() wrote `const next = $data.toasts.concat([toast])`
 *       into a local then `$data.toasts = <ternary of next>`. The React
 *       emitter only lowers `$data.X = expr` to the concurrent-safe functional
 *       updater `setX(prev => …)` when the RHS reads `$data.X` DIRECTLY; the
 *       via-a-local form lowered to a stale-closure `setToasts(<value>)`, so
 *       two show() calls in one tick lost the first toast. The fix reshapes
 *       the write into ONE self-referential expression → the emit MUST show
 *       `setToasts(prev => …)`.
 *   (b) DUPLICATE IDS — the id came from the reactive $data.seq counter, which
 *       is STALE within a tick on React (setState is async), so same-tick
 *       double-show produced identical ids. The fix adds a synchronous
 *       within-tick counter (`seqLocal`) combined via Math.max with the
 *       persistent $data.seq → the emit MUST reference `seqLocal`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Toaster.rozie');
const FILENAME = 'Toaster.rozie';
const source = readFileSync(SRC, 'utf8');

/** Slice out just the emitted `function show(...) { … }` body region. */
function showBody(code: string): string {
  const start = code.indexOf('function show(');
  expect(start).toBeGreaterThanOrEqual(0);
  // show() is immediately followed by the exit-lifecycle section, whose first
  // emitted token is the EXIT_FAILSAFE_MS const — a stable right boundary.
  const end = code.indexOf('EXIT_FAILSAFE_MS', start);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe('React show() emit — functional array write + same-tick-safe id (T6)', () => {
  const { code, diagnostics } = compile(source, { target: 'react', filename: FILENAME });

  it('compiles React with zero error diagnostics', () => {
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('(a) show() writes toasts via the functional updater setToasts(prev => …), not a stale value', () => {
    const body = showBody(code);
    expect(body).toContain('setToasts(prev =>');
    // The old stale-local shape must be gone.
    expect(body).not.toMatch(/const next = toasts\.concat/);
  });

  it('(b) show() derives the id from a within-tick-safe counter (seqLocal), not solely the stale seq state', () => {
    const body = showBody(code);
    expect(body).toContain('seqLocal');
  });
});
