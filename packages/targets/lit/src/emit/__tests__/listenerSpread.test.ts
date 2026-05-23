/**
 * Plan 15-05 Task 1 — Lit `ListenerSpreadIR` emitter (rozieListeners
 * AsyncDirective + R6 merge + D-19 $listeners).
 *
 * The `r-on="<expr>"` directive lowers to a `ListenerSpreadIR` on
 * `TemplateElementIR.listenerSpreads`. The Phase 15 D-12 hybrid for Lit:
 *
 *   - LITERAL `r-on="{ click: fn }"` → per-key native `@click=${fn}`
 *     template-event binding. Modifier-bearing keys
 *     (`r-on="{ 'click.stop': fn }"`) route through the existing Lit
 *     `buildEventParts` modifier-pipeline emit (inline guard composition
 *     into `($event: Event) => { ... }`).
 *   - DYNAMIC `r-on="someObj"`  → `${rozieListeners(someObj)}` element-
 *     position AsyncDirective binding (D-12 lock). Shell threads
 *     `import { rozieListeners } from '@rozie/runtime-lit';`.
 *   - bare `r-on="$listeners"`   → `${rozieListeners($listeners)}` (D-19
 *     exempt — the bare Identifier passes through unchanged via
 *     STABLE_IDENTIFIERS; at runtime resolves to undefined, the directive's
 *     `obj ?? {}` coercion makes it a clean no-op).
 *
 * R6 all-fire source-order merge — when multiple handlers bind the SAME
 * event on the same element:
 *
 *   - All-literal (`@click="f1" r-on="{ click: f2 }"`): the existing Lit
 *     same-event grouping in `emitElementOpenTag::mergeHandlerBodies` folds
 *     same-event listeners into a single
 *     `@click=${($event: Event) => { (f1)($event); (f2)($event); }}`
 *     dispatcher (Lit's html`` tagged template throws "Detected duplicate
 *     attribute bindings" at runtime if the same attribute name appears
 *     twice — same-event merge is mandatory for correctness).
 *   - Mixed (literal + dynamic): literal handlers stay as `@event=${...}`
 *     bindings; the dynamic spread emits as a separate
 *     `${rozieListeners(...)}` element-position binding. The directive's
 *     per-key `addEventListener` calls stack with lit-html's `@event`
 *     directive on the same DOM event, so both fire automatically (NO
 *     runtime `mergeListeners` helper for Lit; same divergence from
 *     React/Solid that Vue/Svelte exhibit).
 *   - Bare `$listeners` + `@click="f1"`: same as the dynamic mixed case —
 *     `@click=${f1} ${rozieListeners($listeners)}` — DOM-level
 *     addEventListener stacking handles all-fire.
 *
 * Cleanup (D-14 — Lit-specific): the `rozieListeners` AsyncDirective's
 * `disconnected()` lifecycle hook removes every attached listener on
 * element disposal (T-15-V5-04 leak defense). This is the load-bearing
 * reason `rozieListeners` extends `AsyncDirective` (NOT regular
 * `Directive` — Pitfall 7 / A2 LOCKED). The Plan 15-07 Lit teardown e2e
 * probe asserts the contract end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitLit(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the `render()` body from the emitted .ts file — the `html\`...\``
 * tagged-template literal returned by render(). We extract the substring
 * between the FIRST `return html\`` and its matching closing backtick.
 *
 * lit-html templates may contain `${...}` interpolations which themselves
 * may contain nested template literals, so a naive scan isn't sufficient.
 * Use a depth counter for nested `${...}` blocks (which open `${` and close
 * `}`) and walk character-by-character.
 */
