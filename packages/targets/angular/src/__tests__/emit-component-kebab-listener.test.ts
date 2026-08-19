/**
 * emit-component-kebab-listener.test.ts — Angular target.
 *
 * Quick task 260811-r2m (D-01/D-02) fixed the Angular twin of the Lit
 * multi-word emit bug: a `.rozie` consumer's `@kebab-name` listener on a
 * composed CHILD COMPONENT was lowered literally, but the child's Angular
 * class declares a camelCase `output()` field — so every multi-word
 * listener was silently dead. r2m's fix camelized the consumer's authored
 * listener UNCONDITIONALLY on component/self tags.
 *
 * Quick task 260811-trz (this file) replaces that unconditional camelize
 * with CALLEE-IR RESOLUTION. The corpus has TWO legitimate, both-published
 * `$emit`-authoring conventions:
 *
 *   - camel-authored (`$emit('rangeComplete')`, no alias — public name IS
 *     the camelCase field id) — date-picker, fullcalendar, wavesurfer, ...
 *   - kebab-authored (`$emit('sort-change')`, ALIASED — Angular resolves
 *     template bindings against the alias, so the public name is the RAW
 *     hyphenated string) — data-table (15 such emits), rete (11).
 *
 * r2m's blanket camelize can only ever serve the first convention. This
 * suite resolves the consumer's authored listener against the composed
 * child's ACTUAL declared emit list (`TemplateElementIR.producerEmits`,
 * threaded by `threadParamTypes` — see `threadProducerEmits.test.ts` for the
 * core-side proof), matched by kebab-equivalence via `sanitizeEventName`.
 *
 * The real `compile()` pipeline runs `threadParamTypes` to populate
 * `producerEmits`; `compileAngular`'s `parse` → `lowerToIR` → `emitAngular`
 * chain does NOT (see `compileAngular` below). `withProducerEmits` injects a
 * simulated `producerEmits` value directly onto the composed component-tag
 * node before `emitAngular` runs, so this file can test the emitter
 * contract in isolation. `tests/event-contract-conformance/event-name-
 * contract.test.ts` is the integration layer that proves the real
 * `compile()` path threads it for real.
 */

import type {
  Diagnostic,
  EventModifierImpl,
  IRComponent,
  ModifierRegistry,
  IRTemplateNode as TemplateNode,
} from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { resolveEventBindingName } from '../emit/emitTemplateEvent.js';
import { emitAngular } from '../emitAngular.js';
import { angularOutputBinding, sanitizeEventName } from '../rewrite/sanitizeEventName.js';

/**
 * Walk `ir.template` and set `producerEmits` on EVERY component/self tag —
 * every fixture in this file composes exactly one child, so this simulates
 * exactly what `threadParamTypes` would have threaded for that single
 * composed tag without needing the full resolver+cache+manifest machinery
 * `threadProducerEmits.test.ts` already exercises.
 */
function withProducerEmits(template: TemplateNode | null, producerEmits: readonly string[]): void {
  if (template === null) return;
  if (template.type === 'TemplateElement') {
    if (template.tagKind === 'component' || template.tagKind === 'self') {
      template.producerEmits = producerEmits;
    }
    for (const child of template.children) withProducerEmits(child, producerEmits);
    if (template.slotFillers) {
      for (const filler of template.slotFillers) {
        for (const child of filler.body) withProducerEmits(child, producerEmits);
      }
    }
    return;
  }
  if (template.type === 'TemplateConditional') {
    for (const branch of template.branches) {
      for (const child of branch.body) withProducerEmits(child, producerEmits);
    }
    return;
  }
  if (template.type === 'TemplateLoop') {
    for (const child of template.body) withProducerEmits(child, producerEmits);
    return;
  }
  if (template.type === 'TemplateFragment') {
    for (const child of template.children) withProducerEmits(child, producerEmits);
  }
}

interface CompileAngularOptions {
  registry?: ModifierRegistry;
  /**
   * Simulated `TemplateElementIR.producerEmits` for the composed child tag,
   * applied to every component/self tag in the fixture BEFORE `emitAngular`
   * runs. Omitted → every composed tag is left as an UNRESOLVED producer
   * (D-06 fallback: literal passthrough), exactly matching what the real
   * pipeline threads when the child never resolved.
   */
  producerEmits?: readonly string[];
}

function compileAngular(
  src: string,
  filename: string,
  opts: CompileAngularOptions = {},
): { code: string; diagnostics: Diagnostic[] } {
  const registry = opts.registry ?? createDefaultRegistry();
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
  if (opts.producerEmits !== undefined) {
    withProducerEmits(ir.template, opts.producerEmits);
  }
  return emitAngular(ir, { filename, source: src, modifierRegistry: registry });
}

