// Portal-slot primitive (Spike 003) — IR + cross-target compile smoke.
//
// Validates that a tiny portal-slot wrapper:
//   1. Parses through to a SlotDecl with isPortal=true + portalParamNames
//   2. Has a matching TemplateSlotInvocationIR with isPortal=true (so each
//      target's template emitter skips rendering it)
//   3. Compiles to all 6 targets with zero error diagnostics
//   4. Per-target output contains the expected portal scaffolding tokens
//      (loose checks — full fixture-byte-identity comes later)
//
// This is the regression gate for portal-slot end-to-end. Without it, a
// rewriter / shell composition regression in any of the 6 targets would only
// surface when someone tries to compile FullCalendar.rozie.
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse.js';
import { lowerToIR } from '../src/ir/lower.js';
import { createDefaultRegistry } from '../src/modifiers/registerBuiltins.js';
import { compile, type CompileTarget } from '../src/compile.js';

const SOURCE = `<rozie name="PortalDemo">

<props>
{
  items: { type: Array, default: () => [] }
}
</props>

<script>
let instance = null

$onMount(() => {
  instance = {
    cellRenderer: (arg) => {
      const node = document.createElement('div')
      const dispose = $portals.event(node, { arg })
      return { node, dispose }
    },
  }
  return () => { instance = null }
})
</script>

<template>
<div class="demo" />
</template>

</rozie>
`;

