/**
 * `.once` on a COMPONENT event. A component event is an Angular output, so there is no
 * `{ once: true }` listener option: the tag gets the `RozieOnce` directive with a template ref and
 * the binding is gated by it, `(ping)="__rozieOnceN.take(0) && handler"`. Angular makes one
 * directive per rendered element, so each child (each @for row) fires once.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

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
  const r = emitAngular(ir!, { filename: 'Test.rozie', source: src, modifierRegistry: registry });
  return { code: r.code, errors: r.diagnostics.filter((d) => d.severity === 'error') };
}

const childTag = (code: string) => code.match(/<rozie-child[^>]*>/)?.[0] ?? code;

describe('Angular: .once on a component event', () => {
  it('puts RozieOnce on the tag and gates the output binding', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" />');
    expect(errors).toEqual([]);
    const tag = childTag(code);
    const ref = tag.match(/rozieOnce #(__rozieOnce\w*)="rozieOnce"/)?.[1];
    expect(ref, tag).toBeDefined();
    expect(tag).toContain(`(ping)="${ref}.take(0) && onKey($event)"`);
    expect(code).toMatch(/import \{[^}]*\bRozieOnce\b[^}]*\} from '@rozie\/runtime-angular'/);
    expect(code).toMatch(/imports: \[[^\]]*\bRozieOnce\b/);
  });

  it('a statement handler and a loop variable stay in template scope', () => {
    const { code, errors } = emit('<div r-for="row in $data.rows" :key="row.id"><Child @ping.once="onKey(row)" /></div>');
    expect(errors).toEqual([]);
    expect(childTag(code)).toMatch(/\(ping\)="__rozieOnce\w*\.take\(0\) && \(onKey\(row\)\)"/);
  });

  it('two once listeners on one tag share one directive, each with its own id', () => {
    const { code, errors } = emit('<Child @ping.once="onKey" @pong.once="onKey" />');
    expect(errors).toEqual([]);
    const tag = childTag(code);
    expect(tag.match(/rozieOnce #/g)).toHaveLength(1);
    expect(tag).toMatch(/\(ping\)="(__rozieOnce\w*)\.take\(0\) && onKey\(\$event\)"/);
    expect(tag).toMatch(/\(pong\)="__rozieOnce\w*\.take\(1\) && onKey\(\$event\)"/);
  });

  it('merged with a plain listener for the same event, the merged method gets the ref passed in', () => {
    const { code, errors } = emit('<Child @ping="onKey" @ping.once="onKey" />');
    expect(errors).toEqual([]);
    const tag = childTag(code);
    const m = tag.match(/\(ping\)="(_merged_\w+)\(\$event, (__rozieOnce\d+)\)"/);
    expect(m, tag).not.toBeNull();
    expect(code).toContain(`protected ${m![1]} = ($event: any, ${m![2]}: RozieOnce) => {`);
    expect(code).toContain(`${m![2]}.take(0) && this.onKey($event);`);
  });

  it('template-called wrappers are protected, not private (strict template type-checking)', () => {
    const { code } = emit('<input @keydown.enter="onKey" @input.debounce(50)="onKey" />');
    expect(code).toMatch(/protected _guardedOnKey\w* = /);
    expect(code).toMatch(/protected debouncedOnKey\w* = /);
    expect(code).not.toMatch(/private (_guarded|debounced|throttled|_merged_)/);
  });

  for (const mod of ['capture', 'passive']) {
    it(`.${mod} on a component event stays an error`, () => {
      expect(emit(`<Child @ping.${mod}="onKey" />`).errors).toHaveLength(1);
    });
  }
});
