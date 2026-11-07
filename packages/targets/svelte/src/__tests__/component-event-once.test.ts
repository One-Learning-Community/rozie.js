/**
 * `.once` on a COMPONENT event. A component event is a callback prop, so there is no
 * `{ once: true }` listener option: the prop becomes `rozieOnce(() => handler)`. Svelte memoizes a
 * call-expression prop per component instance (`$.derived`), and the thunk means nothing reactive
 * is read while the wrapper is made, so it is made once per rendered child (once per each-row).
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../emitSvelte.js';

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
  const r = emitSvelte(ir!, { filename: 'Test.rozie', source: src, modifierRegistry: registry });
  return { code: r.code, errors: r.diagnostics.filter((d) => d.severity === 'error') };
}

describe('Svelte: .once on a component event', () => {
  it('wraps the callback prop in a rozieOnce thunk', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onping=\{rozieOnce\(\(\) => onKey\)\}/);
    expect(code).toMatch(/import \{[^}]*\brozieOnce\b[^}]*\} from '@rozie\/runtime-svelte'/);
  });

  it('works inside an each block', () => {
    const { code, errors } = emit('<div r-for="row in $data.rows" :key="row.id"><Child @ping.once="onKey(row)" /></div>');
    expect(errors).toEqual([]);
    expect(code).toMatch(/\{#each[^]*onping=\{rozieOnce\(\(\) => /);
  });

  it('merged with a plain listener for the same event, the wrapper is made outside the merged arrow', () => {
    const { code, errors } = emit('<Child @ping="onKey" @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toContain('onping={((__rozieOnce0: (...a: any[]) => unknown) => ($event) => {');
    expect(code).toContain('__rozieOnce0($event); })(rozieOnce(() => onKey))}');
  });

  for (const mod of ['capture', 'passive']) {
    it(`.${mod} on a component event stays an error`, () => {
      expect(emit(`<Child @ping.${mod}="onKey" />`).errors).toHaveLength(1);
    });
  }
});
