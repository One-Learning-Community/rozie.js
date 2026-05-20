/**
 * Portal-slot primitive (Spike 003) — Angular-target scaffolding.
 *
 * Synthesizes the per-target portal-mount machinery for a Rozie wrapper that
 * uses `<slot name="X" portal />`. Five artefacts:
 *
 *   1. `templateAppend`   — `<ng-container #rozie_portalAnchor></ng-container>`
 *                            appended to the component template so the
 *                            ViewContainerRef query has an anchor to read.
 *   2. `fieldDecls`       — one `private _<name>Tpl = contentChild(...)` per
 *                            portal slot, plus `_portalAnchor = viewChild(...)`
 *                            and `_portalViews = new Set<EmbeddedViewRef<any>>();`
 *   3. `closureBlock`     — `const portals = { X: (...) => {...} };` placed
 *                            at the top of `ngAfterViewInit()`.
 *   4. `destroyRegister`  — `this.__rozieDestroyRef.onDestroy(() => {...})`
 *                            for bulk dispose at component teardown.
 *
 * Per Spike 002 Demo.angular.ts: Angular 19's signal-based `viewChild` /
 * `contentChild` APIs handle DI automatically — no `inject(...)` calls
 * needed for the portal-mount machinery itself.
 *
 * REQ-7: Angular's `contentChild('eventName', { read: TemplateRef })`
 * inference works WITHOUT a locator generic; adding one (e.g. `contentChild<...>`)
 * produces TS2322 conflicts with the `read` option's inferred return type.
 * The emit below omits the generic deliberately.
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

function buildSlotMethod(slot: SlotDecl, scopeHash: string): string {
  const slotName = slot.name;
  const tplField = `_${slotName}Tpl`;
  const paramNames = slot.portalParamNames ?? [];
  const scopeType =
    paramNames.length > 0
      ? `{ ${paramNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'unknown';
  return (
    `  ${slotName}: (container: HTMLElement, scope: ${scopeType}): (() => void) => {\n` +
    `    const tpl = this.${tplField}();\n` +
    `    const vcr = this._portalAnchor();\n` +
    `    if (!tpl || !vcr) return () => {};\n` +
    setAttrLine(slotName, scopeHash) +
    `    const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);\n` +
    `    view.detectChanges();\n` +
    `    for (const node of view.rootNodes as Node[]) container.appendChild(node);\n` +
    `    this._portalViews.add(view as EmbeddedViewRef<unknown>);\n` +
    `    return () => {\n` +
    `      view.destroy();\n` +
    `      this._portalViews.delete(view as EmbeddedViewRef<unknown>);\n` +
    `    };\n` +
    `  },`
  );
}

export interface PortalsEmit {
  hasPortals: boolean;
  /** Markup to append to the component template (after existing body). */
  templateAppend: string;
  /** Class field lines (template queries, anchor query, view-tracking Set). */
  fieldDecls: string[];
  /** Closure block prepended to ngAfterViewInit body. */
  closureBlock: string;
  /** Destroy registration appended to ngAfterViewInit body. */
  destroyRegister: string;
  /** When true, emitScript hoists `this.__rozieDestroyRef = inject(DestroyRef);`. */
  needsDestroyRefField: boolean;
  /** Angular core symbol names to add to the import collector. */
  angularImports: string[];
}

export function emitPortals(ir: IRComponent, scopeHash: string = ''): PortalsEmit {
  const portals = ir.slots.filter((s) => s.isPortal === true);
  if (portals.length === 0) {
    return {
      hasPortals: false,
      templateAppend: '',
      fieldDecls: [],
      closureBlock: '',
      destroyRegister: '',
      needsDestroyRefField: false,
      angularImports: [],
    };
  }

  // `<ng-container #rozie_portalAnchor></ng-container>` — Spike 002 uses
  // `#portalAnchor` but the `rozie_` prefix matches the project's reserved-
  // identifier convention to avoid colliding with consumer template refs.
  const templateAppend = '<ng-container #rozie_portalAnchor></ng-container>';

  const fieldDecls: string[] = [];
  fieldDecls.push('private _portalViews = new Set<EmbeddedViewRef<unknown>>();');
  fieldDecls.push(
    `private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });`,
  );
  for (const slot of portals) {
    fieldDecls.push(
      `private _${slot.name}Tpl = contentChild('${slot.name}', { read: TemplateRef });`,
    );
  }

  const methodLines = portals.map((slot) => buildSlotMethod(slot, scopeHash)).join('\n');
  const closureBlock = `const portals = {\n${methodLines}\n};`;

  const destroyRegister =
    'this.__rozieDestroyRef.onDestroy(() => {\n' +
    '  for (const view of this._portalViews) view.destroy();\n' +
    '  this._portalViews.clear();\n' +
    '});';

  return {
    hasPortals: true,
    templateAppend,
    fieldDecls,
    closureBlock,
    destroyRegister,
    needsDestroyRefField: true,
    angularImports: [
      'TemplateRef',
      'ViewContainerRef',
      'EmbeddedViewRef',
      'contentChild',
      'viewChild',
      'inject',
      'DestroyRef',
    ],
  };
}
