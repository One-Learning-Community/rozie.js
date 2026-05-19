/**
 * Portal-slot primitive (Spike 003) — Vue-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Two artefacts:
 *
 *   1. `setupLines`         — declared at script-setup top level (after
 *                              residual + before lifecycle). Includes:
 *                                - `const portalContainers = new Set<HTMLElement>();`
 *                                - `const portals = { X: (...) => {...} };`
 *                                - `onBeforeUnmount(() => { /* bulk dispose *\/ });`
 *
 * The `const slots = useSlots();` declaration is emitted by emitScript when
 * either portals are present OR the rewriter saw `$slots.X` in user code;
 * portal methods read fills via `slots.${slotName}`.
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
  // Wrap the slot's VNode array in a `Fragment` so the rendered output has
  // NO extra wrapper element — the slot's nodes become direct children of
  // `container`. An earlier `h('div', null, slotFn(scope))` version added an
  // unstyled <div> wrapper inside each engine-owned cell, which broke any
  // inline styles the engine set on the cell container (display: flex / gap
  // applied to container, but the slot content lived one level deeper and
  // wasn't affected). Fragment is the Vue idiom for "render these vnodes
  // here without an extra host element."
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const slotFn = slots.${slotName};\n` +
    `    if (!slotFn) return () => {};\n` +
    `    const vnode = h(Fragment, null, slotFn(scope));\n` +
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

  imports.use('Fragment');
  imports.use('h');
  imports.use('render');
  // useSlots() is imported + declared by emitScript via the slotsUsed flag.
  imports.use('onBeforeUnmount');

  const methodLines = portals.map(buildSlotMethod).join('\n');
  const lines = [
    'const portalContainers = new Set<HTMLElement>();',
    `const portals = {\n${methodLines}\n};`,
    'onBeforeUnmount(() => {',
    '  for (const container of portalContainers) render(null, container);',
    '  portalContainers.clear();',
    '});',
  ];

  return { hasPortals: true, setupLines: lines.join('\n') };
}
