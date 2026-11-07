/**
 * `.once` on a COMPONENT event. A component event is a callback prop, so there is no
 * `{ once: true }` listener option: the emitter hoists one `useRozieOnce()` per listener and wraps
 * the prop with the enclosing r-for keys, so each rendered child (each row) fires once.
 * `.capture` / `.passive` stay errors: a callback prop has no capture phase or passive mode.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

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
  const r = emitReact(ir!, { filename: 'Test.rozie', source: src, modifierRegistry: registry });
  return { code: r.code, errors: r.diagnostics.filter((d) => d.severity === 'error') };
}

describe('React: .once on a component event', () => {
  it('wraps the callback prop with a hoisted useRozieOnce()', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" />');
    expect(errors).toEqual([]);
    const name = code.match(/const (_rozieOnce\w*) = useRozieOnce\(\);/)?.[1];
    expect(name, code).toBeDefined();
    expect(code).toContain(`onPing={${name}([], onKey)}`);
    expect(code).toMatch(/import \{[^}]*\buseRozieOnce\b[^}]*\} from '@rozie\/runtime-react'/);
  });

  it('inside r-for the wrapper is keyed by the row key', () => {
    const { code, errors } = emit('<div r-for="row in $data.rows" :key="row.id"><Child @ping.once="onKey" /></div>');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{_rozieOnce\w*\(\[row\.id\], onKey\)\}/);
  });

  it('nested loops key by every enclosing loop', () => {
    const { code, errors } = emit(
      '<div r-for="row in $data.rows" :key="row.id"><span r-for="cell in row.cells" :key="cell"><Child @ping.once="onKey(cell)" /></span></div>',
    );
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{_rozieOnce\w*\(\[row\.id, cell\], /);
  });

  it('a loop without :key keys by the item itself', () => {
    const { code } = emit('<div r-for="row in $data.rows"><Child @ping.once="onKey" /></div>');
    expect(code).toMatch(/onPing=\{_rozieOnce\w*\(\[row\], onKey\)\}/);
  });

  it('the once guard wraps guards and debounce too', () => {
    const { code, errors } = emit('<Child @ping.once.debounce(50)="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{_rozieOnce\w*\(\[\], _rozieDebounced\w*\)\}/);
  });

  it('merged with a plain listener for the same event, the hook keeps the state', () => {
    const { code, errors } = emit('<Child @ping="onKey" @ping.once="onKey" />');
    expect(errors).toEqual([]);
    expect(code).toMatch(/onPing=\{\(\$event\) => \{ onKey\(\$event\); \(_rozieOnce\w*\(\[\], onKey\)\)\(\$event\); \}\}/);
  });

  for (const mod of ['capture', 'passive']) {
    it(`.${mod} on a component event stays an error`, () => {
      expect(emit(`<Child @ping.${mod}="onKey" />`).errors).toHaveLength(1);
    });
  }
});