describe('emitAngular — callee-IR resolution: KEBAB-AUTHORED convention (the new RED core, 260811-trz)', () => {
  it('child declares a kebab-authored (aliased) emit; consumer authors the matching kebab listener; binding is the kebab public name, NOT camelized', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @sort-change="onSort" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', { producerEmits: ['sort-change'] });
    expect(code).toContain('(sort-change)="onSort($event)"');
    expect(code).not.toMatch(/\(sortChange\)=/);
  });

  it('child declares kebab; consumer authors the CAMEL-BOUND form; kebab-equivalence still resolves to the kebab public name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @sortChange="onSort" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', { producerEmits: ['sort-change'] });
    expect(code).toContain('(sort-change)="onSort($event)"');
    expect(code).not.toMatch(/\(sortChange\)=/);
  });
});

describe('emitAngular — callee-IR resolution: CAMEL-AUTHORED convention (r2m regression guard)', () => {
  it('child declares a camel-authored (non-aliased) emit; consumer authors the hyphenated form; binding is the camelCase public name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — single-word byte-stability (with AND without producerEmits threaded)', () => {
  it('a single-word event stays byte-identical when producerEmits is threaded and declares it', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @change="onChange" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', { producerEmits: ['change'] });
    expect(code).toContain('(change)="onChange($event)"');
  });

  it('a single-word event stays byte-identical when producerEmits is ABSENT (unresolved-child fallback)', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @change="onChange" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(change)="onChange($event)"');
  });
});

