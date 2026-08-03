/**
 * SOLID-CONSUMER-SURFACE — Quick 260803-ibt T4 (Dan-approved gate, Solid parallel).
 *
 * The Solid parallel of `tests/react-typecheck/react-consumer-surface.test.ts`.
 * Important distinction from the SOLID-TSC gate above in this same workspace:
 * SOLID-TSC compiles the INLINE `.tsx` body via `compile(source, {target:
 * 'solid'})`, whose slot-ctx fields are emitted by
 * `packages/targets/solid/src/emit/emitSlotDecl.ts` — a SEPARATE renderer
 * that types every slot-ctx field `any` unconditionally (never `unknown`,
 * never resolved against `ir.props`). CR-02 does not touch that path, so
 * SOLID-TSC was never capable of catching (or re-catching) this regression.
 *
 * The Solid surface CR-02 actually affects is the PUBLIC `.d.rozie.ts`
 * sidecar, emitted by `packages/targets/solid/src/emit/emitTypes.ts`
 * (`emitSolidTypes`), which — like React's `emitTypes.ts` — consumes the
 * core-shared `renderPropsInterface`/`inferParamType`. This fixture
 * therefore does NOT reuse the SOLID-TSC harness's `compile()` call; it
 * calls `emitSolidTypes` directly (mirroring the React consumer-surface
 * test's use of `emitReactTypes`), because the working SOLID-TSC harness
 * genuinely cannot express this shape without being pointed at a different
 * emitter — restructuring it was out of scope for a release-prep wave, so
 * this is an ADDITIVE new fixture, not a modification of the existing one.
 *
 * RED EVIDENCE (Quick 260803-ibt SUMMARY.md has the full transcript): with
 * the pre-T3 `.d.ts` shape (`toggle: unknown`), the equivalent Consumer.tsx
 * against this workspace's tsconfig.json produced:
 *
 *   Consumer.tsx(6,46): error TS2322: Type 'unknown' is not assignable to
 *   type 'EventHandlerUnion<HTMLButtonElement, MouseEvent,
 *   EventHandler<HTMLButtonElement, MouseEvent>> | undefined'.
 *
 * confirmed via a standalone tsc invocation against a hand-written pre-fix
 * `.d.ts` BEFORE this test was wired in — proving the gate is real before
 * asserting it passes on the fix.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitSolidTypes } from '@rozie/target-solid';

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

describe('SOLID-CONSUMER-SURFACE — strict typed consumer of the public .d.rozie.ts slot-callable is tsc clean (Quick 260803-ibt T4)', () => {
  it('Consumer.tsx using the Dropdown toggle slot param as a callable typechecks clean under strict tsconfig', () => {
    const src = readFileSync(resolve(ROOT, 'examples/Dropdown.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'Dropdown.rozie' });
    if (!ast) throw new Error('parse() returned null for examples/Dropdown.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for examples/Dropdown.rozie');
    const dts = emitSolidTypes(ir);

    // Guard the fixture premise — see the react-consumer-surface sibling test.
    expect(dts).toMatch(/toggle: \(\.\.\.args: any\[\]\) => any/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-consumer-'));
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
