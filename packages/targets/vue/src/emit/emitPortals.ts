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
import { portalKey } from '../../../../core/src/ir/types.js';
import type { VueImportCollector } from '../rewrite/collectVueImports.js';
import { portalAttrName } from '../../../../core/src/codegen/portalCss.js';

/**
 * Spike 004 — portal-scope `setAttribute` line, or '' when no scopeHash.
 *
 * Open question Q4 resolution: the attribute is set on the per-cell
 * `container` (the value passed to the portal closure), NOT on the wrapper
 * root once. The spike's vanilla smoke used root-once, but all 6 hand-written
 * exemplars — the structural snapshot contract — set it per-container. A
 * portal closure runs once per cell so the cost is negligible.
 */
function setAttrLine(slotName: string, scopeHash: string): string {
  if (scopeHash.length === 0) return '';
  return (
    `    // Spike 004: portal-scope attribute injection. Cascades the @portal\n` +
    `    // ${slotName} { … } selectors from the unscoped <style> block below into\n` +
    `    // the engine-owned subtree.\n` +
    `    container.setAttribute('${portalAttrName(slotName)}', '${scopeHash}');\n`
  );
}

/**
 * The `{ update, dispose }` interface a reactive portal slot's method returns.
 * Emitted once into script-setup when any reactive portal slot is present
 * (REQ-22). Non-reactive slots keep the `() => void` shape verbatim.
 */
const REACTIVE_HANDLE_INTERFACE_VUE =
  'interface ReactivePortalHandle {\n' +
  '  update(scope: unknown): void;\n' +
  '  dispose(): void;\n' +
  '}';

/** Build the per-slot method body for the portals closure. */
function buildSlotMethod(slot: SlotDecl, scopeHash: string): string {
  if (slot.isReactive === true) return buildReactiveSlotMethod(slot, scopeHash);
  // Phase 37: the closure KEY and the `slots.<name>` source both use the
  // effective portal key — `default` for the DEFAULT (unnamed) portal slot, so
  // `slots.default` (Vue's built-in default slot fn) is the content source.
  const slotName = portalKey(slot);
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
    setAttrLine(slotName, scopeHash) +
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

/**
 * Phase 33 / REQ-22 — reactive portal-slot method body.
 *
 * Δ vs mount-once: returns `{ update, dispose }`. The CONTAINER is retained;
 * `update(s)` re-runs `render(h(Fragment, slotFn(s)), container)` — Vue's
 * runtime diffs the new vnode against the container's `_vnode` and patches in
 * place (same-type root keeps DOM identity, no remount). dispose() calls
 * `render(null, container)` (mount-once teardown, unchanged). Mirrors spike
 * 007 vue.reactive-portal.ts.
 */
function buildReactiveSlotMethod(slot: SlotDecl, scopeHash: string): string {
  const slotName = portalKey(slot);
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): ReactivePortalHandle => {\n` +
    `    const slotFn = slots.${slotName};\n` +
    `    if (!slotFn) return { update() {}, dispose() {} };\n` +
    setAttrLine(slotName, scopeHash) +
    `    const renderScope = (s: unknown): void => {\n` +
    `      render(h(Fragment, null, slotFn(s)), container);\n` +
    `    };\n` +
    `    renderScope(scope);\n` +
    `    portalContainers.add(container);\n` +
    `    return {\n` +
    `      update: (s: unknown): void => renderScope(s),\n` +
    `      dispose: (): void => {\n` +
    `        render(null, container);\n` +
    `        portalContainers.delete(container);\n` +
    `      },\n` +
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
  scopeHash: string = '',
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

  const methodLines = portals.map((slot) => buildSlotMethod(slot, scopeHash)).join('\n');
  const hasReactive = portals.some((s) => s.isReactive === true);
  const lines = [
    ...(hasReactive ? [REACTIVE_HANDLE_INTERFACE_VUE] : []),
    'const portalContainers = new Set<HTMLElement>();',
    `const portals = {\n${methodLines}\n};`,
    'onBeforeUnmount(() => {',
    '  for (const container of portalContainers) render(null, container);',
    '  portalContainers.clear();',
    '});',
  ];

  return { hasPortals: true, setupLines: lines.join('\n') };
}
