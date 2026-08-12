/**
 * emit-component-kebab-listener.test.ts — Angular target.
 *
 * Quick task 260811-r2m (D-01/D-02) — the Angular twin of the Lit multi-word
 * emit bug fixed in quick task 260811-nre. The Angular emitter lowered a
 * `.rozie` consumer's `@kebab-name` listener on a CHILD COMPONENT to the
 * literal Angular binding `(kebab-name)="…"`, but the child's Angular class
 * declares a camelCase `output()` field (`sanitizeEventName(emitName)`).
 * Angular event-binding names must match the output name EXACTLY, so every
 * multi-word listener across component composition was silently dead —
 * no build error, no diagnostic, just a never-fired DOM listener on the
 * host element.
 *
 * D-01: normalize the CONSUMER side (the authored listener name), not the
 * declaration side (`emitScript.ts`'s `output()` field id / alias) — mirrors
 * the PROP side's existing `resolveBindingName` → `kebabToCamel` gate in
 * `emitTemplateAttribute.ts`.
 *
 * D-02: route the consumer's authored name through `sanitizeEventName` —
 * the SAME function `emitScript.ts` uses to produce the child's `output()`
 * field id — so the two sides cannot drift apart silently. This is strictly
 * more correct than the prop side's `kebabToCamel` (handles `_`/whitespace
 * separators and separator-then-digit/capital, which the prop side's
 * `-([a-z])` regex misses).
 */

import type { EventModifierImpl, ModifierRegistry } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { parse } from '../../../../core/src/parse.js';
import { emitAngular } from '../emitAngular.js';
import { sanitizeEventName } from '../rewrite/sanitizeEventName.js';

function compileAngular(
  src: string,
  filename: string,
  registry: ModifierRegistry = createDefaultRegistry(),
): { code: string; diagnostics: Diagnostic[] } {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: registry });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  return emitAngular(ir, { filename, source: src, modifierRegistry: registry });
}

describe('emitAngular — component-tag kebab listener camelization (RED CORE)', () => {
  it('a hyphenated multi-word listener on a composed CHILD COMPONENT emits the camelCase Angular binding, not the hyphenated form', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — native/custom ELEMENT listeners stay hyphenated (anti-regression)', () => {
  it('a hyphenated listener on a plain HTML element keeps its hyphenated binding verbatim; camelCase is absent', () => {
    const src = `<rozie name="ParentComp">
<template>
  <div @range-complete="onNativeComplete">x</div>
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(range-complete)="onNativeComplete($event)"');
    expect(code).not.toMatch(/\(rangeComplete\)=/);
  });

  it('a hyphenated listener on a hyphenated CUSTOM ELEMENT (not a Rozie component) keeps its hyphenated binding verbatim; camelCase is absent', () => {
    const src = `<rozie name="ParentComp">
<template>
  <my-widget @range-complete="onNativeComplete2"></my-widget>
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(range-complete)="onNativeComplete2($event)"');
    expect(code).not.toMatch(/\(rangeComplete\)=/);
  });
});

describe('emitAngular — self-recursion (tagKind: self) camelizes too', () => {
  it('a hyphenated listener on a self-referencing recursive tag emits the camelCase binding', () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <TreeNode @range-complete="onComplete" />
  </li>
</template>
</rozie>`;
    const { code } = compileAngular(src, 'TreeNode.rozie');
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — no-op proofs (byte-identity on every non-multi-word / non-component shape)', () => {
  it('a single-word listener on a component tag is byte-identical (already a valid identifier — no rename)', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @close="onClose" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(close)="onClose($event)"');
  });

  it('an already-camelCase listener on a component tag is byte-identical (sanitizeEventName is a no-op)', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @rangeComplete="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
  });

  it('a native DOM listener with no separator is byte-identical', () => {
    const src = `<rozie name="ParentComp">
<template>
  <div @click="onClick">x</div>
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(click)="onClick($event)"');
  });
});

