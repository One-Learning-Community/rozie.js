/**
 * SOLID-ATTRS-SIDECAR — typed public surface phase 3 (spec §5).
 *
 * The Solid `.d.rozie.ts` (`emitSolidTypes`) accepts a single-root component's
 * pass-through HTML attributes with no cast; own props win on collision;
 * `children` stays rejected (no default slot). (`ref` can't be a negative:
 * Solid's `JSX.IntrinsicAttributes` accepts `ref?: unknown` on EVERY component.)
 * `@ts-expect-error` lines are the negatives (TS2578 if one stops erroring).
 *
 * Red-first anchor: before phase 3 the sidecar was
 * `export interface AttrsButtonProps { label?; title?; onPress? }`, so
 * `class` / `style` / `id` / `disabled` failed TS2322.
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

const CONSUMER_TSX = `import AttrsButton from './AttrsButton';

export const ok = (
  <AttrsButton
    label="x"
    title={3}
    class="c"
    style={{ color: 'red' }}
    id="i"
    aria-label="l"
    data-test="t"
    disabled
    type="button"
    onClick={(e) => e.currentTarget.blur()}
    onPress={() => {}}
  />
);
// @ts-expect-error — not a <button> attribute
export const badHref = <AttrsButton href="/x" />;
// @ts-expect-error — own \`title: number\` wins over HTML \`title: string\`
export const badTitle = <AttrsButton title="x" />;
// @ts-expect-error — no default slot: children stay rejected
export const badChildren = <AttrsButton>kids</AttrsButton>;
`;

describe('SOLID-ATTRS-SIDECAR — .d.rozie.ts consumer accepts pass-through HTML attrs (typed-surface P3)', () => {
  it('Consumer.tsx passing root <button> attrs typechecks clean; negatives stay errors', () => {
    const src = readFileSync(resolve(ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'), 'utf8');
    const { ast } = parse(src, { filename: 'AttrsButton.rozie' });
    if (!ast) throw new Error('parse() returned null for AttrsButton.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for AttrsButton.rozie');
    const dts = emitSolidTypes(ir);

    // Fixture premise guard — fail loud rather than green-by-accident.
    expect(dts).toMatch(/export interface AttrsButtonProps/);

    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-solid-attrs-sidecar-'));
    try {
      writeFileSync(join(tmpDir, 'AttrsButton.d.ts'), dts, 'utf8');
      writeFileSync(join(tmpDir, 'Consumer.tsx'), CONSUMER_TSX, 'utf8');
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error(
          'tsc --noEmit exited non-zero for the Solid attrs sidecar consumer:\n' + stdout + '\n' + stderr,
        );
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
