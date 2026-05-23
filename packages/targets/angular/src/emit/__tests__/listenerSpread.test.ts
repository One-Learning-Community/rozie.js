/**
 * Plan 15-05 Task 2 — Angular `ListenerSpreadIR` emitter (D-13 hybrid + R6
 * single-binding merger + D-19 $listeners + Phase 13 DestroyRef coordination).
 *
 * The `r-on="<expr>"` directive lowers to a `ListenerSpreadIR` on
 * `TemplateElementIR.listenerSpreads`. The Phase 15 D-13 hybrid for Angular:
 *
 *   - LITERAL `r-on="{ click: fn }"` (no modifier) → native `(click)="fn($event)"`
 *     template binding. Synthesized via virtual `Listener` splice into
 *     `node.events`; the existing `emitTemplateEvent.ts` path handles emit.
 *   - LITERAL modifier-bearing `r-on="{ 'click.stop': fn }"` → same synthetic-
 *     splice path; modifier pipeline is honoured via the existing
 *     `emitTemplateEvent.ts` modifier-pipeline emit (inline wrapper method
 *     calling `stopPropagation()` then the user handler). The wrapper method
 *     IS the cross-target invariant — Angular's emit shape matches the same
 *     `@click.stop="fn"` lowering that bare `@click.stop=` would produce, so
 *     the modifier-pipeline IR survives uniformly without needing a dynamic-
 *     Renderer2 detour for the literal-modifier case.
 *   - DYNAMIC `r-on="someObj"` → a `#rozieListenersTarget_<N>` template-ref
 *     attribute + class-body `viewChild<ElementRef>(...)` + per-spread
 *     `effect()` body calling `Renderer2.listen(el, eventName, fn)` per
 *     object key, registering returned disposers against
 *     `__rozieDestroyRef = inject(DestroyRef)` (the same field Phase 13 added
 *     for `$onMount` paired-cleanup). The `?.nativeElement` guard makes the
 *     pre-render effect tick a no-op (Pitfall 9).
 *   - bare `r-on="$listeners"` (D-19) → same dynamic-Renderer2 path because
 *     the consumer's `$listeners` cluster is opaque at compile time. At
 *     runtime Angular has no `$listeners` magic accessor; the bare identifier
 *     resolves to undefined → the `obj ?? {}` coercion makes the loop a clean
 *     no-op.
 *
 * R6 all-fire source-order merge — Angular's template parser REJECTS multiple
 * `(click)=` bindings on the same element (Pitfall 1; mandatory merge):
 *
 *   - All-literal (`@click="f1" r-on="{ click: f2 }"`): synthetic Listener
 *     spliced into `node.events`, then the existing same-event grouping in
 *     `emitEvents` folds the two into a single
 *     `(click)="__merged_click_N($event)"` template binding delegating to a
 *     private merger method calling each handler in source order.
 *   - Mixed (literal + dynamic): the literal handlers stay as native `(event)=`
 *     bindings; the dynamic spread emits as a separate
 *     `#rozieListenersTarget_<N>` template-ref + effect() body. Both attach
 *     via `addEventListener` (Angular's `(event)=` and `Renderer2.listen`
 *     both stack into the same DOM event), so the all-fire R6 semantic is
 *     preserved at the DOM layer (NO runtime `mergeListeners` helper for
 *     Angular; same divergence from React/Solid that Vue/Svelte exhibit).
 *
 * Phase 13 DestroyRef coordination — the
 * `private __rozieDestroyRef = inject(DestroyRef);` field is hoisted EXACTLY
 * ONCE per component regardless of how many sources signal the need
 * (`$onMount` paired-cleanup / portal slots / dynamic `r-on` Renderer2.listen).
 * The dedupe lives in `emitAngular.ts` via a literal-string presence check;
 * `emitScript.ts` already emits the field when the lifecycle/portals union
 * fires, so the template-emit synthesis only injects it when the script-side
 * union didn't.
 *
 * Cleanup contract (D-14 — Angular leg): each dynamic spread's effect()
 * registers a one-time `__rozieDestroyRef.onDestroy(() => { for (off of
 * __rozieListenersDisposers_<N>) off(); ... })` gated by a per-spread
 * `__rozieListenersDestroyRegistered_<N>` boolean. The next effect re-run
 * detaches the prior listeners (per-effect-run cleanup); the onDestroy hook
 * fires on component destroy (final cleanup). T-15-V5-04b mitigation.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../../emitAngular.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitAngular(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the Angular template string from the emitted .ts file — the
 * substring inside the `@Component({ ..., template: \`...\` })` decorator's
 * `template:` field. Walks character-by-character so nested `${...}`
 * interpolations don't trip a naive backtick scan (the emitted source uses
 * plain backticks for the template literal, with no JS interpolations in
 * Angular's case — Angular's `{{ }}` text bindings are inside the template
 * string literally, not as JS interpolations).
 */