describe('emitAngular — separator parity (proves sanitizeEventName, not a hand-rolled hyphen regex)', () => {
  // A PURE underscore-separated name (`range_complete`) is ALREADY a valid JS
  // identifier — `_` is a legal identifier character, so `isValidIdentifier`
  // is true and `sanitizeEventName`'s documented fast-path invariant
  // ("an event name that is ALREADY a valid JS identifier is returned
  // byte-identically — no rename") applies. It stays `range_complete`
  // unchanged — it does NOT reach the same binding as the hyphenated form
  // (`rangeComplete`). This is correct, intended `sanitizeEventName`
  // behavior (see `regression-kebab-emits.test.ts`'s "already-valid
  // identifiers byte-identically" coverage) — asserted here explicitly
  // against the canonical function itself, never hard-coded, so this test
  // can never silently drift from the function it's proving.
  it('a pure underscore-separated listener on a component tag equals sanitizeEventName(rawName) — already valid, byte-identical, NOT camelized', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range_complete="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    const expected = sanitizeEventName('range_complete');
    expect(expected).toBe('range_complete');
    expect(code).toContain(`(${expected})="onComplete($event)"`);
  });

  // A MIXED hyphen+underscore name is NOT already a valid identifier (the
  // hyphen disqualifies it), so the general separator-handling path runs —
  // and it handles BOTH separator kinds uniformly. A hand-rolled
  // hyphen-only regex (like the PROP side's `kebabToCamel`, which only
  // matches `-([a-z])` and leaves `_` untouched) would produce
  // `rangeComplete_now` here; `sanitizeEventName` produces `rangeCompleteNow`.
  // This is the genuinely discriminating case that proves the event side
  // routes through `sanitizeEventName`, not a hyphen-only regex.
  it('a mixed hyphen+underscore listener on a component tag routes through sanitizeEventName (both separators camelized), not a hyphen-only regex', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete_now="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    const expected = sanitizeEventName('range-complete_now');
    expect(expected).toBe('rangeCompleteNow');
    expect(code).toContain(`(${expected})="onComplete($event)"`);
    expect(code).not.toContain('(rangeComplete_now)=');
    expect(code).not.toMatch(/\(range-complete_now\)=/);
  });
});

describe('emitAngular — round-trip property (never hard-code both sides)', () => {
  it.each([
    ['rangeComplete', 'range-complete'],
    ['regionCreated', 'region-created'],
    ['regionIn', 'region-in'],
    ['datesSet', 'dates-set'],
    ['eventMouseEnter', 'event-mouse-enter'],
    ['reInit', 're-init'],
  ])('lowering the hyphenated consumer form of %s (%s) yields the identical string sanitizeEventName produces for the authored emit name', (camelName, hyphenated) => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @${hyphenated}="onX" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    const expected = sanitizeEventName(camelName);
    expect(code).toContain(`(${expected})="onX($event)"`);
  });
});

