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

function buildSlotMethod(slot: SlotDecl, scopeHash: string, ir: IRComponent): string {
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
  const closureBlock = `const portals = {\n${methodLines}\n};`;
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
