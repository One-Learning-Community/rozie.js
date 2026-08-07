/**
 * `$slotted.<name>` — Lit target (quick 260807-cor, D4).
 *
 * Lit is the ONE target where the sigil is live: it resolves the light-DOM
 * elements currently assigned to a slot ACROSS the shadow boundary
 * (`assignedElements()`), reactively, via a preact-signal field maintained
 * inside the existing slotchange `update()` closure and pre-seeded in
 * `connectedCallback()` beside the existing `_hasSlot<X>` presence pre-seed.
 *
 * `EngineQueryDefaultSlot` is the D4-scoped GENERALITY PROOF fixture: a
 * single default `<slot />`, an `$onMount` that records the assigned-element
 * count, and a `$watch` over `$slotted.default.length` — deliberately
 * sharing NO structure with embla (no `r-for`, no named slots), proving the
 * primitive is general rather than over-fitted to the Carousel adoption.
 *
 * The gating assertion is the blast-radius guard (RESEARCH.md P6): compiling
 * a slot-bearing component that never reads `$slotted` must emit NO
 * assigned-elements field — this is what keeps the other 30 slot-bearing Lit
 * leaves byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../../../core/src/compile.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileLit(source: string, filename: string) {
  const result = compile(source, {
    target: 'lit',
    filename,
    types: false,
    sourceMap: false,
  });
  const errors = result.diagnostics.filter((d: Diagnostic) => d.severity === 'error');
  expect(errors, JSON.stringify(errors)).toEqual([]);
  return result.code;
}

// D4 generality proof — deliberately NO r-for, NO embla-shaped structure.
const ENGINE_QUERY_DEFAULT_SLOT = `<rozie name="EngineQueryDefaultSlot">
<data>{ count: 0 }</data>
<script lang="ts">
$onMount(() => {
  $data.count = $slotted.default.length;
});
$watch(() => $slotted.default.length, () => {
  $data.count = $slotted.default.length;
});
</script>
<template>
<div ref="containerEl">
<slot />
</div>
</template>
</rozie>
`;

describe('$slotted.<name> — Lit emission shape (EngineQueryDefaultSlot fixture)', () => {
  it('declares a private preact-signal field for the default slot, typed Element[], initialised empty', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    expect(code).toContain('private _slotDefaultAssigned = signal<Element[]>([]);');
  });

  it('the slotchange update closure assigns into the signal alongside the presence boolean', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    // Presence assignment (pre-existing) and the new signal write must both
    // live inside the SAME `update = () => { ... }` closure.
    const updateMatch = code.match(/const update = \(\) => \{[\s\S]*?\};/);
    expect(updateMatch, code).not.toBeNull();
    const updateBody = updateMatch![0];
    expect(updateBody).toContain('this._hasSlotDefault = this._slotDefaultElements.length > 0;');
    expect(updateBody).toContain('this._slotDefaultAssigned.value = assigned;');
  });

  it('connectedCallback pre-seeds the signal from light-DOM children beside the presence pre-seed', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    const ccMatch = code.match(/connectedCallback\(\): void \{[\s\S]*?\n  \}/);
    expect(ccMatch, code).not.toBeNull();
    const ccBody = ccMatch![0];
    expect(ccBody).toContain('this._hasSlotDefault = Array.from(this.children).some(');
    expect(ccBody).toContain('this._slotDefaultAssigned.value = Array.from(this.children).filter(');
    // Ordering: pre-seed lines appear BEFORE super.connectedCallback(), same
    // invariant as the pre-existing D-LIT-15 presence pre-seed.
    const assignedIdx = ccBody.indexOf('_slotDefaultAssigned.value = Array.from');
    const superIdx = ccBody.indexOf('super.connectedCallback();');
    expect(assignedIdx).toBeGreaterThanOrEqual(0);
    expect(superIdx).toBeGreaterThan(assignedIdx);
  });

  it('the script read lowers $slotted.default to a `.value` read on the assigned-elements field', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    expect(code).toContain('this._slotDefaultAssigned.value.length');
    expect(code).not.toContain('$slotted');
  });

  it('the $watch is routed through the effect() route, not an updated(changedProperties) branch', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    expect(code).toMatch(/effect\(\(\) => \{/);
    // This component has no <props>, so a props-route watcher branch would
    // require `changedProperties` — its total absence confirms the sole
    // watcher took the effect() route.
    expect(code).not.toContain('changedProperties');
  });

  it('mandatory idempotence guard: the signal write is conditional on length/identity diff', () => {
    const code = compileLit(ENGINE_QUERY_DEFAULT_SLOT, 'EngineQueryDefaultSlot.rozie');
    expect(code).toContain(
      'if (assigned.length !== prev.length || assigned.some((el, i) => el !== prev[i]))',
    );
  });
});

describe('$slotted.<name> — Lit gating (blast-radius guard)', () => {
  it('a slot-bearing component that never reads $slotted emits NO assigned-elements field (Modal fixture)', () => {
    const filename = resolve(ROOT, 'examples/Modal.rozie');
    const source = readFileSync(filename, 'utf8');
    const code = compileLit(source, filename);
    expect(code).not.toContain('Assigned = signal');
    expect(code).not.toContain('signal<Element[]>');
    expect(code).not.toContain('$slotted');
  });
});
