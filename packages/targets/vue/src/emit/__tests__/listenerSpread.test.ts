/**
 * Plan 15-04 Task 2 — Vue `ListenerSpreadIR` emitter (literal + dynamic +
 * D-19 + R6 merge).
 *
 * The `r-on="<expr>"` directive lowers to a `ListenerSpreadIR` on
 * `TemplateElementIR.listenerSpreads`. The Phase 15 D-08 hybrid for Vue:
 *
 *   - LITERAL `r-on="{ click: fn }"` → per-key compile-time emit
 *     (`@click="fn"`). Modifier-bearing keys (`r-on="{ 'click.stop': fn }"`)
 *     route through the existing per-target modifier-pipeline emit
 *     (A5: Vue's `v-on="<obj>"` does NOT support modifiers — literal-
 *     compile is the ONLY correct shape for modifier-bearing keys).
 *   - DYNAMIC `r-on="someObj"`  → `v-on="normalizeListeners(someObj)"` +
 *     the `@rozie/runtime-vue` runtime import is collected.
 *   - bare `r-on="$listeners"`   → `v-on="$listeners"` D-19 exempt — no
 *     normalizeListeners wrap (A1 / Pitfall 8 — consumer's $listeners
 *     already carries lowercase target-native keys).
 *
 * R6 all-fire source-order merge — when multiple handlers bind the SAME
 * event on the same element:
 *
 *   - All-literal (`@click="f1" r-on="{ click: f2 }"`): inline arrow
 *     dispatcher `@click="($event) => { f1($event); f2($event); }"` at
 *     compile time. Two bare `@click=` attributes on a native element
 *     would silently last-wins-overwrite in Vue's template parser — the
 *     merge is mandatory for correctness.
 *   - Mixed (literal + dynamic): the literal handlers stay as their
 *     `@event=` emit; dynamic spread emits as a separate
 *     `v-on="normalizeListeners(<expr>)"` directive. Vue's DOM-level
 *     `addEventListener` stacks both calls automatically — both fire
 *     (NO runtime `mergeListeners` helper for Vue; divergence from
 *     React/Solid).
 *   - Bare `$listeners` + `@click="f1"`: `@click="f1" v-on="$listeners"` —
 *     DOM-level addEventListener stacking handles all-fire.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../../emitVue.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitVue(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the `<template>` body from an emitted .vue SFC. The shell is
 * `<template>\n<body>\n</template>` — slice between the opening and closing
 * tags.
 */
function extractTemplate(emitted: string): string {
  const openMatch = emitted.match(/<template>\s*/);
  if (!openMatch) return emitted;
  const start = openMatch.index! + openMatch[0].length;
  const closeIdx = emitted.indexOf('</template>', start);
  if (closeIdx < 0) return emitted.slice(start);
  return emitted.slice(start, closeIdx).trim();
}

describe('emitTemplateAttribute (Vue) — ListenerSpreadIR (Plan 15-04 Task 2)', () => {
  // Suppress the synthesized auto-fallthrough so each test isolates the
  // explicit r-on behavior under test. The default `inherit-listeners=true`
  // appends an extra synthesized $listeners spread that would noise up
  // these focused snapshots.
  const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

  it('(1) literal-only no-merge: r-on="{ click: fn }" → @click="fn"', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ click: fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // Native Vue @event= attribute; no v-on= object form, no
    // normalizeListeners helper.
    expect(tmpl).toContain('@click="fn"');
    expect(tmpl).not.toContain('normalizeListeners');
    expect(tmpl).not.toContain('v-on="{');
  });

  it('(2) literal-with-merge: @click + r-on literal → R6 source-order dispatcher', () => {
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
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // R6 — BOTH f1 and f2 reachable from a single @click handler; the bare
    // `@click="f1" @click="f2"` would silently last-wins-overwrite in
    // Vue's template parser, so the inline dispatcher is mandatory.
    expect(tmpl).toContain('@click=');
    expect(tmpl).toContain('f1');
    expect(tmpl).toContain('f2');
    expect(tmpl).toContain('$event');
    // No runtime helper for Vue (DOM-level addEventListener stacking only
    // applies to the mixed-with-dynamic case, not the all-literal case).
    expect(tmpl).not.toContain('mergeListeners');
    // The merge must be a SINGLE @click= attribute, not two.
    expect((tmpl.match(/@click=/g) ?? []).length).toBe(1);
  });

  it('(3) literal modifier-bearing: r-on="{ \'click.stop\': fn }" → @click.stop="..." via modifier pipeline', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ 'click.stop': fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // The modifier-bearing literal key routes through the existing
    // emitTemplateEvent.ts modifier-pipeline path (A5 lock — `v-on="<obj>"`
    // doesn't support modifiers, so we MUST use the native `@click.stop=`
    // template syntax).
    expect(tmpl).toContain('@click.stop=');
    expect(tmpl).not.toContain('v-on="{');
  });

  it('(4) dynamic no-merge: r-on="someObj" → v-on="normalizeListeners(someObj)" + shell import', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // Dynamic path — Vue object-form v-on= wrapping normalizeListeners().
    expect(tmpl).toContain('v-on="normalizeListeners(someObj)"');
    // Shell threads the runtime import.
    expect(code).toContain("import { normalizeListeners } from '@rozie/runtime-vue';");
  });

  it('(5) dynamic with-merge: @click + r-on dynamic → both bind separately (DOM-level stacking)', () => {
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
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // R6 mixed: explicit @click= AND a separate v-on=normalizeListeners(...)
    // attribute; Vue's DOM-level addEventListener stacks both calls.
    expect(tmpl).toContain('@click="f1"');
    expect(tmpl).toContain('v-on="normalizeListeners(someObj)"');
    // NO compile-time merge into a dispatcher (the dynamic key set isn't
    // statically knowable) and NO runtime mergeListeners helper (Vue
    // divergence from React/Solid).
    expect(tmpl).not.toContain('mergeListeners');
    expect(code).toContain("normalizeListeners");
  });

  it('(6) bare $listeners (D-19 exempt): r-on="$listeners" → no-op (Vue 3 folds listeners into $attrs)', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // D-19 — Vue 3 has no `$listeners` instance property (that was Vue 2);
    // listeners are folded into `$attrs` and flow through the existing
    // `v-bind="$attrs"` auto-attribute-fallthrough. Plan 15-06 closed the
    // vue-tsc TS2339 regression by suppressing the bare `$listeners` emit
    // on the Vue side (the earlier `v-on="$listeners"` shape produced
    // `Property '$listeners' does not exist on type` under vue-tsc strict
    // mode AND a runtime warning).
    expect(tmpl).not.toContain('v-on="$listeners"');
    expect(tmpl).not.toContain('normalizeListeners');
    // NO runtime helper imported.
    expect(code).not.toContain("import { normalizeListeners }");
  });

  it('(7) bare $listeners + @click (R6 + D-19): explicit @click stays; $listeners suppressed', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="$listeners">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const tmpl = extractTemplate(code);
    expect(tmpl).toMatchSnapshot();
    // R6 + D-19 — the explicit `@click="f1"` stays; the bare-$listeners
    // path is suppressed for Vue 3 (D-19 lowering — Vue folds listeners
    // into $attrs). The author's @click binding fires; any consumer-passed
    // click listener flows through `v-bind="$attrs"` automatically.
    expect(tmpl).toContain('@click="f1"');
    expect(tmpl).not.toContain('v-on="$listeners"');
    expect(tmpl).not.toContain('normalizeListeners');
  });
});
