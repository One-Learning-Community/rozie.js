/**
 * Plan 15-04 Task 2 — Svelte `ListenerSpreadIR` emitter (literal + dynamic +
 * D-19 + R6 merge).
 *
 * The `r-on="<expr>"` directive lowers to a `ListenerSpreadIR` on
 * `TemplateElementIR.listenerSpreads`. The Phase 15 D-11 hybrid for Svelte:
 *
 *   - LITERAL `r-on="{ click: fn }"` → per-key native `onclick={fn}`
 *     attribute. Modifier-bearing keys (`r-on="{ 'click.stop': fn }"`)
 *     route through the existing Svelte `emitTemplateEvent.ts` modifier-
 *     pipeline emit (inline guard composition into `($event) => { ... }`).
 *   - DYNAMIC `r-on="someObj"`  → `use:applyListeners={someObj}` (Svelte 5
 *     action — D-11 lock). Shell threads
 *     `import { applyListeners } from '@rozie/runtime-svelte';`.
 *   - bare `r-on="$listeners"`   → `use:applyListeners={__rozieAttrs}`
 *     (D-19 exempt — the action still runs because Svelte has no native
 *     object-form listener directive; the consumer's $listeners cluster
 *     arrives via the `__rozieAttrs` rest binding from `$props()`, same
 *     source as Phase 14's `$attrs` rewrite). NO compile-time key remap
 *     (action's FORBIDDEN_KEYS skip is the runtime guard).
 *
 * R6 all-fire source-order merge — when multiple handlers bind the SAME
 * event on the same element:
 *
 *   - All-literal (`@click="f1" r-on="{ click: f2 }"`): the existing
 *     Svelte event-grouping in `emitTemplateNode.ts::emitEvents` folds
 *     same-event listeners into a single `onclick={($event) => { (() =>
 *     { f1($event); })(); (() => { f2($event); })(); }}` dispatcher
 *     (Svelte rejects duplicate `oneventname` attribute names on the same
 *     element). The merge is mandatory for correctness — the synthesized
 *     Listener from `r-on="{ click: f2 }"` collides with the existing
 *     `@click="f1"` and Svelte's parser would silently drop one.
 *   - Mixed (literal + dynamic): the literal handlers stay as `oneventname=`
 *     attributes; the dynamic spread emits as a separate
 *     `use:applyListeners={...}` action. The action's `addEventListener`
 *     calls stack with the native `oneventname=` directives on the same
 *     DOM event, so both fire automatically (NO runtime `mergeListeners`
 *     helper for Svelte; divergence from React/Solid).
 *   - Bare `$listeners` + `@click="f1"`: same as the dynamic mixed case —
 *     `onclick={...} use:applyListeners={__rozieAttrs}` — DOM-level
 *     addEventListener stacking handles all-fire.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../../emitSvelte.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSvelte(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the bare top-level Svelte markup body — Svelte SFCs interleave
 * `<script>`, markup, and `<style>` in the order they appeared in the source
 * `.rozie` file. The Plan 15-04 test fixtures put `<template>` BEFORE
 * `<script>` (the natural .rozie author order), so the emitted markup
 * appears BEFORE the `<script>` block. Strip every `<script>...</script>`
 * and `<style>...</style>` block and return what's left.
 */
function extractMarkup(emitted: string): string {
  let out = emitted;
  // Strip `<script ...>...</script>` blocks (any attributes, e.g. lang="ts").
  out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  // Strip `<style ...>...</style>` blocks.
  out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  return out.trim();
}

describe('emitTemplateAttribute (Svelte) — ListenerSpreadIR (Plan 15-04 Task 2)', () => {
  // Suppress the synthesized auto-fallthrough so each test isolates the
  // explicit r-on behavior under test.
  const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

  it('(1) literal-only no-merge: r-on="{ click: fn }" → onclick={fn}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ click: fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    expect(markup).toContain('onclick={fn}');
    // No runtime helper for the literal path.
    expect(markup).not.toContain('use:applyListeners');
    expect(code).not.toContain("import { applyListeners }");
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
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    // R6 — BOTH f1 and f2 reachable from a single onclick handler; the
    // bare `onclick={f1} onclick={f2}` form is rejected by Svelte 5
    // (duplicate attributes), so the inline dispatcher is mandatory.
    expect(markup).toContain('onclick=');
    expect(markup).toContain('f1');
    expect(markup).toContain('f2');
    expect(markup).toContain('$event');
    // Only ONE onclick attribute.
    expect((markup.match(/onclick=/g) ?? []).length).toBe(1);
    expect(markup).not.toContain('use:applyListeners');
  });

  it('(3) literal modifier-bearing: r-on="{ \'click.stop\': fn }" → onclick with stopPropagation', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ 'click.stop': fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    // The modifier pipeline runs through the existing
    // emitTemplateEvent.ts path used by @click.stop — `stopPropagation()`
    // must appear in the dispatcher body (Svelte's modifier-emit shape
    // inlines the modifier effect into an arrow handler).
    expect(markup).toContain('onclick=');
    expect(markup).toContain('stopPropagation');
    expect(markup).not.toContain('use:applyListeners');
  });

  it('(4) dynamic no-merge: r-on="someObj" → use:applyListeners={someObj} + shell import', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    expect(markup).toContain('use:applyListeners={someObj}');
    // Shell threads the runtime import (D-11 — the action ships from
    // @rozie/runtime-svelte; the package's first real export beyond
    // ./PortalHost.svelte).
    expect(code).toContain("import { applyListeners } from '@rozie/runtime-svelte';");
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
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    // R6 mixed: explicit onclick= AND a separate use:applyListeners=…
    // action; Svelte 5's addEventListener (called inside the action body)
    // stacks with the native onclick= directive, so both fire.
    expect(markup).toContain('onclick={f1}');
    expect(markup).toContain('use:applyListeners={someObj}');
    // NO runtime mergeListeners helper for Svelte (divergence from
    // React/Solid).
    expect(code).not.toContain('mergeListeners');
    expect(code).toContain("import { applyListeners } from '@rozie/runtime-svelte';");
  });

  it('(6) bare $listeners (D-19): r-on="$listeners" → use:applyListeners={__rozieAttrs}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    // D-19 — bare $listeners passes through to the action; on Svelte 5
    // runes-mode the consumer's listener handlers live in the same
    // __rozieAttrs rest binding as $attrs (both arrive via $props() rest),
    // so $listeners rewrites to __rozieAttrs. The action's FORBIDDEN_KEYS
    // skip is the runtime guard.
    expect(markup).toContain('use:applyListeners={__rozieAttrs}');
    expect(markup).not.toContain('$listeners'); // Svelte 5 rejects bare $listeners
    expect(code).toContain("import { applyListeners } from '@rozie/runtime-svelte';");
  });

  it('(7) bare $listeners + @click (R6 + D-19): both bind separately', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="$listeners">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const markup = extractMarkup(code);
    expect(markup).toMatchSnapshot();
    // R6 + D-19 — both bind separately; DOM-level addEventListener stacking
    // handles all-fire.
    expect(markup).toContain('onclick={f1}');
    expect(markup).toContain('use:applyListeners={__rozieAttrs}');
  });
});