function extractRenderBody(emitted: string): string {
  const renderStart = emitted.search(/return\s+html`/);
  if (renderStart < 0) return emitted;
  const bodyStart = emitted.indexOf('`', renderStart) + 1;
  let i = bodyStart;
  let depth = 0;
  while (i < emitted.length) {
    const ch = emitted[i]!;
    const next = emitted[i + 1];
    if (ch === '\\') {
      // skip escaped char
      i += 2;
      continue;
    }
    if (ch === '$' && next === '{') {
      depth++;
      i += 2;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth--;
      i++;
      continue;
    }
    if (ch === '`' && depth === 0) {
      break;
    }
    i++;
  }
  return emitted.slice(bodyStart, i);
}

describe('emit (Lit) — ListenerSpreadIR (Plan 15-05 Task 1)', () => {
  // Suppress the synthesized auto-fallthrough so each test isolates the
  // explicit r-on behavior under test.
  const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

  it('(1) literal-only no-merge: r-on="{ click: fn }" → @click=${fn}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ click: fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    // Literal `click` lowered to a native lit-html @click binding.
    expect(body).toContain('@click=');
    expect(body).toContain('this.fn');
    // No runtime helper for the literal path.
    expect(body).not.toContain('rozieListeners');
    expect(code).not.toMatch(/import\s*\{[^}]*\brozieListeners\b/);
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
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    // R6 — single @click binding wrapping BOTH handlers in source order.
    expect(body).toContain('@click=');
    expect(body).toContain('this.f1');
    expect(body).toContain('this.f2');
    // EXACTLY one @click binding — Lit forbids duplicate attribute bindings.
    expect((body.match(/@click=/g) ?? []).length).toBe(1);
    expect(body).not.toContain('rozieListeners');
  });

  it('(3) literal modifier-bearing: r-on="{ \'click.stop\': fn }" → @click=${($event) => { stopPropagation; fn; }}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="{ 'click.stop': fn }">go</button>
</template>
<script>
const fn = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    expect(body).toContain('@click=');
    expect(body).toContain('stopPropagation');
    expect(body).toContain('this.fn');
    expect(body).not.toContain('rozieListeners');
  });

  it('(4) dynamic no-merge: r-on="someObj" → ${rozieListeners(this.someObj)}', () => {
    const src = `${PROLOGUE}
<data>
const someObj = {};
</data>
<template>
  <button r-on="someObj">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    expect(body).toContain('rozieListeners(');
    // Shell threads the import line — exactly once.
    expect(code).toMatch(/import\s*\{[^}]*\brozieListeners\b[^}]*\}\s*from\s*'@rozie\/runtime-lit'/);
    expect(
      (code.match(/import\s*\{[^}]*\brozieListeners\b[^}]*\}\s*from\s*'@rozie\/runtime-lit'/g) ?? [])
        .length,
    ).toBe(1);
  });

  it('(5) dynamic with-merge: @click + r-on dynamic → @click=${f1} ${rozieListeners(...)}', () => {
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
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    expect(body).toContain('@click=');
    expect(body).toContain('this.f1');
    // Dynamic spread emits as a SEPARATE element-position directive — Lit's
    // DOM-level addEventListener stacking handles all-fire.
    expect(body).toContain('rozieListeners(');
    expect(code).toMatch(/import\s*\{[^}]*\brozieListeners\b/);
  });

  it('(6) bare $listeners (D-19 exempt): r-on="$listeners" → ${rozieListeners($listeners)}', () => {
    const src = `${PROLOGUE}
<template>
  <button r-on="$listeners">go</button>
</template>
</rozie>`;
    const code = compile(src);
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    // Bare $listeners — STABLE_IDENTIFIERS passes through unchanged. The
    // directive runs at runtime; obj ?? {} coercion makes undefined a no-op.
    expect(body).toContain('rozieListeners(');
    expect(body).toContain('$listeners');
    expect(code).toMatch(/import\s*\{[^}]*\brozieListeners\b/);
  });

  it('(7) bare $listeners + @click (R6 + D-19): @click=${f1} ${rozieListeners($listeners)}', () => {
    const src = `${PROLOGUE}
<template>
  <button @click="f1" r-on="$listeners">go</button>
</template>
<script>
const f1 = () => undefined;
</script>
</rozie>`;
    const code = compile(src);
    const body = extractRenderBody(code);
    expect(body).toMatchSnapshot();
    expect(body).toContain('@click=');
    expect(body).toContain('this.f1');
    expect(body).toContain('rozieListeners(');
    expect(body).toContain('$listeners');
    expect(code).toMatch(/import\s*\{[^}]*\brozieListeners\b/);
  });
});
