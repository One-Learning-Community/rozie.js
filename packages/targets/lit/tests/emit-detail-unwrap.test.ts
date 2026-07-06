// Phase 73 Plan 04 — emitter-hardening backlog #6 (Lit component `@emit`
// `.detail` unwrap gate).
//
// CONTEXT: `buildEventParts` (emitTemplate.ts) unwraps `CustomEvent.detail`
// for a listener bound on a `tagKind === 'component'` tag, so a Lit
// consumer's handler sees the emitted payload as arg0 directly — matching
// the cross-target `$emit` contract (React callback arg, Vue emit arg,
// authoring playbook §5: "the handler receives the payload OBJECT as arg0
// directly ... It is NOT a wrapped CustomEvent").
//
// PREMISE CONFIRMED RED (not falsified): the pre-73-04 gate additionally
// required `!isNativeDomEvent(eventName)` — so a component `$emit`ing a
// payload under a name that ALSO happens to be a real native-DOM-event name
// (`change`, `click`, `load`, `focus`, `blur`, `error`, `select`, `drag`,
// `resize`, ...) stayed WRAPPED on Lit only, while all 5 other targets
// (which have no "raw DOM event" concept for a component's own emit — see
// React's `EVENT_NAME_TO_JSX_PROP`, used only for JSX prop-naming, never for
// a detail-unwrap decision) delivered the CustomEvent itself, unwrapped.
// Verified against the shipped corpus: `@rozie-ui/pagination` +
// `@rozie-ui/switch` + `@rozie-ui/number-field` all `$emit('change', ...)`;
// `@rozie-ui/pdf` `$emit('load', ...)`; `@rozie-ui/popover` `$emit('change',
// <bare boolean>)` — each forced an author-side
// `e.x == null && e.detail ? e.detail : e` fallback in its VR behavioral demo
// (examples/demos/{Pagination,Switch,NumberField,Popover}BehaviorDemo.rozie,
// PdfViewerDemo.rozie) purely to compensate for the Lit-only wrapped form.
// Those workarounds are deleted in this plan.
//
// FIX SHAPE — NOT a blanket "always unwrap for tagKind===component": a
// simple "remove the name-based denylist" fix was tried FIRST and caught by
// this plan's own dist-parity rebless — `examples/ThemedButtonConsumer.rozie`
// (R4 auto-fallthrough dogfood) binds `@click`/`@mouseenter` directly on a
// `<ThemedButton>` tag that does NOT itself `$emit` those names; the
// undeclared consumer listener auto-falls-through onto the child's
// forwarded `$listeners`, which Lit attaches to a REAL internal DOM element
// — so a REAL native `MouseEvent` (no `.detail`) bubbles through the shadow
// boundary to this exact listener. A `tagKind === 'component'` listener is
// therefore genuinely ambiguous by NAME ALONE (same name can be either a
// real `$emit` or a real native-event fallthrough) — the fix instead
// resolves the ambiguity at RUNTIME via `$event instanceof CustomEvent`
// (every `$emit` / model `<prop>-change` dispatch is unconditionally a real
// `CustomEvent`; a native/fallthrough DOM event never is).
import { describe, it, expect, vi } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../src/emitLit.js';

function compile(source: string, name: string): string {
  const { ast } = parse(source, { filename: `${name}.rozie` });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  ir.name = name;
  return emitLit(ir, {
    filename: `${name}.rozie`,
    source,
    modifierRegistry: registry,
  }).code;
}

/**
 * Extracts the arrow-function SOURCE bound to `@<eventName>=${...}` out of
 * the emitted `render()` template literal, so it can be evaluated directly
 * (the surrounding emitted class uses TS decorators/generics that happy-dom
 * + plain `new Function` can't parse — mirrors the existing
 * `sc2-parent-flip.test.ts` runtime-invariant approach: test the exact
 * runtime shape the emitter produces, not the whole compiled class).
 */
function extractHandlerSource(code: string, eventName: string): string {
  const marker = `@${eventName}=\${`;
  const start = code.indexOf(marker);
  if (start === -1) {
    throw new Error(`marker ${JSON.stringify(marker)} not found in:\n${code}`);
  }
  const exprStart = start + marker.length;
  // Balanced-brace scan to find the matching `}` that closes the `${...}`.
  let depth = 1;
  let i = exprStart;
  for (; i < code.length && depth > 0; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
  }
  return code.slice(exprStart, i - 1);
}

/**
 * Strips the specific TS-only syntax this emitter's `unwrapDetail` branch
 * produces (param type annotations + the permissive-signature cast) so the
 * extracted arrow source is valid PLAIN JS for `new Function`. Targeted,
 * not a general TS stripper — the exact two shapes are already locked by
 * the static-shape assertions above.
 */
function stripTsForEval(src: string): string {
  return src
    .replace(/\$event: Event/g, '$event')
    .replace(/__rozieEv: Event/g, '__rozieEv')
    .replace(/ as \(\.\.\.args: any\[\]\) => any/g, '');
}

// A native-DOM-event-colliding component emit name ('change') consumed via a
// bare handler reference.
const CHANGE_SRC = `<rozie name="ChangeConsumer">

<components>
{
  Widget: './Widget.rozie',
}
</components>

<script>
function onChange(payload) { console.log(payload); }
</script>

<template>
  <Widget @change="onChange" />
</template>
`;

