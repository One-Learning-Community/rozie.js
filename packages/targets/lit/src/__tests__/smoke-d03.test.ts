/**
 * Smoke test for Phase 07.3.1 Blocker #3 (D-03) — verify the new emit
 * shape for consumer-side scoped slot fills:
 *   - dispatchEvent translation on EXACT-shape `this._<X>Ctx?.<method>` (D-LIT-17)
 *   - `_slotCtxWired_<name>` class field
 *   - `tryWire` + `queueMicrotask` retry in `_armListeners()`
 *   - `updated()` re-attempt body
 *   - `disconnectedCallback()` flag reset (Landmine 2)
 *
 * NOTE (Phase 07.3.1 D-LIT-17): the bare-identifier event-handler case
 * `@click="<param>"` (which rewrites to `this._<X>Ctx?.<param>`) was previously
 * emitted as a Plan 03 late-binding wrap `(e) => (this._<X>Ctx?.<param>)?.(e)`.
 * That path was a no-op for function-typed params (JSON.stringify drops
 * functions across `data-rozie-params`). The fix translates the exact shape
 * to a dispatchEvent that the producer's `@rozie-<slot>-<param>` binding on
 * its `<slot>` element receives (Phase 07.4 D-LIT-12 — replaces the previous
 * host-scope `addEventListener` path). The late-binding wrap is RETAINED as a
 * fall-through for composite expressions and data-typed param references
 * (e.g., `r-if="open"` reading a data-typed param).
 *
 * This file is a temporary smoke fixture — it compiles a synthetic
 * consumer-side .rozie source and asserts the emit shape. It is NOT
 * intended to lock as a snapshot fixture; the per-package snap-locked
 * fixtures are producer-only (examples/{Modal,Dropdown,TodoList}.rozie).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const CONSUMER_SOURCE = `<rozie name="TestConsumer">

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

function compileConsumer(): string {
  const { ast } = parse(CONSUMER_SOURCE, { filename: 'TestConsumer.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  ir.name = 'TestConsumer';
  const { code } = emitLit(ir, {
    filename: 'TestConsumer.rozie',
    source: CONSUMER_SOURCE,
    modifierRegistry: registry,
  });
  return code;
}

describe('Phase 07.3.1 Blocker #3 (D-03) — Lit consumer-side scoped slot fill emit', () => {
  it('emits dispatchEvent for exact-shape scoped-ctx handler (D-LIT-17)', () => {
    // Phase 07.3.1 D-LIT-17 — the bare-identifier `@click="close"` rewrites
    // to `this._headerCtx?.close` (via emitSlotFiller's rewriteScopedParamRefs),
    // which buildEventParts now translates to a dispatchEvent that the
    // producer's host-listener wiring receives. The Plan 03 late-binding
    // wrap is bypassed for this exact shape — it was a no-op anyway because
    // JSON.stringify drops the function value through data-rozie-params.
    const code = compileConsumer();
    // WR-06 (Phase 07.4 review): orthogonal regex assertions in place of the
    // previous monolithic literal — one assertion per semantic property so
    // failures point at one root cause when the emitter is tweaked.
    expect(code).toMatch(/@click=\$\{\(\$event\)\s*=>/);
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\(/);
    expect(code).toMatch(/'rozie-header-close'/);
    expect(code).toMatch(/bubbles:\s*true/);
    expect(code).toMatch(/composed:\s*true/);
    // The old late-binding wrap MUST NOT appear at the dispatch site.
    expect(code).not.toMatch(/\(this\._headerCtx\?\.close\)\?\.\(\$event\)/);
  });

  it('declares per-filler _slotCtxWired_<name> class field', () => {
    const code = compileConsumer();
    expect(code).toContain('private _slotCtxWired_header = false;');
  });

  it('spreads slot="header" across multi-root fill body instead of div-wrap (D-LIT-18)', () => {
    // The CONSUMER_SOURCE fixture has two top-level children inside the
    // `#header` fill (`<h2>Title</h2>` and `<button @click="close">×</button>`).
    // D-LIT-18 routes this through the multi-root spread path: each
    // top-level element bears `slot="header"` directly, and no synthetic
    // `<div slot="header">` wrapper appears. The button's @click handler
    // is the D-LIT-17 dispatchEvent shape (the bare `close` rewrites to
    // `this._headerCtx?.close`, which dispatches `rozie-header-close`).
    const code = compileConsumer();
    // WR-06 (Phase 07.4 review): orthogonal regex assertions in place of the
    // previous monolithic button-tag literal — one assertion per semantic
    // property so failures point at one root cause.
    // Phase 07.6 — data-rozie-s-<hash> scope stamp precedes slot=.
    expect(code).toMatch(/<h2[^>]*slot="header"[^>]*>Title<\/h2>/);
    // Button exists with @click + slot="header" spread (D-LIT-18).
    expect(code).toMatch(/<button[^>]*@click=\$\{\(\$event\)\s*=>[^>]*slot="header"[^>]*>×<\/button>/);
    // Dispatch shape + event name asserted independently.
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\('rozie-header-close'/);
    expect(code).toMatch(/bubbles:\s*true/);
    expect(code).toMatch(/composed:\s*true/);
    expect(code).not.toContain('<div slot="header">');
  });

  it('emits tryWire wrapper with queueMicrotask retry in _armListeners()', () => {
    const code = compileConsumer();
    expect(code).toContain('const tryWire = () =>');
    expect(code).toContain('this._slotCtxWired_header = true;');
    expect(code).toContain('queueMicrotask(() => { if (!this._slotCtxWired_header) tryWire(); });');
  });

  it('emits updated() re-attempt body guarded by wired flag (Race B fix)', () => {
    const code = compileConsumer();
    expect(code).toMatch(/updated\(changedProperties: Map<string, unknown>\): void \{/);
    expect(code).toMatch(/if \(!this\._slotCtxWired_header\) \{/);
  });

  it('emits disconnectedCallback() flag reset (Landmine 2)', () => {
    const code = compileConsumer();
    // The reset MUST appear inside disconnectedCallback after the
    // _disconnectCleanups drain.
    const disconnectMatch = code.match(/disconnectedCallback\(\): void \{[\s\S]*?\n  \}/);
    expect(disconnectMatch).not.toBeNull();
    expect(disconnectMatch![0]).toContain('this._slotCtxWired_header = false;');
    // Must come AFTER `_disconnectCleanups = [];`
    const body = disconnectMatch![0];
    const drainIdx = body.indexOf('this._disconnectCleanups = []');
    const resetIdx = body.indexOf('this._slotCtxWired_header = false;');
    expect(drainIdx).toBeGreaterThan(0);
    expect(resetIdx).toBeGreaterThan(drainIdx);
  });

  it('does NOT wrap non-scoped-ctx event handlers (Landmine 3 — no false positives)', () => {
    // Build a small consumer that has a normal `this.someMethod` handler
    // alongside the scoped-ctx handler. The plain method handler must
    // remain as `@click=${this.handleSomething}` shape — NOT wrapped.
    const src = `<rozie name="TestConsumer2">
<script>
function handleClick() {}
</script>
<components>
{
  Modal: './Modal.rozie',
}
</components>
<template>
  <button @click="handleClick">Plain</button>
  <Modal>
    <template #header="{ close }">
      <button @click="close">×</button>
    </template>
  </Modal>
</template>
`;
    const { ast } = parse(src, { filename: 'TestConsumer2.rozie' });
    if (!ast) throw new Error('parse() returned null');
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast, { modifierRegistry: registry });
    if (!ir) throw new Error('lowerToIR() returned null');
    ir.name = 'TestConsumer2';
    const { code } = emitLit(ir, {
      filename: 'TestConsumer2.rozie',
      source: src,
      modifierRegistry: registry,
    });
    // Plain handler — NOT wrapped.
    expect(code).toMatch(/@click=\$\{this\.handleClick\}/);
    // Scoped-ctx handler — D-LIT-17 dispatchEvent translation.
    // WR-06 (Phase 07.4 review): orthogonal regex assertions per semantic
    // property in place of the previous monolithic literal.
    expect(code).toMatch(/@click=\$\{\(\$event\)\s*=>/);
    expect(code).toMatch(/dispatchEvent\(new CustomEvent\(/);
    expect(code).toMatch(/'rozie-header-close'/);
    expect(code).toMatch(/bubbles:\s*true/);
    expect(code).toMatch(/composed:\s*true/);
  });
});
