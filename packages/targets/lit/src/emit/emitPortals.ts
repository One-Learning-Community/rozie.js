/**
 * Portal-slot primitive (Spike 003) — Lit-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Three artefacts:
 *
 *   1. `fieldDecl`         — `private _portalContainers = new Set<HTMLElement>();`
 *   2. `closureBlock`      — `const portals = { X: (...) => {...} };` — placed
 *                            at the top of `firstUpdated()` body
 *   3. `disconnectedBlock` — bulk-dispose loop placed in `disconnectedCallback()`
 *
 * Per Spike 002 Demo.lit.ts: Lit's shadow-DOM `<slot>` element cannot be
 * invoked imperatively, so portal slots come through as function-typed
 * `@property` fields (existing render-prop lowering for non-portal scoped
 * slots already supports this shape).
 *
 * V1 reactivity constraint (REQ-5): portal slots are NOT reactive after mount.
 */
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { portalAttrName } from '../../../../core/src/codegen/portalCss.js';
import { portalSlotMemberName } from './portalSlotMemberName.js';

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
 * Emitted once into firstUpdated's closure block when any reactive portal slot
 * is present (REQ-22). Non-reactive slots keep the `() => void` shape verbatim.
 */
const REACTIVE_HANDLE_INTERFACE_LIT =
  'interface ReactivePortalHandle {\n' +
  '  update(scope: unknown): void;\n' +
  '  dispose(): void;\n' +
  '}';

function buildSlotMethod(slot: SlotDecl, scopeHash: string, ir: IRComponent): string {
  if (slot.isReactive === true) return buildReactiveSlotMethod(slot, scopeHash, ir);
  const slotName = slot.name;
  // The closure object KEY stays the bare slot name: the script-side
  // `$portals.<slotName>(...)` call is rewritten to `portals.<slotName>(...)`,
  // so the key must match the slot name. Only the `this.<member>` READ of the
  // consumer-supplied callback uses the collision-gated member name (which may
  // differ from the slot name when a same-named prop forced a `Slot` suffix).
  const memberName = portalSlotMemberName(slotName, ir);
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const tpl = this.${memberName};\n` +
    `    if (typeof tpl !== 'function') return () => {};\n` +
    setAttrLine(slotName, scopeHash) +
    `    render(tpl(scope), container);\n` +
    `    this._portalContainers.add(container);\n` +
    `    return () => {\n` +
    `      render(nothing, container);\n` +
    `      this._portalContainers.delete(container);\n` +
    `    };\n` +
    `  },`
  );
}

/**
 * Phase 33 / REQ-22 — reactive portal-slot method body.
 *
 * Δ vs mount-once: returns `{ update, dispose }`. The CONTAINER is retained;
 * `update(s)` re-runs `render(tpl(s), container)` — lit-html keeps a ChildPart
 * on the container and diffs/patches into the same host (DOM identity
 * preserved, no remount; this is lit-html's defining repeat-render behavior).
 * dispose() calls `render(nothing, container)` (mount-once teardown,
 * unchanged). Mirrors spike 007 lit.reactive-portal.ts.
 */
function buildReactiveSlotMethod(slot: SlotDecl, scopeHash: string, ir: IRComponent): string {
  const slotName = slot.name;
  const memberName = portalSlotMemberName(slotName, ir);
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): ReactivePortalHandle => {\n` +
    `    const tpl = this.${memberName};\n` +
    `    if (typeof tpl !== 'function') return { update() {}, dispose() {} };\n` +
    setAttrLine(slotName, scopeHash) +
    `    const renderScope = (s: unknown): void => {\n` +
    `      render(tpl(s), container);\n` +
    `    };\n` +
    `    renderScope(scope);\n` +
    `    this._portalContainers.add(container);\n` +
    `    return {\n` +
    `      update: (s: unknown): void => renderScope(s),\n` +
    `      dispose: (): void => {\n` +
    `        render(nothing, container);\n` +
    `        this._portalContainers.delete(container);\n` +
    `      },\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  hasPortals: boolean;
  /** Class field declaration (goes alongside other fieldDecls). */
  fieldDecl: string;
  /** Closure block prepended to firstUpdated body. */
  closureBlock: string;
  /** Bulk-dispose lines prepended to disconnectedCallback body. */
  disconnectedBlock: string;
}

export function emitPortals(ir: IRComponent, scopeHash: string = ''): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return {
      hasPortals: false,
      fieldDecl: '',
      closureBlock: '',
      disconnectedBlock: '',
    };
  }

  const fieldDecl = 'private _portalContainers = new Set<HTMLElement>();';
  const methodLines = portals.map((slot) => buildSlotMethod(slot, scopeHash, ir)).join('\n');
  const hasReactive = portals.some((s) => s.isReactive === true);
  const interfacePrefix = hasReactive ? REACTIVE_HANDLE_INTERFACE_LIT + '\n' : '';
  const closureBlock = `${interfacePrefix}const portals = {\n${methodLines}\n};`;
  const disconnectedBlock =
    'for (const container of this._portalContainers) render(nothing, container);\n' +
    'this._portalContainers.clear();';

  return {
    hasPortals: true,
    fieldDecl,
    closureBlock,
    disconnectedBlock,
  };
}