// A different native-colliding name ('load'), plus an inline expression
// handler (not a bare reference) referencing $event — the other unwrap
// branch in buildEventParts.
const LOAD_SRC = `<rozie name="LoadConsumer">

<components>
{
  Widget: './Widget.rozie',
}
</components>

<data>
{ total: 0 }
</data>

<template>
  <Widget @load="$data.total = $event.numPages" />
</template>
`;

// A non-colliding hyphenated custom emit name — must stay unwrapped exactly
// as before (zero-drift control case).
const NODE_ACTION_SRC = `<rozie name="NodeActionConsumer">

<components>
{
  Widget: './Widget.rozie',
}
</components>

<script>
function onNodeAction(payload) { console.log(payload); }
</script>

<template>
  <Widget @node-action="onNodeAction" />
</template>
`;

// A REAL native DOM event on a plain HTML element (tagKind === 'html') —
// must NEVER route through the instanceof-CustomEvent unwrap; there is no
// ambiguity for a real HTML tag at all.
const HTML_CLICK_SRC = `<rozie name="HtmlClickConsumer">

<script>
function onClick() {}
</script>

<template>
  <button @click="onClick">Go</button>
</template>
`;

// Mirrors ThemedButtonConsumer's R4 auto-fallthrough shape: an undeclared
// consumer listener on a component tag that does NOT itself $emit that name.
const FALLTHROUGH_CLICK_SRC = `<rozie name="FallthroughClickConsumer">

<components>
{
  Widget: './Widget.rozie',
}
</components>

<script>
function onClick(e) { return e; }
</script>

<template>
  <Widget @click="onClick" />
</template>
`;

describe('Lit component @emit .detail unwrap — native-event-name collision (backlog #6)', () => {
  it('unwraps .detail for a component emit named "change" (collides with the native DOM change event) — static shape', () => {
    const code = compile(CHANGE_SRC, 'ChangeConsumer');
    expect(code).toMatch(
      /@change=\$\{\(\$event: Event\) => \(\(this\.onChange\) as \(\.\.\.args: any\[\]\) => any\)\(\$event instanceof CustomEvent \? \$event\.detail : \$event\)\}/,
    );
    // Must NOT bind the bare (always-wrapped, ambiguity-blind) form.
    expect(code).not.toMatch(/@change=\$\{this\.onChange\}/);
  });

  it('unwraps .detail for a component emit named "load" (collides with the native DOM load event), inline-expression form — static shape', () => {
    const code = compile(LOAD_SRC, 'LoadConsumer');
    expect(code).toMatch(/@load=\$\{\(__rozieEv: Event\) => \{/);
    expect(code).toContain(
      'const $event = __rozieEv instanceof CustomEvent ? __rozieEv.detail : __rozieEv;',
    );
    expect(code).toContain('this._total.value = $event.numPages');
  });

  it('control: a non-colliding hyphenated component emit ("node-action") uses the same instanceof-guarded unwrap (zero-drift in outcome, not literal bytes)', () => {
    const code = compile(NODE_ACTION_SRC, 'NodeActionConsumer');
    expect(code).toMatch(
      /@node-action=\$\{\(\$event: Event\) => \(\(this\.onNodeAction\) as \(\.\.\.args: any\[\]\) => any\)\(\$event instanceof CustomEvent \? \$event\.detail : \$event\)\}/,
    );
  });

  it('control: a real native DOM event on a plain HTML element (tagKind=html) is NEVER routed through the instanceof-CustomEvent unwrap', () => {
    const code = compile(HTML_CLICK_SRC, 'HtmlClickConsumer');
    expect(code).toMatch(/@click=\$\{this\.onClick\}/);
    expect(code).not.toContain('instanceof CustomEvent');
  });

  describe('runtime behavior — instanceof CustomEvent decides the unwrap at dispatch time', () => {
    it('a real $emit CustomEvent payload reaches the handler as arg0 (name collides with native "change")', () => {
      const code = compile(CHANGE_SRC, 'ChangeConsumer');
      const src = stripTsForEval(extractHandlerSource(code, 'change'));
      // eslint-disable-next-line no-new-func -- evaluating the emitter's own generated arrow source (plain-JS-ified) is the point of this test.
      const outerFactory = new Function(`return (function () { return (${src}); });`);
      const onChange = vi.fn();
      const handler = outerFactory().call({ onChange });
      const payload = { page: 3 };
      const customEvent = new CustomEvent('change', { detail: payload });
      handler(customEvent);
      expect(onChange).toHaveBeenCalledWith(payload);
    });

    it('a REAL native DOM event on the same component-tag @click binding (ThemedButtonConsumer R4 auto-fallthrough shape) reaches the handler AS-IS, not undefined', () => {
      const code = compile(FALLTHROUGH_CLICK_SRC, 'FallthroughClickConsumer');
      const src = stripTsForEval(extractHandlerSource(code, 'click'));
      // eslint-disable-next-line no-new-func -- evaluating the emitter's own generated arrow source (plain-JS-ified) is the point of this test.
      const outerFactory = new Function(`return (function () { return (${src}); });`);
      const onClick = vi.fn((e: unknown) => e);
      const handler = outerFactory().call({ onClick });
      // A genuine native click event — NOT a CustomEvent, has no .detail.
      const nativeEvent = new MouseEvent('click');
      const result = handler(nativeEvent);
      // The raw event must reach the handler unmodified — NOT undefined
      // (which is what `.detail` would have produced on a real MouseEvent).
      expect(onClick).toHaveBeenCalledWith(nativeEvent);
      expect(result).toBe(nativeEvent);
    });
  });
});
