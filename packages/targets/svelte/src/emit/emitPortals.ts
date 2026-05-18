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

function buildSlotMethod(slot: SlotDecl): string {
  const slotName = slot.name;
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    if (!${slotName}) return () => {};\n` +
    `    const inst = mount(PortalHost, {\n` +
    `      target: container,\n` +
    `      props: { snippet: ${slotName}, scope },\n` +
    `    });\n` +
    `    portalInstances.add(inst as Record<string, unknown>);\n` +
    `    return () => {\n` +
    `      unmount(inst);\n` +
    `      portalInstances.delete(inst as Record<string, unknown>);\n` +
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

export function emitPortals(ir: IRComponent): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return { hasPortals: false, setupLines: '', extraImports: '' };
  }

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const lines = [
    'const portalInstances = new Set<Record<string, unknown>>();',
    `const portals = {\n${methodLines}\n};`,
    '$effect(() => () => {',
    '  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);',
    '  portalInstances.clear();',
    '});',
  ];

  const extraImports =
    "import { mount, unmount } from 'svelte';\n" +
    "import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';\n";

  return {
    hasPortals: true,
    setupLines: lines.join('\n'),
    extraImports,
  };
}
