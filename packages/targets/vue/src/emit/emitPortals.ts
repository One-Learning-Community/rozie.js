/**
 * Portal-slot primitive (Spike 003) — Vue-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Two artefacts:
 *
 *   1. `setupLines`         — declared at script-setup top level (after
 *                              residual + before lifecycle). Includes:
 *                                - `const portalContainers = new Set<HTMLElement>();`
 *                                - `const portalSlots = useSlots();`
 *                                - `const portals = { X: (...) => {...} };`
 *                                - `onBeforeUnmount(() => { /* bulk dispose *\/ });`
 *
 * The portal closure wraps Vue 3's imperative `render(h(...), container)` /
 * `render(null, container)` mount-API in the `$portals.NAME(container, scope)
 * => disposeFn` contract per Spike 002 Demo.vue ground truth.
 *
 * Vue runs onBeforeUnmount in REVERSE registration order. We register the
 * bulk-dispose hook AFTER the user's lifecycle so it executes BEFORE the
 * user's engine.destroy() — otherwise we'd unmount Vue trees from already-
 * detached containers.
 *
 * V1 reactivity constraint (REQ-5): portal slots are NOT reactive after mount.
 */
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import type { VueImportCollector } from '../rewrite/collectVueImports.js';

/** Build the per-slot method body for the portals closure. */
function buildSlotMethod(slot: SlotDecl): string {
  const slotName = slot.name;
  const paramNames = slot.portalParamNames ?? [];
  // Scope type from portalParamNames; falls back to `unknown` when omitted.
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const slotFn = portalSlots.${slotName};\n` +
    `    if (!slotFn) return () => {};\n` +
    `    const vnode = h('div', null, slotFn(scope));\n` +
    `    render(vnode, container);\n` +
    `    portalContainers.add(container);\n` +
    `    return () => {\n` +
    `      render(null, container);\n` +
    `      portalContainers.delete(container);\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  hasPortals: boolean;
  /** Lines to splice between residual and lifecycle sections. */
  setupLines: string;
}

export function emitPortals(
  ir: IRComponent,
  imports: VueImportCollector,
): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return { hasPortals: false, setupLines: '' };
  }

  imports.use('h');
  imports.use('render');
  imports.use('useSlots');
  imports.use('onBeforeUnmount');

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const lines = [
    'const portalContainers = new Set<HTMLElement>();',
    'const portalSlots = useSlots();',
    `const portals = {\n${methodLines}\n};`,
    'onBeforeUnmount(() => {',
    '  for (const container of portalContainers) render(null, container);',
    '  portalContainers.clear();',
    '});',
  ];

  return { hasPortals: true, setupLines: lines.join('\n') };
}
