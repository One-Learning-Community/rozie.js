/**
 * Portal-slot primitive (Spike 003) — Svelte 5 target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Two artefacts:
 *
 *   1. `setupLines`         — declared at `<script>` top level (after props
 *                              destructure). Includes:
 *                                - `const portalInstances = new Set<...>();`
 *                                - `const portals = { X: (...) => {...} };`
 *                                - `$effect(() => () => { /* bulk dispose *\/ });`
 *
 * Imports needed:
 *   - `mount`, `unmount` from 'svelte'  (PortalHost mounting/unmounting)
 *   - `PortalHost` from '@rozie/runtime-svelte/PortalHost.svelte'  (REQ-8 — runtime helper)
 *
 * Per Spike 002 Demo.svelte: Svelte 5 Snippets cannot be passed to `mount()`
 * directly — `mount()` expects a Component. PortalHost (shipped from the
 * runtime package) is the ~10-LOC shim that wraps any Snippet for imperative
 * mounting into a foreign DOM container.
 *
 * V1 reactivity constraint (REQ-5): portal slots are NOT reactive after mount.
 */
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { portalAttrName } from '../../../../core/src/codegen/portalCss.js';
import { portalSlotMergeName } from './portalSlotMergeName.js';

/**
 * Spike 004 — portal-scope `setAttribute` line, or '' when no scopeHash.
 *
 * Open question Q4 resolution: the attribute is set on the per-cell
 * `container` (the value passed to the portal closure), NOT on the wrapper
 * root once. All 6 hand-written exemplars — the structural snapshot contract
 * — set it per-container; a portal closure runs once per cell.
 */
function setAttrLine(slotName: string, scopeHash: string): string {
  if (scopeHash.length === 0) return '';
  return (
    `    // Spike 004: portal-scope attribute injection.\n` +
    `    container.setAttribute('${portalAttrName(slotName)}', '${scopeHash}');\n`
  );
}

/**
 * The `{ update, dispose }` type a reactive portal slot's method returns.
 * Emitted once into the `<script>` when any reactive portal slot is present
 * (REQ-22). Non-reactive slots keep the `() => void` shape verbatim.
 */
const REACTIVE_HANDLE_INTERFACE_SVELTE =
  'interface ReactivePortalHandle {\n' +
  '  update(scope: unknown): void;\n' +
  '  dispose(): void;\n' +
  '}';

function buildSlotMethod(slot: SlotDecl, scopeHash: string, ir: IRComponent): string {
  if (slot.isReactive === true) return buildReactiveSlotMethod(slot, scopeHash, ir);
  const slotName = slot.name;
  // The closure object KEY stays the bare slot name: the script-side
  // `$portals.<slotName>(...)` call is rewritten to `portals.<slotName>(...)`,
  // so the key must match the slot name. Only the READS of the merged
  // consumer-supplied snippet (`if (!<merge>)` guard + `snippet: <merge>`) use
  // the collision-gated identifier — which differs from the slot name only when
  // a same-named prop forced a `Slot` suffix on the `$derived` merge.
  const mergeName = portalSlotMergeName(slotName, ir);
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    if (!${mergeName}) return () => {};\n` +
    setAttrLine(slotName, scopeHash) +
    `    const inst = mount(PortalHost, {\n` +
    `      target: container,\n` +
    `      props: { snippet: ${mergeName}, scope },\n` +
    `    });\n` +
    `    portalInstances.add(inst as Record<string, unknown>);\n` +
    `    return () => {\n` +
    `      unmount(inst);\n` +
    `      portalInstances.delete(inst as Record<string, unknown>);\n` +
    `    };\n` +
    `  },`
  );
}

/**
 * Phase 33 / REQ-19, REQ-22 — reactive portal-slot method body.
 *
 * Δ vs mount-once: returns `{ update, dispose }`. Mounts `PortalHostReactive`
 * (the reactive runtime variant) passing `initialScope` (not `scope`); the
 * mounted instance's `.update()` export is the in-place re-render handle —
 * Svelte 5 `mount()` returns the component's exports, so `inst.update(s)`
 * drives the host's `$state`, re-rendering the snippet in place (DOM identity
 * preserved, no remount). dispose() calls `unmount(inst)` (mount-once
 * teardown, unchanged). Mirrors spike 007 svelte.reactive-portal.md.
 */
function buildReactiveSlotMethod(slot: SlotDecl, scopeHash: string, ir: IRComponent): string {
  const slotName = slot.name;
  const mergeName = portalSlotMergeName(slotName, ir);
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): ReactivePortalHandle => {\n` +
    `    if (!${mergeName}) return { update() {}, dispose() {} };\n` +
    setAttrLine(slotName, scopeHash) +
    `    const inst = mount(PortalHostReactive, {\n` +
    `      target: container,\n` +
    `      props: { snippet: ${mergeName}, initialScope: scope },\n` +
    `    });\n` +
    `    portalInstances.add(inst as Record<string, unknown>);\n` +
    `    return {\n` +
    `      update: (s: unknown): void => {\n` +
    `        (inst as unknown as { update(s: unknown): void }).update(s);\n` +
    `      },\n` +
    `      dispose: (): void => {\n` +
    `        unmount(inst as Parameters<typeof unmount>[0]);\n` +
    `        portalInstances.delete(inst as Record<string, unknown>);\n` +
    `      },\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  hasPortals: boolean;
  /** Lines to splice between residual and lifecycle sections. */
  setupLines: string;
  /** Add these imports above any existing imports. */
  extraImports: string;
}

export function emitPortals(ir: IRComponent, scopeHash: string = ''): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return { hasPortals: false, setupLines: '', extraImports: '' };
  }

  const methodLines = portals.map((slot) => buildSlotMethod(slot, scopeHash, ir)).join('\n');
  const hasReactive = portals.some((s) => s.isReactive === true);
  const hasNonReactive = portals.some((s) => s.isReactive !== true);
  const lines = [
    ...(hasReactive ? [REACTIVE_HANDLE_INTERFACE_SVELTE] : []),
    'const portalInstances = new Set<Record<string, unknown>>();',
    `const portals = {\n${methodLines}\n};`,
    '$effect(() => () => {',
    '  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);',
    '  portalInstances.clear();',
    '});',
  ];

  // Reactive slots import the reactive PortalHost variant (REQ-19); the
  // mount-once `PortalHost` import is emitted only when a non-reactive portal
  // slot is present, so a reactive-only component carries just the reactive
  // import and a mount-once-only component is byte-identical (REQ-22).
  const extraImports =
    "import { mount, unmount } from 'svelte';\n" +
    (hasNonReactive
      ? "import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';\n"
      : '') +
    (hasReactive
      ? "import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';\n"
      : '');

  return {
    hasPortals: true,
    setupLines: lines.join('\n'),
    extraImports,
  };
}