describe('emitAngular — modifier paths (camelCase binding name, authored name reaches the descriptor context)', () => {
  it('a side-effect modifier (.stop) on a hyphenated component listener still emits the inline guard chain, under the camelCase binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.stop="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(rangeComplete)="$event.stopPropagation(); onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });

  it('an early-return modifier (.self) on a hyphenated component listener still hoists its guarded class-field wrapper, under the camelCase binding name', () => {
    // onComplete is declared as a top-level <script> binding (lifted to a
    // class field) so applyThisPrefixing's member set includes it — mirrors
    // the angular-stop-handler-in-loop precedent in loopGuardInline.test.ts.
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.self="onComplete" />
</template>
<script>
const onComplete = (payload) => { console.log(payload); };
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toMatch(/\(rangeComplete\)="_guarded\w*\(\$event\)"/);
    expect(code).not.toMatch(/\(range-complete\)=/);
    expect(code).toMatch(/private _guarded\w* = \(\$event: any\) => \{/);
    expect(code).toContain('if ($event.target !== $event.currentTarget) return;');
    expect(code).toContain('this.onComplete($event)');
  });

  it('a .debounce(300) hyphenated component listener still synthesizes its IIFE field and binds the wrap name, under the camelCase binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.debounce(300)="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(rangeComplete)="debouncedOnComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
    expect(code).toContain('private debouncedOnComplete = (() => {');
  });

  it("the modifier's own descriptor context still receives the AUTHORED (hyphenated) event name — the lowering applies ONLY to the emitted binding string", () => {
    // Custom test-only modifier whose angular() hook embeds ctx.event
    // (the ModifierContext.event field passed at emitTemplateEvent.ts's
    // impl.angular(modifierArgs, { source, event: eventName, sourceLoc })
    // call site) verbatim into the emitted guard comment. If the lowering
    // leaked into the descriptor context (rather than being applied only to
    // the final binding-string composition), this comment would read the
    // camelCase name instead of the authored hyphenated one.
    const probeModifier: EventModifierImpl = {
      name: 'probeEvent',
      arity: 'none',
      resolve(_args, ctx) {
        return {
          entries: [{ kind: 'filter', modifier: 'probeEvent', args: [], sourceLoc: ctx.sourceLoc }],
          diagnostics: [],
        };
      },
      angular(_args, ctx) {
        return {
          kind: 'inlineGuard',
          code: `/* authored-event:${ctx.event} */ $event.stopPropagation();`,
        };
      },
    };
    const registry = createDefaultRegistry();
    registry.register(probeModifier);

    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.probeEvent="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', registry);
    // Descriptor context saw the AUTHORED hyphenated name.
    expect(code).toContain('/* authored-event:range-complete */');
    // But the emitted binding is the camelCase Angular output name.
    expect(code).toContain('(rangeComplete)="');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — arity forms (0-arg and $event-forwarding) keep their invocation shapes under the camelCase binding name', () => {
  it('a 0-arg handler on a hyphenated component listener drops $event, under the camelCase binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
<script>
const onComplete = () => { console.log('done'); };
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    // Short-form path (no guard/hoist) — the handler resolves against
    // implicit `this` at TEMPLATE scope; no explicit `this.` prefix is
    // synthesized (that only happens for the hoisted-wrapper / IIFE paths).
    expect(code).toContain('(rangeComplete)="onComplete()"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });

  it('a $event-forwarding handler on a hyphenated component listener keeps the $event arg, under the camelCase binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
<script>
const onComplete = (payload) => { console.log(payload); };
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    // Short-form path — implicit-`this` template scope, no explicit prefix.
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — two-way r-model: non-double-transform (attribute path, untouched by the event-side gate)', () => {
  it('r-model:value on a component still emits its existing value/valueChange pair byte-identically', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<data>{ val: 0 }</data>
<template>
  <Child r-model:value="$data.val" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('[value]="val()" (valueChange)="val.set($event)"');
  });

  it('a hyphenated r-model:range-start emits the camelCase property binding plus its change output with exactly ONE camelization applied', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<data>{ start: 0 }</data>
<template>
  <Child r-model:range-start="$data.start" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    // Exactly one camelization: rangeStart / rangeStartChange — never
    // RangeStart/RangeStartChange or rangestartChange (double-transform).
    expect(code).toContain('[rangeStart]="start()" (rangeStartChange)="start.set($event)"');
    expect(code).not.toMatch(/\(range-start-?Change\)=/);
    expect(code).not.toContain('rangeStartChangeChange');
  });
});

describe('emitAngular — merge dedupe (a hazard this fix itself creates)', () => {
  it('two listeners on one component — one authored hyphenated, one authored camelCase, for the SAME event — merge into exactly ONE event binding', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onA" @rangeComplete="onB" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    const occurrences = code.match(/\(rangeComplete\)=/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — adjacent (mechanical, same lines): native multi-word merged listeners', () => {
  it('two listeners for the same HYPHENATED event on a NATIVE element merge correctly: both handler bodies survive and the synthesized wrapper field name is a valid JS identifier', () => {
    const src = `<rozie name="ParentComp">
<template>
  <div @my-event.stop="handlerA" @my-event="handlerB">x</div>
</template>
<script>
const handlerA = () => {};
const handlerB = () => {};
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    // The merged binding keeps the NATIVE hyphenated event name.
    expect(code).toMatch(/\(my-event\)="_merged\w*\(\$event\)"/);
    // Both handler bodies survive into the merged wrapper (previously
    // dropped by an extraction regex that only accepted alphabetic names).
    expect(code).toContain('this.handlerA()');
    expect(code).toContain('this.handlerB()');
    // The synthesized wrapper field name is a valid JS identifier — no
    // literal hyphen leaked into the class-field name.
    const wrapperMatch = /private (_merged\w+) = \(\$event: any\) => \{/.exec(code);
    expect(wrapperMatch).not.toBeNull();
    const wrapperName = wrapperMatch![1]!;
    expect(wrapperName).toMatch(/^[A-Za-z_$][\w$]*$/);
    expect(wrapperName).not.toContain('-');
  });
});

describe('emitAngular — residual pin: a child authoring a HYPHENATED emit name still declares its aliased output() exactly as today', () => {
  it('a component whose OWN $emit name is hyphenated still declares the aliased output() untouched by this task', () => {
    // This task normalizes the CONSUMER side only (D-01) — it never touches
    // emitScript.ts's declaration side. A child that itself authors a
    // hyphenated $emit name (e.g. `$emit('edge-click', …)`) still declares
    // `edgeClick = output<unknown>({ alias: 'edge-click' })` exactly as
    // before. NOTE (Task 3 files the todo): a consumer's hyphenated
    // `@edge-click=` binding now ALSO lowers past this alias to `edgeClick`
    // — matching it correctly — but a consumer binding the RAW alias string
    // `edge-click` verbatim as an Angular property is not itself a Rozie
    // template concern (Angular resolves `(edgeClick)=` against the alias
    // regardless of how the alias was declared).
    const src = `<rozie name="EdgeEmitter">
<script>
function fireEdge() { $emit('edge-click', null); }
</script>
</rozie>`;
    const { code } = compileAngular(src, 'EdgeEmitter.rozie');
    expect(code).toContain("edgeClick = output<unknown>({ alias: 'edge-click' })");
  });
});
