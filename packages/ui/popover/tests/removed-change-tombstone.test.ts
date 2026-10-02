/**
 * The removed `change` event (0.3.0, release-0.8.0 audit B6) is kept as an
 * `<emits>` tombstone, so a typed React/Solid/Svelte consumer still passing
 * `onChange` / `onchange` is rejected with a @deprecated note pointing at the
 * `open` model's change event — instead of the key falling into the native
 * `<div>` attrs passthrough, where it type-checked as the DOM `change`
 * handler and never fired (oinbox 0.8.0 feedback F8).
 *
 * Asserted on both the fresh compile() output and the committed leaves (so a
 * stale codegen fails too). The strict-TS consumer negative
 * (`<Popover onChange={() => {}} />` fails to type-check) lives in
 * tests/strict-conformance/popover-typed-surface.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const source = readFileSync(resolve(ROOT, 'src/Popover.rozie'), 'utf8');

const tombstone = (key: string) =>
  new RegExp(
    String.raw`  /\*\*\n   \* @deprecated Removed in 0\.3\.0 — use the \x60open\x60 model change event[^\n]*\n   \*/\n  ${key}\?: never;`,
  );

const CASES = [
  { target: 'react', key: 'onChange', leaves: ['packages/react/src/Popover.tsx', 'packages/react/src/Popover.d.ts'] },
  { target: 'solid', key: 'onChange', leaves: ['packages/solid/src/Popover.tsx'] },
  { target: 'svelte', key: 'onchange', leaves: ['packages/svelte/src/Popover.svelte'] },
] as const;

function omitList(code: string): string {
  const m = /extends Omit<[^,]+, ([^>]*)>/.exec(code);
  if (!m) throw new Error('no Omit clause');
  return m[1]!;
}

describe('Popover `change` tombstone', () => {
  it('lowers as a tombstone: no live event, no ROZ152, no errors', () => {
    const { ast } = parse(source, { filename: 'Popover.rozie' });
    const { ir, diagnostics = [] } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.filter((d) => d.code === 'ROZ152')).toEqual([]);
    expect(ir.emits).toEqual([]);
    expect(ir.removedMembers?.map((r) => [r.kind, r.name])).toEqual([['event', 'change']]);
  });

  for (const c of CASES) {
    it(`${c.target}: compiled props interface types \`${c.key}\` never (@deprecated) and Omits it from the native base`, () => {
      const r = compile(source, { target: c.target, filename: 'Popover.rozie', sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.code).toMatch(tombstone(c.key));
      expect(omitList(r.code)).toContain(`'${c.key}'`);
    });

    for (const leaf of c.leaves) {
      it(`${c.target}: committed leaf ${leaf} carries the tombstone`, () => {
        const code = readFileSync(resolve(ROOT, leaf), 'utf8');
        expect(code).toMatch(tombstone(c.key));
        expect(omitList(code)).toContain(`'${c.key}'`);
      });
    }
  }
});
