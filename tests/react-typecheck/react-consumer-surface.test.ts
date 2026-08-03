/**
 * REACT-CONSUMER-SURFACE — Quick 260803-ibt T4 (Dan-approved gate).
 *
 * This is the gate whose ABSENCE let CR-02 ship: every existing React gate
 * (REACT-TSC above, the target-react `emitTypes.test.ts` unit suite) checks
 * either the emitted BODY `.tsx` or the `.d.ts` STRING SHAPE — none of them
 * compile a genuinely-typed CONSUMER against the public `.d.ts` the way a
 * real strict-TS app would. CR-02 downgraded `renderTrigger`'s `toggle` slot
 * param from a real (best-effort) callable to `unknown` across six published
 * targets; no gate caught it because none modeled "a consumer PASSES the
 * slot param to a typed callback position".
 *
 * Modeled on the existing precedent `tests/vue-typecheck/vue-consumer-surface.test.ts`
 * (a consumer-surface gate, distinct from the emitted-body gates): emit
 * `examples/Dropdown.rozie`'s public React `.d.ts` (via `emitReactTypes`,
 * the SAME renderer path CR-02 fixed — `renderPropsInterface`/
 * `inferParamType` in `@rozie/core`) into a tmp dir, alongside a STRICT-TS
 * consumer file that uses the `toggle` slot param in a genuinely-typed
 * position: `renderTrigger={({ toggle }) => <button onClick={toggle}>…</button>}`.
 *
 * Under `strict`, `toggle: unknown` fails this with TS2322 (`unknown` is not
 * assignable to `MouseEventHandler<HTMLButtonElement> | undefined`);
 * `toggle: (...args: any[]) => any` (the CR-02 fix) passes. Deliberately does
 * NOT import a published `@rozie-ui/*` leaf package — the fixture is
 * self-contained (compiles `examples/Dropdown.rozie` fresh via `@rozie/core`
 * + `@rozie/target-react`), so it has no cross-package build-order
 * dependency and can run before any leaf is built.
 *
 * RED EVIDENCE (Quick 260803-ibt SUMMARY.md has the full transcript): with
 * the pre-T3 `.d.ts` shape (`toggle: unknown`), this exact Consumer.tsx
 * against this exact tsconfig.json produced:
 *
 *   Consumer.tsx(6,46): error TS2322: Type 'unknown' is not assignable to
 *   type 'MouseEventHandler<HTMLButtonElement> | undefined'.
 *
 * confirmed via a standalone tsc invocation against a hand-written pre-fix
 * `.d.ts` BEFORE this test was wired in — proving the gate is real (it fails
 * on the shape CR-02 introduced) before asserting it passes on the fix.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitReactTypes } from '@rozie/target-react';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const CONSUMER_TSX = `import Dropdown from './Dropdown';

export function App() {
  return (
    <Dropdown
      renderTrigger={({ toggle }) => <button onClick={toggle}>Toggle</button>}
    />
  );
}
`;

describe('REACT-CONSUMER-SURFACE — strict typed consumer of the public .d.ts slot-callable is tsc clean (Quick 260803-ibt T4)', () => {
  it('Consumer.tsx using the Dropdown toggle slot param as a callable typechecks clean under strict tsconfig', () => {
    const src = readFileSync(resolve(ROOT, 'examples/Dropdown.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'Dropdown.rozie' });
    if (!ast) throw new Error('parse() returned null for examples/Dropdown.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for examples/Dropdown.rozie');
    const dts = emitReactTypes(ir);

    // Guard the fixture premise: if Dropdown.rozie's toggle slot param ever
    // stops resolving callable, this gate silently stops testing anything —
    // fail loud instead of green-by-accident.
    expect(dts).toMatch(/toggle: \(\.\.\.args: any\[\]\) => any/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-react-consumer-'));
    try {
      writeFileSync(join(tmpDir, 'Dropdown.d.ts'), dts, 'utf8');
      writeFileSync(join(tmpDir, 'Consumer.tsx'), CONSUMER_TSX, 'utf8');
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error(
          'tsc --noEmit exited non-zero for the strict consumer surface:\n' + stdout + '\n' + stderr,
        );
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    expect(true).toBe(true);
  });
});
