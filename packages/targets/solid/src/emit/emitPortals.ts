/**
 * Portal-slot primitive (Spike 003) — Solid-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Two artefacts:
 *
 *   1. `setupLines` — declared at component-body top (after hooks, before
 *                     lifecycle). Includes:
 *                      - `const portalDisposers = new Set<() => void>();`
 *                      - `const portals = { X: (...) => {...} };`
 *                      - `onCleanup(() => { /* bulk dispose *\/ });`
 *
 * Solid's `render(fn, container)` returns the dispose function directly —
 * cleanest fit of all 6 targets per Spike 002. Slot field convention matches
 * existing Solid scoped slots: `<slotName>Slot` (e.g., `eventSlot`).
 *
 * V1 reactivity constraint (REQ-5): portal slots are NOT reactive after mount.
 */
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

/** Build the per-slot method body for the portals closure. */
function buildSlotMethod(slot: SlotDecl): string {
  const slotName = slot.name;
  const slotProp = slotName + 'Slot';
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  // Solid's slot props are accessed via `_props.<name>Slot` — NOT `props.X`
  // (the React shape) and NOT `local.X` (which only contains keys explicitly
  // listed in splitProps's second arg, and slot props are not listed there).
  // Mirrors emitSlotInvocation.ts's `_props.${slotFieldName}` shape. The
  // merge with the dynamic-name `slots?:` map (`_props.slots?.['name']`)
  // matches Phase 07.3.2's invocation-site convention.
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const slot = _props.${slotProp} ?? _props.slots?.['${slotName}'];\n` +
    `    if (typeof slot !== 'function') return () => {};\n` +
    `    const dispose = render(() => slot(scope), container);\n` +
    `    portalDisposers.add(dispose);\n` +
    `    return () => {\n` +
    `      dispose();\n` +
    `      portalDisposers.delete(dispose);\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  hasPortals: boolean;
  /** Lines to splice at component-body top. */
  setupLines: string;
  /** Add `import { render } from 'solid-js/web';` when true. */
  needsSolidWebRender: boolean;
}

export function emitPortals(ir: IRComponent): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return { hasPortals: false, setupLines: '', needsSolidWebRender: false };
  }

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const lines = [
    'const portalDisposers = new Set<() => void>();',
    `const portals = {\n${methodLines}\n};`,
    'onCleanup(() => {',
    '  for (const dispose of portalDisposers) dispose();',
    '  portalDisposers.clear();',
    '});',
  ];

  return {
    hasPortals: true,
    setupLines: lines.join('\n'),
    needsSolidWebRender: true,
  };
}
