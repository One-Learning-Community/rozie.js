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

function buildSlotMethod(slot: SlotDecl): string {
  const slotName = slot.name;
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const tpl = this.${slotName};\n` +
    `    if (typeof tpl !== 'function') return () => {};\n` +
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

export function emitPortals(ir: IRComponent): PortalsEmit {
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
  const methodLines = portals.map(buildSlotMethod).join('\n');
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