describe('portal-slot primitive — Spike 003', () => {
  it('lowerSlots produces SlotDecl with isPortal=true when template has <slot portal />', () => {
    const withPortal = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="event" portal :params="[\'arg\']" /></div>',
    );
    const parseRes = parse(withPortal);
    expect(parseRes.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const portal = ir!.slots.find((s) => s.name === 'event');
    expect(portal).toBeDefined();
    expect(portal!.isPortal).toBe(true);
    expect(portal!.portalParamNames).toEqual(['arg']);
    // Synthesised ParamDecl from portalParamNames so existing slot-type
    // machinery (ctxInterface synthesis) works without per-target portal
    // branches.
    expect(portal!.params.map((p) => p.name)).toContain('arg');
  });

  it('reactive+portal: <slot portal reactive /> lowers with isPortal=true AND isReactive=true', () => {
    const withReactivePortal = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="event" portal reactive :params="[\'arg\']" /></div>',
    );
    const parseRes = parse(withReactivePortal);
    expect(parseRes.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const portal = ir!.slots.find((s) => s.name === 'event');
    expect(portal).toBeDefined();
    expect(portal!.isPortal).toBe(true);
    expect(portal!.isReactive).toBe(true);
  });

  it('portal-only: <slot portal /> (no reactive) lowers with isReactive falsy — opt-in, zero churn', () => {
    const withPortalOnly = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="event" portal :params="[\'arg\']" /></div>',
    );
    const parseRes = parse(withPortalOnly);
    expect(parseRes.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const portal = ir!.slots.find((s) => s.name === 'event');
    expect(portal).toBeDefined();
    expect(portal!.isPortal).toBe(true);
    expect(portal!.isReactive).toBeFalsy();
  });

  it('reactive-without-portal: <slot reactive /> (no portal) leaves isReactive unset — reactive is gated on isPortal', () => {
    const withReactiveOnly = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="event" reactive :title="$props.items" /></div>',
    );
    const parseRes = parse(withReactiveOnly);
    expect(parseRes.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const slot = ir!.slots.find((s) => s.name === 'event');
    expect(slot).toBeDefined();
    expect(slot!.isPortal).toBeUndefined();
    expect(slot!.isReactive).toBeUndefined();
  });

  it('non-portal slots are unaffected — isPortal is absent', () => {
    const withRegular = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="header" :title="$props.items" /></div>',
    );
    const parseRes2 = parse(withRegular);
    expect(parseRes2.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes2.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const reg = ir!.slots.find((s) => s.name === 'header');
    expect(reg).toBeDefined();
    expect(reg!.isPortal).toBeUndefined();
  });

  describe.each<CompileTarget>(['react', 'vue', 'svelte', 'angular', 'solid', 'lit'])(
    'compiles cleanly to %s with portal scaffolding',
    (target) => {
      const withPortal = SOURCE.replace(
        '<div class="demo" />',
        '<div class="demo"><slot name="event" portal :params="[\'arg\']" /></div>',
      );

      it('emits a `portals` closure + `$portals.X` rewrite + bulk dispose', () => {
        const result = compile(withPortal, {
          target,
          filename: '/virtual/PortalDemo.rozie',
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        expect(result.code).toContain('const portals = {');
        expect(result.code).toContain('portals.event(node,');
        // Each target uses a different bulk-dispose container variable name;
        // assert one of the known patterns exists. (Loose match — fixture-
        // byte-identity would lock per-target shape if needed.)
        const bulkPatterns = [
          'portalRoots.current',
          'portalContainers',
          'portalDisposers',
          'portalInstances',
          '_portalContainers',
          '_portalViews',
        ];
        expect(bulkPatterns.some((p) => result.code.includes(p))).toBe(true);
      });
    },
  );

  // ---- Phase 37 — $portals.default (DEFAULT portal slot) ----

  it('lowerSlots: an UNNAMED <slot portal /> lowers with name="" + isPortal=true', () => {
    const withDefaultPortal = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot portal reactive :params="[\'arg\']" /></div>',
    );
    const parseRes = parse(withDefaultPortal);
    expect(parseRes.ast).not.toBeNull();
    const { ir } = lowerToIR(parseRes.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const def = ir!.slots.find((s) => s.name === '');
    expect(def).toBeDefined();
    expect(def!.isPortal).toBe(true);
    expect(def!.isReactive).toBe(true);
    expect(def!.portalParamNames).toEqual(['arg']);
  });

  it('validateDefaultPortalCollision: a default portal slot + a name="default" slot is a ROZ979 ERROR', () => {
    const collision = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot portal :params="[\'arg\']" /><slot name="default" /></div>',
    );
    const result = compile(collision, { target: 'react', filename: '/virtual/PortalDemo.rozie' });
    const roz979 = result.diagnostics.filter((d) => d.code === 'ROZ979');
    expect(roz979.length).toBe(1);
    expect(roz979[0]!.severity).toBe('error');
  });

  it('a name="default" slot WITHOUT a default portal slot is fine (no ROZ979)', () => {
    const noCollision = SOURCE.replace(
      '<div class="demo" />',
      '<div class="demo"><slot name="default" portal :params="[\'arg\']" /></div>',
    );
    const result = compile(noCollision, { target: 'react', filename: '/virtual/PortalDemo.rozie' });
    expect(result.diagnostics.filter((d) => d.code === 'ROZ979')).toEqual([]);
  });

  describe.each<CompileTarget>(['react', 'vue', 'svelte', 'angular', 'solid', 'lit'])(
    '$portals.default compiles cleanly to %s',
    (target) => {
      // Author the DEFAULT (unnamed) portal slot + a script that invokes
      // `$portals.default(node, …)`. The closure key MUST be `default` (not '').
      const DEFAULT_SOURCE = SOURCE.replace(
        '$portals.event(node, { arg })',
        '$portals.default(node, { arg })',
      ).replace(
        '<div class="demo" />',
        '<div class="demo"><slot portal reactive :params="[\'arg\']" /></div>',
      );

      it('emits `default:` closure key + `portals.default(` rewrite, zero errors', () => {
        const result = compile(DEFAULT_SOURCE, {
          target,
          filename: '/virtual/PortalDemo.rozie',
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        expect(result.code).toContain('const portals = {');
        // The closure object KEY is the reserved `default`, NOT the empty string.
        expect(result.code).toContain('default: (container');
        // The script-side `$portals.default(...)` rewrote to `portals.default(...)`.
        expect(result.code).toContain('portals.default(node,');
        // The broken empty-key shapes must NEVER appear.
        expect(result.code).not.toContain("portals['']");
        expect(result.code).not.toMatch(/\n\s*: \(container/);
      });
    },
  );
});
