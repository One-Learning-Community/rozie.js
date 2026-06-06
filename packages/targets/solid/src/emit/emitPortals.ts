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
import { portalAttrName } from '../../../../core/src/codegen/portalCss.js';

/**
 * Spike 004 — portal-scope `setAttribute` line, or '' when no scopeHash.
 *
 * Open question Q4 resolution: the attribute is set on the per-cell
 * `container` (the value passed to the portal closure), NOT on the wrapper
 * root once. All 6 hand-written exemplars set it per-container.
 */
function setAttrLine(slotName: string, scopeHash: string): string {
  if (scopeHash.length === 0) return '';
  return (
    `    // Spike 004: portal-scope attribute injection.\n` +
    `    container.setAttribute('${portalAttrName(slotName)}', '${scopeHash}');\n`
  );
}

/**
 * The `{ update, dispose }` interface a reactive portal slot's method returns.
 * Emitted once into the component body when any reactive portal slot is present
 * (REQ-22). Non-reactive slots keep the `() => void` shape verbatim.
 */
const REACTIVE_HANDLE_INTERFACE_SOLID =
  'interface ReactivePortalHandle {\n' +
  '  update(scope: unknown): void;\n' +
  '  dispose(): void;\n' +
  '}';

/** Build the per-slot method body for the portals closure. */
function buildSlotMethod(slot: SlotDecl, scopeHash: string): string {
  if (slot.isReactive === true) return buildReactiveSlotMethod(slot, scopeHash);
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
    setAttrLine(slotName, scopeHash) +
    `    const dispose = render(() => slot(scope), container);\n` +
    `    portalDisposers.add(dispose);\n` +
    `    return () => {\n` +
    `      dispose();\n` +
    `      portalDisposers.delete(dispose);\n` +
    `    };\n` +
    `  },`
  );
}

/**
 * Phase 33 / REQ-22 — reactive portal-slot method body.
 *
 * Δ vs mount-once: returns `{ update, dispose }`. Scope is held in a SIGNAL —
 * `render(() => slot(scopeSig()), container)` builds a reactive root that
 * re-runs only the computation reading scopeSig (Solid's fine-grained
 * reactivity updates exactly the bound DOM, no remount). update() = setScopeSig.
 * `{ equals: false }` (REQ-20) forces the recompute even when the engine hands
 * back the same scope object mutated in place. dispose() calls the
 * render-returned disposer (mount-once teardown, unchanged). This is Solid's
 * natural fit — the mount-once version discarded reactivity. Mirrors spike 007
 * solid.reactive-portal.tsx.
 */
function buildReactiveSlotMethod(slot: SlotDecl, scopeHash: string): string {
  const slotName = slot.name;
  const slotProp = slotName + 'Slot';
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): ReactivePortalHandle => {\n` +
    `    const slot = _props.${slotProp} ?? _props.slots?.['${slotName}'];\n` +
    `    if (typeof slot !== 'function') return { update() {}, dispose() {} };\n` +
    setAttrLine(slotName, scopeHash) +
    `    const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });\n` +
    `    const dispose = render(() => slot(scopeSig() as ${scopeType}), container);\n` +
    `    portalDisposers.add(dispose);\n` +
    `    return {\n` +
    `      update: (s: unknown): void => {\n` +
    `        setScopeSig(s);\n` +
    `      },\n` +
    `      dispose: (): void => {\n` +
    `        dispose();\n` +
    `        portalDisposers.delete(dispose);\n` +
    `      },\n` +
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
  /**
   * Add `createSignal` to the 'solid-js' import when true — a reactive portal
   * slot is present (Phase 33 / REQ-20). False for mount-once-only components,
   * keeping their import line byte-identical (REQ-22).
   */
  needsCreateSignal: boolean;
}

export function emitPortals(ir: IRComponent, scopeHash: string = ''): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return {
      hasPortals: false,
      setupLines: '',
      needsSolidWebRender: false,
      needsCreateSignal: false,
    };
  }

  const methodLines = portals.map((slot) => buildSlotMethod(slot, scopeHash)).join('\n');
  const hasReactive = portals.some((s) => s.isReactive === true);
  const lines = [
    ...(hasReactive ? [REACTIVE_HANDLE_INTERFACE_SOLID] : []),
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
    needsCreateSignal: hasReactive,
  };
}
