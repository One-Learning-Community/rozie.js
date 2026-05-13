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
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { LitDecoratorImportCollector } from '../rewrite/collectLitImports.js';

export interface EmitSlotDeclOpts {
  decorators: LitDecoratorImportCollector;
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
      `    update();`,
      `  }`,
      `}`,
    ].join('\n'),
  );

  // ctxInterfaces — emit if there are data-typed slot params.
  if (slot.params.length > 0) {
    const ifaceName = `Rozie${suffix}SlotCtx`;
    const fields = slot.params.map((p) => `  ${p.name}: unknown;`).join('\n');
    ctxInterfaces.push(`interface ${ifaceName} {\n${fields}\n}`);
  }

  return `${stateField}\n${queryField}`;
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
      diagnostics,
    };
  }

  opts.decorators.add('state');
  opts.decorators.add('queryAssignedElements');

  const ctxInterfaces: string[] = [];
  const hostListenerWiring: string[] = [];
  const slotChangeWiringLines: string[] = [];

  const fields = slots
    .map((slot) =>
      emitOneSlot(slot, ctxInterfaces, hostListenerWiring, slotChangeWiringLines),
    )
    .join('\n');

  return {
    fields,
    ctxInterfaces,
    slotChangeWiring: slotChangeWiringLines.join('\n\n'),
    hostListenerWiring,
    diagnostics,
  };
}
