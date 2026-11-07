/**
 * `.once` on a COMPONENT event. A component event is a callback prop, so there is no
 * `{ once: true }` listener option. The prop becomes a named function expression that keys its
 * fired state by itself:
 *
 *   onPing={function __rozieOnce(...args: any[]) { return rozieOnceCall(__rozieOnce, 0, () => handler, args); }}
 *
 * Solid's compiler keeps a function-literal prop static, so the function is made once per rendered
 * child (once per row inside r-for). A call-expression prop (`rozieOnce(...)`) becomes a getter
 * that runs on every read, and `/* @once *\/` does not stop that inside a loop callback; the
 * Solid-compiler tests below guard exactly that.
 */
import { transformSync } from '@babel/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import solidPreset from 'babel-preset-solid';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

const SRC = (template: string) => `<rozie name="Test">
<components>{ Child: './Child.rozie' }</components>
<data>{ rows: [{ id: 1, cells: [1, 2] }] }</data>
<script>
const onKey = (e) => {}
</script>
<template>
<div>
${template}
</div>
</template>
</rozie>`;

function emit(template: string) {
  const src = SRC(template);
  const { ast } = parse(src, { filename: 'Test.rozie' });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  const r = emitSolid(ir!, { filename: 'Test.rozie', source: src, modifierRegistry: registry });
  return { code: r.code, errors: r.diagnostics.filter((d) => d.severity === 'error') };
}

/** The emitted component run through Solid's own JSX compiler (the floor version, 1.8). */
function solidCompile(code: string): string {
  return transformSync(code, {
    filename: 'Test.tsx',
    babelrc: false,
    configFile: false,
    presets: [[solidPreset, {}]],
    plugins: [['@babel/plugin-syntax-typescript', { isTSX: true }]],
  })!.code!;
}

const SINGLE =
  'onPing={function __rozieOnce(...args: any[]) { return rozieOnceCall(__rozieOnce, 0, () => onKey, args); }}';

describe('Solid: .once on a component event', () => {
  it('binds a self-keyed function that calls rozieOnceCall', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toContain(SINGLE);
    expect(code).toMatch(/import \{[^}]*\brozieOnceCall\b[^}]*\} from '@rozie\/runtime-solid'/);
  });

  it('inside r-for the function sits in the row callback (one per row)', () => {
    const { code, errors } = emit('<div r-for="row in $data.rows" :key="row.id"><Child @ping.once="onKey(row)" /></div>');
    expect(errors).toEqual([]);
    expect(code).toMatch(/\(row\) => <div[^]*onPing=\{function __rozieOnce\(/);
  });

  it('merged with a plain listener for the same event: one self-keyed dispatcher', () => {
    const { code, errors } = emit('<Child @ping="onKey" @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{function __rozieOnce\(\$event[^)]*\) \{ onKey\(\$event\); rozieOnceCall\(__rozieOnce, 0, \(\) => onKey, \[\$event\]\); \}\}/);
  });

  it("Solid's compiler keeps the prop static (not a getter) in a loop and when merged", () => {
    const { code } = emit(
      '<Child r-for="row in $data.rows" :key="row.id" @ping.once="onKey(row)" /><Child r-for="row in $data.rows" :key="row.id" @ping="onKey" @ping.once="onKey" />',
    );
    const out = solidCompile(code);
    expect(out, out).not.toMatch(/get onPing\(\)/);
    expect(out.match(/onPing: function __rozieOnce\(/g), out).toHaveLength(2);
  });

  for (const mod of ['capture', 'passive']) {
    it(`.${mod} on a component event stays an error`, () => {
      expect(emit(`<Child @ping.${mod}="onKey" />`).errors).toHaveLength(1);
    });
  }
});
