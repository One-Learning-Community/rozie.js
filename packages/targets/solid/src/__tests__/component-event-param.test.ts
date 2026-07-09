// Regression: a synthesized `$event` param on a COMPONENT-tag event handler must
// NOT be annotated with a DOM event type.
//
// `cfac40ff` / `ea10f74a` typed synthesized `$event` params with the host
// element's DOM interface to satisfy `noImplicitAny` on Solid's UNION-typed JSX
// event slots (`EventHandlerUnion<T,E>` gives no contextual param type). That is
// correct for NATIVE elements — but the annotation was applied unconditionally,
// so a COMPONENT-tag handler (`<Child @change="...">`) got a bare `($event: Event)`.
// A Rozie component's emit-handler prop is typed `(...args: unknown[]) => void`,
// which DOES supply a contextual param type (so there is no TS7006 to silence),
// and `($event: Event) => void` is NOT assignable to `(...args: unknown[]) => void`
// under `strictFunctionTypes` (param contravariance) → TS2322. The fix: leave the
// component-tag handler param unannotated and let TS infer it from the prop.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'CompEvt.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  return emitSolid(lowered.ir, { filename: 'CompEvt.rozie', source: src }).code;
}

const SRC = `<rozie name="CompEvt">
<components>{ Child: './Child.rozie' }</components>
<script lang="ts">
function onChildChange($event) { void $event; }
</script>
<template>
  <div>
    <button @click="onChildChange($event)">native</button>
    <Child @change="onChildChange($event)" />
  </div>
</template>
</rozie>`;

describe('Solid synthesized $event param typing', () => {
  const code = compile(SRC);

  it('a NATIVE element handler keeps the specific DOM-event annotation', () => {
    expect(code).toMatch(/onClick=\{\(\$event: MouseEvent & \{ currentTarget:/);
  });

  it('a COMPONENT-tag handler emits an UNANNOTATED $event (assignable to (...args: unknown[]) => void)', () => {
    expect(code).toContain('onChange={($event) =>');
    expect(code).not.toContain('onChange={($event: Event)');
  });
});
