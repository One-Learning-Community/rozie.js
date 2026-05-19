/**
 * emitSlotDecl — Lit target (Plan 06.4-02 Task 2).
 *
 * Per the SlotDecl IR (D-18) and D-LIT-14 (queryAssignedElements correction):
 *
 *   For each slot:
 *     - `@state() private _hasSlot<X> = false;` — slotchange-updated boolean
 *     - `@queryAssignedElements({ slot: 'X', flatten: true })
 *        private _slot<X>Elements!: Element[];`
 *     - slotchange wiring spliced into firstUpdated():
 *         for (const slotEl of this.shadowRoot!.querySelectorAll('slot')) {
 *           slotEl.addEventListener('slotchange', () => {
 *             this._hasSlot<X> = this._slot<X>Elements.length > 0;
 *           });
 *         }
 *
 * CRITICAL: This module emits `@queryAssignedElements`, NEVER
 * `@queryAssignedNodes`. The Nodes variant returns whitespace TextNodes as
 * present, which would yield false-positive presence detection. D-LIT-14
 * correction (2026-05-13).
 *
 * Default slot (name === '') omits the `slot:` filter in the decorator opts:
 *   `@queryAssignedElements({ flatten: true })`.
 *
 * @experimental — shape may change before v1.0
 */
import * as bt from '@babel/types';
import type { IRComponent, SlotDecl, ParamDecl } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { LitDecoratorImportCollector } from '../rewrite/collectLitImports.js';
import { collectMethodNamesFromIR } from './methodNames.js';

export interface EmitSlotDeclOpts {
  decorators: LitDecoratorImportCollector;
}

// WR-01 (Phase 07.4 review): a slot param resolves through dispatchEvent
// (D-LIT-17 / D-LIT-12) — and never through the data-typed
// `observeRozieSlotCtx` ctx field — when its source expression is a literal
// function or a bare reference to a known method. Mirrors the producer-side
// detection in buildEventParts() / emitSlot() in emitTemplate.ts.
function isFunctionTypedParam(p: ParamDecl, methodNameSet: Set<string>): boolean {
  const expr = p.valueExpression;
  if (bt.isArrowFunctionExpression(expr) || bt.isFunctionExpression(expr)) return true;
  if (bt.isIdentifier(expr) && methodNameSet.has(expr.name)) return true;
  return false;
}

export interface EmitSlotDeclResult {
  /** Class field declarations for slot presence + queryAssigned. */
  fields: string;
  /** Standalone `interface XCtx { ... }` decls hoisted above the class. */
  ctxInterfaces: string[];
  /** slotchange handler wiring (spliced into firstUpdated). */
  slotChangeWiring: string;
  /** Function-typed param signaling — spliced into firstUpdated per D-LIT-12. */
  hostListenerWiring: string[];
  /**
   * Phase 07.3.1 D-LIT-15 — newline-joined pre-seed assignments, one per slot.
   *
   * Lit producer-side `_hasSlot<X>` `@state()` fields are seeded from the
   * light-DOM children inside `connectedCallback()` BEFORE
   * `super.connectedCallback()` runs, so the very first render reflects actual
   * consumer fill presence. This closes the chicken-and-egg deadlock where a
   * conditionally-rendered slot wrapper (e.g.
   * `${this._hasSlotHeader ? html\`<header><slot name="header">…</slot></header>\` : nothing}`)
   * would otherwise prevent its inner `<slot>` from ever existing, which
   * starves `@queryAssignedElements` of fills, which keeps `_hasSlotHeader`
   * permanently false, which keeps the wrapper hidden forever.
   *
   * Pre-seed inspection is verified against Lit 3.x: by the time
   * `connectedCallback()` fires, light-DOM children are already attached and
   * walkable via `this.children`. Future Lit major-version bumps should
   * trigger a regression run of the dogfood close-spec.
   *
   * Empty string when the component has no slots.
   */
  preSeedLines: string;
  diagnostics: Diagnostic[];
}