describe('emitAngular — D-06 fallback: literal passthrough, silent', () => {
  it('UNRESOLVED CHILD (producerEmits absent): a hyphenated listener passes through verbatim', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @sort-change="onSort" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie');
    expect(code).toContain('(sort-change)="onSort($event)"');
    expect(code).not.toMatch(/\(sortChange\)=/);
  });

  it('UNMATCHED NAME against a RESOLVED child: passes through verbatim, and pushes NO diagnostic', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @sort-change="onSort" />
</template>
</rozie>`;
    const { code, diagnostics } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['ready'],
    });
    expect(code).toContain('(sort-change)="onSort($event)"');
    expect(code).not.toMatch(/\(sortChange\)=/);
    expect(diagnostics).toEqual([]);
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

  it('NATIVE ELEMENT UNTOUCHED: resolveEventBindingName ignores a threaded producerEmits on a non-component tagKind — the tagKind gate runs FIRST, unconditionally', () => {
    // Direct unit-level pin of the function itself: the real threadParamTypes
    // pipeline never sets producerEmits on an html-tagKind node, but this
    // proves the guard is structural (tagKind-first), not "happens to work
    // because producerEmits is always absent for html tags".
    expect(resolveEventBindingName('sort-change', 'html', undefined)).toBe('sort-change');
    expect(resolveEventBindingName('sort-change', 'html', ['sort-change'])).toBe('sort-change');
    expect(resolveEventBindingName('sort-change', undefined, ['sort-change'])).toBe('sort-change');
  });
});

describe('emitAngular — self-recursion (tagKind: self) resolves against its own declared emits too', () => {
  it('a hyphenated listener on a self-referencing recursive tag whose own declared emit is camel-authored resolves to the camelCase binding', () => {
    const src = `<rozie name="TreeNode">
<components>{ TreeNode: "./TreeNode.rozie" }</components>
<template>
  <li>
    <TreeNode @range-complete="onComplete" />
  </li>
</template>
</rozie>`;
    const { code } = compileAngular(src, 'TreeNode.rozie', { producerEmits: ['rangeComplete'] });
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — separator parity (proves sanitizeEventName is the canonical key, not a hand-rolled hyphen regex)', () => {
  it('a mixed hyphen+underscore listener resolves against a camel-authored declared emit — both separator kinds canonicalize', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete_now="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeCompleteNow'],
    });
    const expected = sanitizeEventName('rangeCompleteNow');
    expect(expected).toBe('rangeCompleteNow');
    expect(code).toContain(`(${expected})="onComplete($event)"`);
    expect(code).not.toContain('(range-complete_now)=');
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
  ])('a camel-authored declared emit %s: the hyphenated consumer form (%s) resolves to it', (camelName, hyphenated) => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @${hyphenated}="onX" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', { producerEmits: [camelName] });
    expect(code).toContain(`(${camelName})="onX($event)"`);
  });
});

describe('emitAngular — modifier paths (binding name resolved, authored name still reaches the descriptor context)', () => {
  it('a side-effect modifier (.stop) on a hyphenated component listener still emits the inline guard chain, under the resolved binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.stop="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    expect(code).toContain('(rangeComplete)="$event.stopPropagation(); onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });

  it('an early-return modifier (.self) on a hyphenated component listener still hoists its guarded class-field wrapper, under the resolved binding name', () => {
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
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    expect(code).toMatch(/\(rangeComplete\)="_guarded\w*\(\$event\)"/);
    expect(code).not.toMatch(/\(range-complete\)=/);
    expect(code).toMatch(/private _guarded\w* = \(\$event: any\) => \{/);
    expect(code).toContain('if ($event.target !== $event.currentTarget) return;');
    expect(code).toContain('this.onComplete($event)');
  });

  it('a .debounce(300) hyphenated component listener still synthesizes its IIFE field and binds the wrap name, under the resolved binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete.debounce(300)="onComplete" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    expect(code).toContain('(rangeComplete)="debouncedOnComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
    expect(code).toContain('private debouncedOnComplete = (() => {');
  });

  it("the modifier's own descriptor context still receives the AUTHORED (hyphenated) event name — resolution applies ONLY to the emitted binding string", () => {
    // Custom test-only modifier whose angular() hook embeds ctx.event
    // (the ModifierContext.event field passed at emitTemplateEvent.ts's
    // impl.angular(modifierArgs, { source, event: eventName, sourceLoc })
    // call site) verbatim into the emitted guard comment. If resolution
    // leaked into the descriptor context (rather than being applied only to
    // the final binding-string composition), this comment would read the
    // resolved name instead of the authored hyphenated one.
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
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      registry,
      producerEmits: ['rangeComplete'],
    });
    // Descriptor context saw the AUTHORED hyphenated name.
    expect(code).toContain('/* authored-event:range-complete */');
    // But the emitted binding is the resolved Angular public name.
    expect(code).toContain('(rangeComplete)="');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — arity forms (0-arg and $event-forwarding) keep their invocation shapes under the resolved binding name', () => {
  it('a 0-arg handler on a hyphenated component listener drops $event, under the resolved binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
<script>
const onComplete = () => { console.log('done'); };
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    // Short-form path (no guard/hoist) — the handler resolves against
    // implicit `this` at TEMPLATE scope; no explicit `this.` prefix is
    // synthesized (that only happens for the hoisted-wrapper / IIFE paths).
    expect(code).toContain('(rangeComplete)="onComplete()"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });

  it('a $event-forwarding handler on a hyphenated component listener keeps the $event arg, under the resolved binding name', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onComplete" />
</template>
<script>
const onComplete = (payload) => { console.log(payload); };
</script>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
    // Short-form path — implicit-`this` template scope, no explicit prefix.
    expect(code).toContain('(rangeComplete)="onComplete($event)"');
    expect(code).not.toMatch(/\(range-complete\)=/);
  });
});

describe('emitAngular — two-way r-model: non-double-transform (attribute path, entirely untouched by this task)', () => {
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
  it('two listeners on one component — one authored hyphenated, one authored camelCase, for the SAME declared event — merge into exactly ONE event binding', () => {
    const src = `<rozie name="ParentComp">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <Child @range-complete="onA" @rangeComplete="onB" />
</template>
</rozie>`;
    const { code } = compileAngular(src, 'ParentComp.rozie', {
      producerEmits: ['rangeComplete'],
    });
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

describe('emitAngular — declaration-side byte-identity (D-04 refactor must not move the emitted output() lines)', () => {
  it('a component authoring both a kebab-authored and a camel-authored emit declares the EXACT SAME output() field lines as pre-refactor', () => {
    const src = `<rozie name="EdgeEmitter">
<script>
function fireEdge() {
  $emit('sort-change', null);
  $emit('ready');
}
</script>
</rozie>`;
    const { code } = compileAngular(src, 'EdgeEmitter.rozie');
    expect(code).toContain("sortChange = output<unknown>({ alias: 'sort-change' });");
    expect(code).toContain('ready = output<void>();');
  });
});

describe('angularOutputBinding — public-name collapse pin (D-04 derivation note)', () => {
  it('non-aliased branch: fieldId equals the authored name, alias is null, publicName equals fieldId', () => {
    expect(angularOutputBinding('rangeComplete')).toEqual({
      fieldId: 'rangeComplete',
      alias: null,
      publicName: 'rangeComplete',
    });
  });

  it('aliased branch: fieldId is the sanitized identifier, alias is the authored name, publicName equals the alias (NOT the fieldId)', () => {
    expect(angularOutputBinding('sort-change')).toEqual({
      fieldId: 'sortChange',
      alias: 'sort-change',
      publicName: 'sort-change',
    });
  });
});

describe('emitAngular — residual pin: a child authoring a HYPHENATED emit name still declares its aliased output() exactly as today', () => {
  it('a component whose OWN $emit name is hyphenated still declares the aliased output() untouched by the consumer-side resolution', () => {
    const src = `<rozie name="EdgeEmitter">
<script>
function fireEdge() { $emit('edge-click', null); }
</script>
</rozie>`;
    const { code } = compileAngular(src, 'EdgeEmitter.rozie');
    expect(code).toContain("edgeClick = output<unknown>({ alias: 'edge-click' })");
  });
});
