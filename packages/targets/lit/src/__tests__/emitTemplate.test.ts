/**
 * emitTemplate unit tests — Plan 06.4-02 Task 1.
 *
 * Verifies the Lit sigil emission table (see PATTERNS.md):
 *
 *   :prop="expr"            → prop=${expr} (or .prop= for form inputs)
 *   :disabled="cond"        → ?disabled=${cond} (boolean attribute sigil)
 *   @click="fn"             → @click=${fn}
 *   {{ expr }}              → ${expr}
 *   r-for                   → ${repeat(...)}
 *   r-if/r-else             → inline ternary with `nothing` sentinel
 *   composition <Foo/>      → <rozie-foo></rozie-foo>
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('emitTemplate — Lit sigil emission table', () => {
  it('Counter: emits ?disabled=${...} for boolean attribute binding', () => {
    const code = compile('Counter');
    expect(code).toContain('?disabled=${');
  });

  it('Counter: emits @click=${this.method} for event handlers', () => {
    const code = compile('Counter');
    expect(code).toMatch(/@click=\$\{this\.(increment|decrement)\}/);
  });

  it('Counter: emits ${...} for {{ }} interpolation', () => {
    const code = compile('Counter');
    expect(code).toContain('${this.value}');
  });

  it('SearchInput: emits .value=${...} property binding on form input', () => {
    const code = compile('SearchInput');
    expect(code).toMatch(/\.value=\$\{this\._query\.value\}/);
  });

  it('TodoList: emits ${repeat<any>(...)} for r-for', () => {
    const code = compile('TodoList');
    // Explicit `<any>` type arg added 2026-05-18 to satisfy tsc when the
    // iterable is typed `any` (rozie prop type `Object` lowers to TS `any`,
    // which can't infer `repeat<T>`'s element type — defaults to `unknown`).
    expect(code).toContain('repeat<any>(');
    expect(code).toContain("from 'lit/directives/repeat.js'");
  });

  it('TodoList: emits inline ternary with `nothing` for r-if/r-else', () => {
    const code = compile('Dropdown');
    expect(code).toContain('? html`');
    expect(code).toContain(': nothing');
    expect(code).toContain("import { LitElement, css, html, nothing } from 'lit';");
  });

  it('Card: emits <rozie-foo> tag for composition <Foo>', () => {
    const code = compile('Card');
    expect(code).toContain('<rozie-card-header');
  });

  it('TreeNode: emits <rozie-tree-node> for self-reference (NO extra import)', () => {
    const code = compile('TreeNode');
    expect(code).toContain('<rozie-tree-node');
    expect(code).not.toContain("import './TreeNode.rozie';");
  });
});

describe('dispatchEvent translation (Phase 07.3.1 D-LIT-17)', () => {
  /**
   * D-LIT-17 — function-typed slot params (e.g. `close`) can't cross the
   * `data-rozie-params` JSON transport (JSON.stringify drops function values).
   * The producer emits a matching `@rozie-<slot>-<param>` binding directly on
   * the producer's `<slot>` element (Phase 07.4 D-LIT-12 — replaces the
   * previous host-scope `addEventListener` path so loop-local `r-for`
   * iteration variables are captured naturally). The consumer must dispatch a
   * matching CustomEvent instead of trying to invoke the (always-undefined)
   * function captured into `this._<slot>Ctx`.
   *
   * Detection at buildEventParts matches the EXACT shape
   * `this._<X>Ctx?.<param>` (anchored, no surrounding wrap, no member-chain
   * continuation, no call expression). Composite expressions fall through to
   * the Plan 03 late-binding wrap (which preserves data-typed param semantics).
   */
  function compileConsumer(source: string, name = 'TestConsumer'): string {
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

  it('emits dispatchEvent for exact-shape this._headerCtx?.close handler', () => {
    const source = `<rozie name="HeaderCloseConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <h2>Title</h2>
      <button @click="close">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'HeaderCloseConsumer');
    // WR-06 (Phase 07.4 review): split the previous monolithic toContain into
    // orthogonal regex assertions — each tests one semantic property so the
    // failure points at one root cause when the emitter is tweaked.
    expect(code).toMatch(/@click=\$\{\(\$event\)\s*=>/); // handler wired on @click
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\(/); // dispatch path used
    expect(code).toMatch(/'rozie-header-close'/); // event name correct
    expect(code).toMatch(/bubbles:\s*true/); // bubble flag set
    expect(code).toMatch(/composed:\s*true/); // shadow-crossing flag set
    expect(code).toMatch(/detail:\s*e\b/); // original event in detail
    // The old late-binding wrap MUST NOT appear at the dispatch site — that
    // was the broken path (function ref always undefined through JSON).
    expect(code).not.toMatch(/\(this\._headerCtx\?\.close\)\?\.\(\$event\)/);
  });

  it('emits dispatchEvent with correct event-name kebab format for footer slot toggle param', () => {
    const source = `<rozie name="FooterToggleConsumer">

<components>
{
  Drawer: './Drawer.rozie',
}
</components>

<template>
  <Drawer>
    <template #footer="{ toggle }">
      <button @click="toggle">⇆</button>
    </template>
  </Drawer>
</template>
`;
    const code = compileConsumer(source, 'FooterToggleConsumer');
    // WR-06 (Phase 07.4 review): orthogonal regex assertions for the
    // footer-toggle dispatch shape — see HeaderCloseConsumer test above
    // for rationale.
    expect(code).toMatch(/@click=\$\{\(\$event\)\s*=>/);
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\(/);
    expect(code).toMatch(/'rozie-footer-toggle'/);
    expect(code).toMatch(/bubbles:\s*true/);
    expect(code).toMatch(/composed:\s*true/);
  });

  it('falls back to late-binding wrap for non-bare ctx reference (member chain)', () => {
    // A handler expression that references a ctx field via deeper member
    // access (e.g., `close.bind(this)`) is NOT a bare `this._<X>Ctx?.<param>`
    // shape. The dispatchEvent detection regex (anchored `^...$`) refuses
    // to match; the Plan 03 late-binding wrap takes over so the underlying
    // optional-chain still resolves correctly at click time.
    const source = `<rozie name="MemberChainConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <button @click="close.call(this)">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'MemberChainConsumer');
    // The dispatchEvent shape MUST NOT appear for the non-bare handler.
    expect(code).not.toMatch(
      /dispatchEvent\(new CustomEvent\('rozie-header-close'/,
    );
    // The Plan 03 late-binding wrap MUST appear because the handler still
    // contains a `this._<X>Ctx?.` reference somewhere in its body.
    expect(code).toMatch(/\(\$event\) => \(.*this\._headerCtx\?\.close/);
  });

  it('does not affect non-ctx handlers', () => {
    // A handler that references a component method (no `_<X>Ctx?.` shape)
    // MUST NOT be wrapped at all — emit the bare reference for Lit's
    // built-in handler binding.
    const source = `<rozie name="NonCtxConsumer">

<script>
function onConfirm() {}
</script>

<template>
  <button @click="onConfirm">Confirm</button>
</template>
`;
    const code = compileConsumer(source, 'NonCtxConsumer');
    expect(code).toMatch(/@click=\$\{this\.onConfirm\}/);
    // No dispatchEvent translation for the click handler (the @customElement
    // decorator legitimately contains 'rozie-non-ctx-consumer' — exclude it
    // by checking the click-handler context specifically rather than the
    // whole emitted file).
    expect(code).not.toMatch(/dispatchEvent\(new CustomEvent\('rozie-/);
    // No late-binding wrap
    expect(code).not.toMatch(/\(\$event\) => \(this\.onConfirm\)\?\.\(\$event\)/);
  });
});

describe('multi-root slot-fill spread (Phase 07.3.1 D-LIT-18)', () => {
  /**
   * D-LIT-18 — when a named-slot fill body has multiple top-level elements
   * separated only by whitespace, the consumer emitter MUST inject
   * `slot="<name>"` into each opening tag rather than wrapping the body in
   * a synthetic `<div slot="<name>">`. The producer's shadow-DOM
   * `<slot name="<name>">` then receives each child element directly,
   * matching the consumer-authored DOM structure.
   *
   * Fall-back to the `<div>` wrap is preserved when the body contains
   * non-whitespace top-level text, a top-level `${...}` interpolation,
   * a top-level HTML comment, or any element already carrying a `slot=`
   * attribute — those cases are structurally ambiguous and the wrap
   * keeps semantics conservative.
   *
   * Single-root passthrough (the original Phase 07.2 optimization) is
   * unchanged; this only adds an intermediate path between "single-root
   * passthrough" and "wrap in <div>".
   */
  function compileConsumer(source: string, name = 'TestConsumer'): string {
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

  it('multi-root scoped fill spreads slot= across each top-level element (no div-wrap)', () => {
    // Source mirrors the canonical Modal #header fill pattern: an <h2>
    // and a <button> as top-level children, with the <button> handler
    // referencing the scoped param `close`.
    const source = `<rozie name="MultiRootScopedConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <h2>Title</h2>
      <button @click="close">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'MultiRootScopedConsumer');
    // Each top-level element bears `slot="header"`. The <h2> picks it up
    // as the only attribute; the <button> picks it up after its existing
    // `@click=${...}` handler binding (which under D-LIT-17 expands to a
    // dispatchEvent call, so the button tag is long).
    // WR-06 (Phase 07.4 review): orthogonal regex assertions rather than
    // one monolithic literal — each tests one semantic property.
    // Phase 07.6 — `data-rozie-s-<hash>` scope stamp now precedes `slot=`
    // on every producer-template HTML element, so the assertion is now
    // attribute-order-tolerant.
    expect(code).toMatch(/<h2[^>]*slot="header"[^>]*>Title<\/h2>/);
    // The <button> must exist with @click + slot="header" spread (D-LIT-18).
    expect(code).toMatch(/<button[^>]*@click=\$\{\(\$event\)\s*=>[^>]*slot="header"[^>]*>×<\/button>/);
    // And the @click handler must dispatch the rozie-header-close event.
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\('rozie-header-close'/);
    expect(code).toMatch(/bubbles:\s*true/);
    expect(code).toMatch(/composed:\s*true/);
    // The wrap MUST be absent for this body — top-level children are
    // separated only by whitespace, which is the D-LIT-18 spread path.
    // Anchor to the slot="header" wrap shape specifically; do NOT use a
    // broader `/<div slot=/` match because the dynamic-name R5 path
    // legitimately emits `<div slot="${expr}">` and a future test in
    // the file could trip the broader assertion.
    expect(code).not.toContain('<div slot="header">');
  });

  it('multi-root non-scoped fill spreads slot= across each top-level element (no div-wrap)', () => {
    // Static (non-scoped) named fill with two top-level elements. The
    // <img> is self-closing; D-LIT-18 must inject `slot=` BEFORE the
    // `/>` rather than after.
    const source = `<rozie name="MultiRootStaticConsumer">

<components>
{
  Card: './Card.rozie',
}
</components>

<template>
  <Card>
    <template #brand>
      <img src="/logo.svg"/>
      <span class="brand-name">Acme</span>
    </template>
  </Card>
</template>
`;
    const code = compileConsumer(source, 'MultiRootStaticConsumer');
    // Self-closing <img> — `slot="brand"` lands before the trailing
    // ` />` (the template emitter normalizes self-close tags with a
    // space before the `/`; D-LIT-18 walks back over that whitespace
    // so the inserted attribute lands flush with the previous one).
    // Phase 07.6 — scope-stamp is now part of the attribute sequence.
    expect(code).toMatch(/<img[^>]*src="\/logo\.svg"[^>]*slot="brand"[^>]*\/>/);
    // Non-self-closing <span> — `slot="brand"` lands before the `>`.
    expect(code).toMatch(/<span[^>]*class="brand-name"[^>]*slot="brand"[^>]*>Acme<\/span>/);
    // No `<div slot="brand">` wrap.
    expect(code).not.toContain('<div slot="brand">');
  });

  it('falls back to <div slot=> wrap when top-level text is present between elements', () => {
    // Inline text between elements means the consumer wants that text
    // to project into the named slot too. Spreading `slot=` onto the
    // elements would leak the text into the parent's default slot. The
    // emitter conservatively falls back to the existing wrap.
    const source = `<rozie name="MultiRootWithTextConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <h2>Title</h2>
      Inline interstitial text
      <button @click="close">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'MultiRootWithTextConsumer');
    // The wrap must be present.
    expect(code).toContain('<div slot="header">');
    // The wrap must close at the same level.
    expect(code).toMatch(/<\/div>(?:\s|<\/rozie-modal>)/);
    // No spread of `slot="header"` onto the <h2> or <button> — those
    // would clash with the wrap-based projection.
    expect(code).not.toContain('<h2 slot="header">');
    expect(code).not.toMatch(/<button[^>]*slot="header"/);
  });

  it('single-root passthrough is unaffected (D-LIT-18 is purely an additive cascade tier)', () => {
    // Regression guard. The single-element passthrough (`<h2 slot="<name>">`
    // direct) predates D-LIT-18 and must keep working.
    const source = `<rozie name="SingleRootConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header>
      <h2>Just one</h2>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'SingleRootConsumer');
    // Phase 07.6 — scope-stamp precedes slot=.
    expect(code).toMatch(/<h2[^>]*slot="header"[^>]*>Just one<\/h2>/);
    expect(code).not.toContain('<div slot="header">');
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 01 Task 2 — producer `part="body"` passthrough (SPEC-R3).
//
// A producer-authored static `part="..."` attribute must survive verbatim
// into the Lit shadow template so a consumer's `::part(body)` rule can pierce
// the child's shadow boundary and address the element. `part` is a standard
// HTML static attribute and flows through the static-attr branch
// (emitTemplate.ts:355-358) with no allowlist or transform. The part name is
// the LITERAL `body` — never scope-hashed (SPEC-R6).
// ---------------------------------------------------------------------------
describe('part= passthrough (SPEC-R3/R4b)', () => {
  function compileInline(source: string, name = 'PartProducer'): string {
    const { ast } = parse(source, { filename: `${name}.rozie` });
    if (!ast) throw new Error('parse() returned null');
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast, { modifierRegistry: registry });
    if (!ir) throw new Error('lowerToIR() returned null');
    ir.name = name;
    return emitLit(ir, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
  }

  const PRODUCER = `<rozie name="PartProducer">
<template>
<div class="card-body" part="body">
  <slot/>
</div>
</template>
</rozie>
`;

  it('emits the producer part="body" attribute verbatim into the Lit shadow template', () => {
    const code = compileInline(PRODUCER);
    expect(code).toContain('part="body"');
  });

  it('does NOT scope-hash the part name (literal `body`, SPEC-R6)', () => {
    const code = compileInline(PRODUCER);
    // The part name itself must never carry a data-rozie-s hash suffix.
    expect(code).not.toMatch(/part="body-rozie-s/);
    expect(code).not.toMatch(/part="[^"]*data-rozie-s[^"]*"/);
  });
});