function slotFieldSuffix(name: string): string {
  // Default slot: name === ''. Use 'Default' as the field suffix.
  if (name === '') return 'Default';
  // PascalCase the slot name (e.g. 'header' → 'Header').
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function emitOneSlot(
  slot: SlotDecl,
  ctxInterfaces: string[],
  hostListenerWiring: string[],
  slotChangeWiringLines: string[],
  preSeedLines: string[],
  methodNameSet: Set<string>,
): string {
  const suffix = slotFieldSuffix(slot.name);
  const stateField = `  @state() private _hasSlot${suffix} = false;`;

  // @queryAssignedElements decorator — D-LIT-14 correction.
  const opts =
    slot.name === ''
      ? '{ flatten: true }'
      : `{ slot: '${slot.name}', flatten: true }`;
  const queryField = `  @queryAssignedElements(${opts}) private _slot${suffix}Elements!: Element[];`;

  // slotchange wiring: register on every <slot> element in the shadow tree
  // and update the corresponding _hasSlot<X> field. We register per-slot to
  // keep the logic readable; performance impact is negligible for ≤4 slots.
  const selector = slot.name === '' ? 'slot:not([name])' : `slot[name="${slot.name}"]`;
  slotChangeWiringLines.push(
    [
      `{`,
      `  const slotEl = this.shadowRoot?.querySelector('${selector}');`,
      `  if (slotEl !== null && slotEl !== undefined) {`,
      `    const update = () => { this._hasSlot${suffix} = this._slot${suffix}Elements.length > 0; };`,
      `    slotEl.addEventListener('slotchange', update);`,
      `    // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.`,
      `    this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));`,
      `    update();`,
      `  }`,
      `}`,
    ].join('\n'),
  );

  // Phase 07.3.1 D-LIT-15 — pre-seed `_hasSlot<X>` from light-DOM children so
  // the first render reflects consumer fill presence. Named slots inspect
  // `slot="<name>"` attribute on direct children. Default slot accepts any
  // child that has NO `slot` attribute AND is either non-text OR a text node
  // containing non-whitespace content (whitespace-only text MUST NOT count as
  // a default-slot fill — Web Components spec treats it as ignored).
  if (slot.name === '') {
    preSeedLines.push(
      `this._hasSlot${suffix} = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));`,
    );
  } else {
    preSeedLines.push(
      `this._hasSlot${suffix} = Array.from(this.children).some((el) => el.getAttribute('slot') === '${slot.name}');`,
    );
  }

  // ctxInterfaces — emit only when at least one slot param is data-typed.
  // WR-01 (Phase 07.4 review): function-typed params resolve through
  // dispatchEvent (D-LIT-17), not through the `observeRozieSlotCtx` ctx
  // field, so an interface listing only function-typed params is dead text
  // in the producer file (nothing references `Rozie<X>SlotCtx` from inside
  // the same emit — consumers declare their own inline `{ ... }` shape via
  // `c as { ... }` in `observeRozieSlotCtx`). Drop the interface entirely
  // when every param is function-typed; otherwise emit it with ALL params
  // (function-typed included) so the interface still documents the full
  // surface for IDE introspection of mixed-shape slots.
  if (slot.params.length > 0) {
    const anyDataTyped = slot.params.some((p) => !isFunctionTypedParam(p, methodNameSet));
    if (anyDataTyped) {
      const ifaceName = `Rozie${suffix}SlotCtx`;
      const fields = slot.params.map((p) => `  ${p.name}: unknown;`).join('\n');
      ctxInterfaces.push(`interface ${ifaceName} {\n${fields}\n}`);
    }
  }

  // Phase 07.5 — producer-side @property emission for scoped/portal slots.
  // Receives the consumer's `.<slotName>=${fn}` property assignment that the
  // consumer-side emitSlotFiller now emits for portal or destructured-scope
  // fills. Without this typed receiver, `this.<slotName>` resolves to implicit
  // any inside emitPortals.ts:30 — fine at runtime but flagged by stricter
  // consumer tsconfigs.
  const isScopedOrPortal = slot.isPortal === true || slot.params.length > 0;
  let propertyField = '';
  if (isScopedOrPortal) {
    // Default slot ('') collides with the JS reserved word 'default'; use a
    // clearly-prefixed sentinel. consumer-side emitSlotFiller must use the
    // SAME mapping (cross-file lockstep enforced by Task 2 grep checks).
    const propertyFieldName = slot.name === '' ? '_defaultSlotFn' : slot.name;
    const scopeType =
      slot.params.length > 0
        ? `{ ${slot.params.map((p) => `${p.name}: unknown`).join('; ')} }`
        : 'unknown';
    propertyField = `  @property({ attribute: false }) ${propertyFieldName}?: (scope: ${scopeType}) => unknown;`;
  }

  return [stateField, queryField, propertyField].filter((s) => s.length > 0).join('\n');
}

export function emitSlotDecl(
  ir: IRComponent,
  opts: EmitSlotDeclOpts,
): EmitSlotDeclResult {
  const diagnostics: Diagnostic[] = [];
  const slots = ir.slots ?? [];
  if (slots.length === 0) {
    return {
      fields: '',
      ctxInterfaces: [],
      slotChangeWiring: '',
      hostListenerWiring: [],
      preSeedLines: '',
      diagnostics,
    };
  }

  opts.decorators.add('state');
  opts.decorators.add('queryAssignedElements');
  // Phase 07.5 — add `property` decorator import only when at least one slot
  // needs the function-prop receiver (scoped or portal). Avoids unused-import
  // noise for components with paramless static slots only.
  if (slots.some((s) => s.isPortal === true || s.params.length > 0)) {
    opts.decorators.add('property');
  }

  const ctxInterfaces: string[] = [];
  const hostListenerWiring: string[] = [];
  const slotChangeWiringLines: string[] = [];
  const preSeedLinesArr: string[] = [];
  const methodNameSet = collectMethodNamesFromIR(ir);

  const fields = slots
    .map((slot) =>
      emitOneSlot(
        slot,
        ctxInterfaces,
        hostListenerWiring,
        slotChangeWiringLines,
        preSeedLinesArr,
        methodNameSet,
      ),
    )
    .join('\n');

  return {
    fields,
    ctxInterfaces,
    slotChangeWiring: slotChangeWiringLines.join('\n\n'),
    hostListenerWiring,
    // 4-space indent matches the body of connectedCallback() (the splice site
    // in emitLit.ts composeClassBody).
    preSeedLines: preSeedLinesArr.join('\n    '),
    diagnostics,
  };
}
