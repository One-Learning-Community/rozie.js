/**
 * `.once` on a COMPONENT event. A component event is a callback prop, so there is no
 * `{ once: true }` listener option: the prop becomes `/* @once *\/ rozieOnce(() => handler)`. The
 * `@once` marker keeps Solid's compiler from turning the prop into a getter, so the wrapper is made
 * once per rendered child (once per row inside r-for) and keeps its state.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
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

describe('Solid: .once on a component event', () => {
  it('wraps the callback prop in a static rozieOnce thunk', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{\/\* @once \*\/ rozieOnce\(\(\) => onKey\)\}/);
    expect(code).toMatch(/import \{[^}]*\brozieOnce\b[^}]*\} from '@rozie\/runtime-solid'/);
  });

  it('inside r-for the wrapper sits in the row callback (one per row)', () => {
    const { code, errors } = emit('<div r-for="row in $data.rows" :key="row.id"><Child @ping.once="onKey(row)" /></div>');
    expect(errors).toEqual([]);
    expect(code).toMatch(/\(row\) => <div[^]*onPing=\{\/\* @once \*\/ rozieOnce\(\(\) => /);
  });

  it('merged with a plain listener for the same event, the wrapper is made outside the merged arrow', () => {
    const { code, errors } = emit('<Child @ping="onKey" @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toContain('onPing={/* @once */ ((__rozieOnce0: (...a: any[]) => unknown) => (');
    expect(code).toContain('__rozieOnce0($event); })(rozieOnce(() => onKey))}');
  });

  for (const mod of ['capture', 'passive']) {
    it(`.${mod} on a component event stays an error`, () => {
      expect(emit(`<Child @ping.${mod}="onKey" />`).errors).toHaveLength(1);
    });
  }
});