function extractTemplate(emitted: string): string {
  const m = emitted.match(/template:\s*`([\s\S]*?)`,?\s*styles:/);
  if (m) return m[1]!;
  const m2 = emitted.match(/template:\s*`([\s\S]*?)`,?\s*\}\)/);
  if (m2) return m2[1]!;
  return emitted;
}

describe('emit (Angular) — ListenerSpreadIR (Plan 15-05 Task 2)', () => {
  // Suppress the synthesized auto-fallthrough so each test isolates the
  // explicit r-on behavior under test.
  const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

  it('(1) literal no-merge no-modifier: r-on="{ click: fn }" → (click)="fn($event)"', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ click: fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // Native (click) binding, single fn invocation. Angular's template
    // implicit-`this` resolves a bare `fn()` against the class instance,
    // so the template-side emit is `fn()` not `this.fn()` (only class-body
    // contexts like the merger arrow need the explicit `this.` prefix).
    expect(template).toContain('(click)=');
    expect(template).toMatch(/\(click\)="fn\(\)"/);
    // No dynamic Renderer2 path for the no-modifier literal — fast path.
    expect(template).not.toContain('rozieListenersTarget_');
    expect(code).not.toContain('Renderer2.listen');
  });

  it('(2) R6 same-event merge (all-literal): @click + r-on { click } → single (click)="__merged_click_N($event)"', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="{ click: f2 }">go</button>
</template>
<script>
const f1 = () => undefined;
const f2 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // EXACTLY one (click)= binding — Pitfall 1; Angular forbids duplicates.
    expect((template.match(/\(click\)=/g) ?? []).length).toBe(1);
    // The single binding delegates to a private merger method.
    expect(template).toMatch(/_merged_click_\d+/);
    // Both handlers are reachable through the merger — class-body context
    // requires the explicit `this.` prefix (the regex in emitTemplateNode.ts
    // post-processes the bare-call form). Plan 15-05 Rule 1 bug fix extended
    // the regex to also catch the 0-arg `fn()` shape that synthetic Listener
    // splicing produces (the existing pattern only caught `fn($event)`).
    expect(code).toContain('this.f1()');
    expect(code).toContain('this.f2()');
    expect(code).toMatch(/_merged_click_\d+/);
  });

  it('(3) literal modifier-bearing: r-on="{ \'click.stop\': fn }" → (click)= with stopPropagation', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ 'click.stop': fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // The modifier-bearing literal rides the existing emitTemplateEvent.ts
    // modifier-pipeline emit (synthetic Listener splice path), producing the
    // SAME (click)="_guardedFn($event)" wrapper shape that an authored
    // @click.stop="fn" would yield — the modifier-pipeline IR survives
    // uniformly across all 6 targets via the synthetic-splice route.
    expect(template).toContain('(click)=');
    expect(code).toContain('stopPropagation');
    // The wrapper method's body invokes `fn` (collision-renamed bare
    // identifier prefixed with `this.` by applyThisPrefixing).
    expect(code).toMatch(/this\.fn/);
  });

  it('(4) dynamic no-merge: r-on="someObj" → #rozieListenersTarget_N + effect() + Renderer2.listen()', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // Template-ref attribute splice.
    expect(template).toMatch(/#rozieListenersTarget_\d+/);
    // Class-body effect + Renderer2.listen + DestroyRef onDestroy.
    expect(code).toMatch(/private rozieListenersTarget_\d+ = viewChild<ElementRef>\('rozieListenersTarget_\d+'\);/);
    expect(code).toContain('__rozieListenersRenderer = inject(Renderer2);');
    expect(code).toMatch(/private __rozieListenersDisposers_\d+: Array<\(\) => void> = \[\];/);
    expect(code).toMatch(/private __rozieListenersEffect_\d+ = effect\(\(\) => \{/);
    expect(code).toContain('?.nativeElement');
    expect(code).toContain('this.__rozieListenersRenderer.listen(el');
    expect(code).toContain('this.__rozieDestroyRef.onDestroy');
    // Phase 13 coordination — exactly ONE __rozieDestroyRef field.
    expect((code.match(/private __rozieDestroyRef = inject\(DestroyRef\);/g) ?? []).length).toBe(1);
  });

  it('(5) mixed dynamic + literal: @click + r-on dynamic → native (click) + separate #rozieListenersTarget_N', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button @click="f1" r-on="someObj">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // Native (click) binding stays. Angular template implicit-this resolves
    // `f1()` against the class instance; only class-body contexts need the
    // explicit `this.` prefix.
    expect(template).toContain('(click)=');
    expect(template).toMatch(/\(click\)="f1\(\)"/);
    // Dynamic spread emits separately.
    expect(template).toMatch(/#rozieListenersTarget_\d+/);
    expect(code).toContain('this.__rozieListenersRenderer.listen(el');
    // Both attach via addEventListener → DOM-level all-fire (no merge code).
    expect(code).not.toMatch(/_merged_click_/);
  });

  it('(6) bare $listeners (D-19): r-on="$listeners" → dynamic-Renderer2 path', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const template = extractTemplate(code);
    expect(template).toMatchSnapshot();
    // Same dynamic-Renderer2 path — Angular has no magic $listeners accessor,
    // so the bare `$listeners` Identifier in the spread expression lowers to
    // the safe `undefined` literal at compile time (see emitTemplateAttribute.ts
    // emitListenerSpread D-19 handling). The downstream `?? {}` coercion then
    // makes the effect()'s for-loop a clean no-op rather than a ReferenceError
    // at runtime on class-body lookup of `$listeners`.
    expect(template).toMatch(/#rozieListenersTarget_\d+/);
    expect(code).toContain('Renderer2');
    expect(code).toContain('const obj = (undefined) ?? {};');
    // The bare `$listeners` Identifier must NOT appear in the emitted code —
    // it's a runtime ReferenceError at class scope and the D-19 lowering
    // replaces it with `undefined` at compile time.
    expect(code).not.toMatch(/\(\$listeners\)/);
  });

  it('(7) Phase 13 coordination — $onMount paired-cleanup + dynamic r-on emits ONE __rozieDestroyRef', () => {
    // The component uses BOTH $onMount paired-cleanup (lifecycle path
    // signals needsDestroyRefField via emitScript) AND a dynamic r-on
    // spread (template path signals needsDestroyRefField via emitTemplate).
    // The dedupe in emitAngular.ts MUST produce exactly ONE field
    // declaration.
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
<script>
$onMount(() => {
  const timer = setInterval(() => undefined, 1000);
  return () => clearInterval(timer);
});
</script>
</rozie>`;
    const code = compile(src);
    expect(code).toMatch(/private __rozieDestroyRef = inject\(DestroyRef\);/);
    // EXACTLY ONE — Phase 13 / Warning #3 coordination invariant.
    expect((code.match(/private __rozieDestroyRef = inject\(DestroyRef\);/g) ?? []).length).toBe(1);
    // Both sources are wired:
    //  - lifecycle path emits `this.__rozieDestroyRef.onDestroy(cleanup)`
    //  - listener-spread effect emits `this.__rozieDestroyRef.onDestroy(...)`
    expect((code.match(/this\.__rozieDestroyRef\.onDestroy/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
