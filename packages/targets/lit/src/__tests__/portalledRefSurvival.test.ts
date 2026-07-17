// command-palette-portal-through-portal cluster (BUG A) — a component with at
// least one `r-portal` element can relocate an ANCESTOR subtree out of
// `this.renderRoot` (RoziePortalController's `appendChild`) at runtime. Any
// plain author `ref="x"` living INSIDE that relocated subtree (on a native
// element OR on a `<components>`-composed child) was compiled to an UNCACHED,
// renderRoot-scoped `@query('[data-rozie-ref="x"]')` — a query that
// PERMANENTLY returns null once the node is relocated out of renderRoot, even
// though the node is still live and connected (just parked in the portal's
// container).
//
// Confirmed live: @rozie-ui/command-palette's `$refs.panel`/`$refs.frame`/
// `$refs.combobox` all silently no-op once `appendTo` portals the panel —
// goBack()'s seedQuery() never runs (the restored query text never lands),
// reopenComboboxPopup()'s focus() never runs (the popup never reopens, deepest
// focus falls to `<body>`), and the action-menu focus arbitration breaks too.
//
// A naive "cache the first successful query result" fix does NOT work either
// (tried and eliminated live — see the debug session's Eliminated log):
// `RoziePortalController.hostUpdated()` relocates the node SYNCHRONOUSLY,
// strictly BEFORE the component's own `firstUpdated()`/`updated()`, so the
// very first render with the portal already active never gives consumer code
// a chance to observe the pre-relocation position even once.
//
// Fix: when a component has ANY `r-portal` element anywhere in its template,
// every `ref="x"` field compiles to a getter that tries the fresh, uncached
// `@query` FIRST (so a close→reopen recreate is always observed with the NEW
// node) and delegates the fallback to `rozieResolvePortalledRef`
// (`@rozie/runtime-lit`), which searches WITHIN the LIVE relocated subtree of
// this instance's own `RoziePortalController`(s) — always in sync, no
// caching/staleness risk. Components with NO `r-portal` element (the
// overwhelming majority) stay byte-identical to the plain `@query` field.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

function compile(src: string): string {
  const result = parse(src, { filename: 'PortalRef.rozie' });
  if (!result.ast) {
    throw new Error(`parse() null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitLit(ir, { filename: 'PortalRef.rozie', source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return code;
}

// A `ref="panel"` element sits INSIDE the SAME conditional subtree as an
// `r-portal` element on a sibling (the shape command-palette actually has:
// the portal target and the author refs are siblings/descendants under one
// shared `r-if` root) — this component HAS an r-portal element anywhere in
// its template, which is the (deliberately coarse, component-level) gate.
const SRC_WITH_PORTAL = `<rozie name="PortalRefWithPortal">
<script>
function target() { return document.body }
const grab = () => { return $refs.panel }
</script>
<template>
<div>
  <div ref="panel">panel content</div>
  <div r-portal="target()">teleported</div>
</div>
</template>
</rozie>
`;

// No r-portal anywhere — the byte-identical-today path.
const SRC_NO_PORTAL = `<rozie name="PortalRefNoPortal">
<script>
const grab = () => { return $refs.panel }
</script>
<template>
<div>
  <div ref="panel">panel content</div>
</div>
</template>
</rozie>
`;

describe('emitLit — author refs survive r-portal relocation (BUG A)', () => {
  it('a ref inside a component that HAS an r-portal element compiles to a rozieResolvePortalledRef-backed getter, not a plain @query field', () => {
    const code = compile(SRC_WITH_PORTAL);
    // The RAW uncached @query field still exists (the fresh-probe fast path),
    // renamed off the public `_refPanel` name so the getter below can own it.
    expect(code).toMatch(/@query\('\[data-rozie-ref="panel"\]'\) private __rozieRawRefPanel!: HTMLElement;/);
    // The PUBLIC-shaped accessor (`_refPanel`, what every call site reads) is
    // now a GETTER, not a plain field — delegating to the runtime helper.
    expect(code).toMatch(/private get _refPanel\(\): HTMLElement \{/);
    expect(code).toMatch(/rozieResolvePortalledRef\(this, '\[data-rozie-ref="panel"\]', this\.__rozieRawRefPanel\)/);
    // The runtime import is registered.
    expect(code).toMatch(/import \{[^}]*rozieResolvePortalledRef[^}]*\} from '@rozie\/runtime-lit';/);
    // The original bare-field shape must NOT appear for this ref.
    expect(code).not.toMatch(/@query\('\[data-rozie-ref="panel"\]'\) private _refPanel!: HTMLElement;/);
  });

  it('a ref inside a component with NO r-portal element stays the plain, byte-identical uncached @query field', () => {
    const code = compile(SRC_NO_PORTAL);
    expect(code).toMatch(/@query\('\[data-rozie-ref="panel"\]'\) private _refPanel!: HTMLElement;/);
    expect(code).not.toMatch(/__rozieRawRefPanel/);
    expect(code).not.toMatch(/rozieResolvePortalledRef/);
  });
});
