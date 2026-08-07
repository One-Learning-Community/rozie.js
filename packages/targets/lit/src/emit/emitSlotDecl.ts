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
import type {
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
} from '../rewrite/collectLitImports.js';
import { collectMethodNamesFromIR } from './methodNames.js';
import { portalSlotMemberName } from './portalSlotMemberName.js';
import { slotScopeParamType, slotScopeTypeObject } from './slotScopeParamType.js';

export interface EmitSlotDeclOpts {
  decorators: LitDecoratorImportCollector;
  /**
   * quick 260807-cor (D4) — preact-signals import collector, threaded so
   * `emitOneSlot` can register `signal` (and ONLY `signal`; the effect route
   * is already registered by emitScript.ts's watcher pass) when it emits an
   * assigned-elements field. Optional so every pre-existing call site
   * (emitSlotDecl.test.ts's direct-construction tests) stays source-compatible
   * — omitting it is safe as long as `slottedReads` is also omitted/empty,
   * since no field is emitted without a hit in that set.
   */
  signals?: PreactSignalsImportCollector;
  /**
   * quick 260807-cor (D4) — the set of slot keys ('default' for the unnamed
   * slot, else the authored name) read through `$slotted.<name>` anywhere in
   * the component's `<script>`, from `collectSlottedReads.ts`. A slot whose
   * key is NOT in this set gets no assigned-elements field, no signal write,
   * no pre-seed line — byte-identical to pre-D4 output. Defaults to an empty
   * set (no slot ever qualifies) when omitted.
   */
  slottedReads?: ReadonlySet<string>;
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
  ir: IRComponent,
  ctxInterfaces: string[],
  hostListenerWiring: string[],
  slotChangeWiringLines: string[],
  preSeedLines: string[],
  methodNameSet: Set<string>,
  slottedReads: ReadonlySet<string>,
  signals: PreactSignalsImportCollector | undefined,
): string {
  const suffix = slotFieldSuffix(slot.name);
  const stateField = `  @state() private _hasSlot${suffix} = false;`;

  // @queryAssignedElements decorator — D-LIT-14 correction.
  const opts =
    slot.name === ''
      ? '{ flatten: true }'
      : `{ slot: '${slot.name}', flatten: true }`;
  const queryField = `  @queryAssignedElements(${opts}) private _slot${suffix}Elements!: Element[];`;

  // quick 260807-cor (D4) — gate: this slot's assigned-elements field/write/
  // pre-seed are emitted ONLY when the component actually reads
  // `$slotted.<this-slot's-authored-key>` somewhere in <script>. Un-gated
  // components (the other 30 slot-bearing Lit leaves) stay byte-identical.
  const authoredKey = slot.name === '' ? 'default' : slot.name;
  const readsSlotted = slottedReads.has(authoredKey);
  let assignedField = '';
  if (readsSlotted) {
    signals?.add('signal');
    assignedField = `  private _slot${suffix}Assigned = signal<Element[]>([]);`;
  }

  // slotchange wiring: register on every <slot> element in the shadow tree
  // and update the corresponding _hasSlot<X> field. We register per-slot to
  // keep the logic readable; performance impact is negligible for ≤4 slots.
  const selector = slot.name === '' ? 'slot:not([name])' : `slot[name="${slot.name}"]`;
  // quick 260807-cor (D4) — when gated ON, the update closure ALSO resolves
  // the current assigned elements and writes the signal, but ONLY when the
  // resolved list differs from the previous one by length or per-index
  // identity (T-260807-01 mitigation, mandatory). An unconditional write
  // allocates a new array identity on every slotchange, permanently
  // dirtying the signal — the same re-entrancy class as the MapLibre
  // SignalWatcher incident. `this._slot<X>Elements` (the existing
  // @queryAssignedElements getter) is the resolved-elements source of
  // truth; no new query mechanism is introduced.
  const updateBody = readsSlotted
    ? [
        `    const update = () => {`,
        `      this._hasSlot${suffix} = this._slot${suffix}Elements.length > 0;`,
        `      const assigned = this._slot${suffix}Elements;`,
        `      const prev = this._slot${suffix}Assigned.value;`,
        `      if (assigned.length !== prev.length || assigned.some((el, i) => el !== prev[i])) {`,
        `        this._slot${suffix}Assigned.value = assigned;`,
        `      }`,
        `    };`,
      ].join('\n')
    : `    const update = () => { this._hasSlot${suffix} = this._slot${suffix}Elements.length > 0; };`;
  slotChangeWiringLines.push(
    [
      `{`,
      `  const slotEl = this.shadowRoot?.querySelector('${selector}');`,
      `  if (slotEl !== null && slotEl !== undefined) {`,
      updateBody,
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
    // quick 260807-cor (D4) — assigned-elements pre-seed, gated identically
    // to the field/write above. The @queryAssignedElements-backed getter is
    // empty until the <slot> element exists in the shadow root (not before
    // firstUpdated), so THIS pre-seed is what makes a mount-phase
    // `$slotted.<X>` read (inside $onMount) resolve non-zero — mirrors why
    // the presence pre-seed above exists (D-LIT-15).
    if (readsSlotted) {
      preSeedLines.push(
        `this._slot${suffix}Assigned.value = Array.from(this.children).filter((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));`,
      );
    }
  } else {
    preSeedLines.push(
      `this._hasSlot${suffix} = Array.from(this.children).some((el) => el.getAttribute('slot') === '${slot.name}');`,
    );
    if (readsSlotted) {
      preSeedLines.push(
        `this._slot${suffix}Assigned.value = Array.from(this.children).filter((el) => el.getAttribute('slot') === '${slot.name}');`,
      );
    }
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
      const fields = slot.params
        .map((p, i) => `  ${p.name}: ${slotScopeParamType(slot.paramTypes, i)};`)
        .join('\n');
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
    // WR-02 (Phase 07.5 review): sentinel uses double-underscore + `rozie` infix
    // so the chance of a user authoring `<slot name="__rozieDefaultSlot__">` and
    // colliding with the synthetic default-slot property is vanishingly small.
    // Single-underscore `_defaultSlotFn` was the prior name; it left a plausible
    // collision surface in v1 user slot names. Lockstep across emitSlotDecl /
    // emitSlotFiller / emitTemplate.
    // Collision-gated disambiguation (mirrors Solid's `Slot` suffix, but only
    // when the bare slot name collides with a declared prop — keeps existing
    // non-colliding fixtures byte-identical). The consumer-side emitSlotFiller
    // applies the SAME helper against the producer's prop list so the
    // `.<member>=` property assignment stays in lockstep.
    const propertyFieldName =
      slot.name === '' ? '__rozieDefaultSlot__' : portalSlotMemberName(slot.name, ir);
    const scopeType =
      slot.params.length > 0
        ? slotScopeTypeObject(slot.params, slot.paramTypes)
        : 'unknown';
    propertyField = `  @property({ attribute: false }) ${propertyFieldName}?: (scope: ${scopeType}) => unknown;`;
  }

  return [stateField, queryField, assignedField, propertyField]
    .filter((s) => s.length > 0)
    .join('\n');
}

export function emitSlotDecl(
  ir: IRComponent,
  opts: EmitSlotDeclOpts,
): EmitSlotDeclResult {
  const diagnostics: Diagnostic[] = [];
  const slottedReads = opts.slottedReads ?? new Set<string>();
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

  // Dedupe by DISTINCT slot name before emitting the class-field declarations,
  // slotchange wiring, pre-seed lines and ctx interfaces. A template may
  // legitimately declare the same `<slot name="X">` more than once (e.g. one
  // value-bubble per thumb in a range slider), in which case `ir.slots` carries
  // one SlotDecl entry per OCCURRENCE. The render-time `<slot name="X">` markup
  // is emitted per-occurrence by emitTemplate (Lit supports multiple `<slot
  // name="X">` projecting the same assigned nodes) — but the backing
  // `@state _hasSlot<X>` / `@queryAssignedElements _slot<X>Elements` /
  // `@property <X>` class members and their slotchange listener registration
  // must be emitted EXACTLY ONCE per distinct slot name, otherwise the emitted
  // class has duplicate identifier declarations and fails to compile.
  // The first occurrence wins (slot params/portal-ness are identical across
  // same-named occurrences in practice; first-wins is deterministic and matches
  // the other five targets' single-declaration behavior).
  const seenSlotNames = new Set<string>();
  const distinctSlots = slots.filter((slot) => {
    if (seenSlotNames.has(slot.name)) return false;
    seenSlotNames.add(slot.name);
    return true;
  });

  const fields = distinctSlots
    .map((slot) =>
      emitOneSlot(
        slot,
        ir,
        ctxInterfaces,
        hostListenerWiring,
        slotChangeWiringLines,
        preSeedLinesArr,
        methodNameSet,
        slottedReads,
        opts.signals,
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
