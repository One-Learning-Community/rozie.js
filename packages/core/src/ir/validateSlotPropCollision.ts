/**
 * validateSlotPropCollision — Phase 28 (slot/prop same-name collision class).
 *
 * Post-IR pass that flags every `<slot name="X">` whose `X` equals a declared
 * `<props>` key. Such a component is unsupportable uniformly across the six
 * targets:
 *
 *   - Svelte 5 unifies snippets and props into ONE `$props()` namespace. The
 *     regenerated Svelte leaf's `Props` interface would declare `X` TWICE —
 *     once with the prop's type, once as a `Snippet` — and BOTH would source
 *     from the same `props.X` key, so setting the prop value poisons the slot
 *     derivation (a runtime collision invisible at compile time).
 *
 *   - The other five targets keep prop and slot in distinct consumer
 *     namespaces (React `slots={{}}`, Vue `#slot`, Angular contentChild, Solid
 *     `XSlot`, Lit `.XSlot`) and are immune.
 *
 * That asymmetry is a silent cross-target divergence on 1 of 6 targets, so per
 * the project's "make the unrepresentable a loud compile error" discipline this
 * pass turns it into a hard ERROR (ROZ127 SLOT_PROP_NAME_COLLISION).
 *
 * Diagnostic shape — a DUAL code-frame (mirrors validateTwoWayBindings' ROZ949):
 *   - primary frame at the `<slot>` declaration loc;
 *   - `related[]` secondary frame at the colliding `<props>` declaration loc.
 * The message explains WHY (Svelte 5's unified `$props` namespace) and the
 * REMEDIATION (rename the slot — append `Content` / the engine hook name).
 *
 * Case-sensitive (`X` ≠ `x`) — the per-target namespaces are case-sensitive.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All collisions push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a colliding
 * `.rozie` fails regardless of entrypoint (it must fail in a Vite build, not
 * just `compile()`).
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';

/**
 * Phase 61 Plan 61-02 Task 3 — a valid JS/TS identifier shape. Vue's
 * `defineSlots<{ ... }>()` does NOT quote slot keys, so a hyphenated /
 * leading-digit / otherwise non-identifier slot name emits an unquoted key that
 * fails to parse → TS1005 on the Vue leaf (collision-vue §3.4 set F). Anchored
 * full-string test.
 */
const VALID_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Phase 61 Plan 61-02 Task 3 — inherited DOM/Object.prototype members a SCOPED
 * or named slot must not collide with on Lit. A consumer slot lowers (on Lit) to
 * a bare `@property`-decorated class field / accessor named after the slot; a
 * slot named `title`/`id`/`focus`/… collides with the inherited `HTMLElement`/
 * `Element`/`Node` member (collision-lit kind 5 / R-NEW-3). Curated high-signal
 * subset (the names that actually surface as bare slot/property collisions on a
 * Lit leaf — TS2416). A name absent here is simply not flagged (no false
 * positive cost). NOTE: kept local (not the full LIT_DOM_MEMBERS chain) because
 * many DOM-member names are legitimate slot names; this is the high-collision
 * subset, mirroring the prop-footgun discipline in reservedNameCollisionValidator.
 */
const SLOT_DOM_FOOTGUNS: ReadonlySet<string> = new Set<string>([
  'title', 'id', 'slot', 'style', 'className', 'hidden', 'tabIndex',
  'focus', 'blur', 'click', 'role', 'part', 'children', 'innerHTML',
  'nodeType', 'nodeName', 'textContent', 'dataset',
]);

/**
 * Validate every declared slot name against the component's `<props>` keys.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ127 pushed per collision)
 */
export function validateSlotPropCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // Build a name → PropDecl lookup once. `<props>` keys are unique, so a Map is
  // the right shape; the value carries the colliding prop's sourceLoc for the
  // secondary code-frame.
  const propByName = new Map<string, (typeof ir.props)[number]>();
  for (const prop of ir.props) {
    propByName.set(prop.name, prop);
  }

  // Phase 61 Task 3 — `$expose` verb names a scoped/named slot must not collide
  // with on Lit (the slot's bare accessor vs the exposed class method).
  // `ir.expose` is always populated in production (lowerToIR), but guard against
  // an absent field (a partial test stub / a future IR shape) — never throw.
  const exposeByName = new Map<string, (typeof ir.expose)[number]>();
  for (const verb of ir.expose ?? []) {
    exposeByName.set(verb.name, verb);
  }

  for (const slot of ir.slots) {
    // The default-slot sentinel is the empty string — a `<props>` key can never
    // be the empty string, so it can never collide. Skip defensively anyway.
    if (slot.name === '') continue;

    // ── (1) slot == prop (the original Phase 28 check) ───────────────────────
    const collidingProp = propByName.get(slot.name);
    if (collidingProp !== undefined) {
      diagnostics.push({
        code: RozieErrorCode.SLOT_PROP_NAME_COLLISION,
        severity: 'error',
        message: `<slot name="${slot.name}"> collides with the declared prop '${slot.name}' — a slot and a prop cannot share a name. Svelte 5 unifies snippets and props into ONE \`$props\` namespace, so the regenerated Svelte target would declare '${slot.name}' twice (the prop type AND a Snippet) and source both from the same key, poisoning the slot.`,
        loc: slot.sourceLoc,
        hint: `Rename the slot so its name differs from every <props> key — e.g. append 'Content' or use the engine hook name (name="${slot.name}Content"). The boolean/value prop keeps its name.`,
        related: [
          {
            message: `prop '${slot.name}' declared here`,
            loc: collidingProp.sourceLoc,
          },
        ],
      });
      // One diagnostic per slot — a slot==prop collision is the dominant fault;
      // don't ALSO fire the shape/DOM checks on the same slot (no double-firing).
      continue;
    }

    // ── (2) slot-key SHAPE (Vue defineSlots unquoted-key TS1005) ─────────────
    // Vue's `defineSlots<{ ... }>()` does not quote keys, so a hyphenated /
    // leading-digit / non-identifier slot name (`header-item`, `2col`) emits an
    // unquoted key that fails to parse on the Vue leaf. Hard error.
    if (!VALID_IDENTIFIER.test(slot.name)) {
      diagnostics.push({
        code: RozieErrorCode.SLOT_PROP_NAME_COLLISION,
        severity: 'error',
        message: `<slot name="${slot.name}"> is not a valid identifier — Vue's defineSlots<{…}>() does not quote slot keys, so a hyphenated / leading-digit / non-identifier slot name emits an unquoted object key that fails to parse on the Vue target (TS1005). Slot names must be valid JS identifiers across all six targets.`,
        loc: slot.sourceLoc,
        hint: `Rename the slot to a valid identifier — e.g. camelCase the hyphenated form ('${slot.name}' → '${slot.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/[^A-Za-z0-9_$]/g, '')}').`,
      });
      continue;
    }

    // ── (3) slot == inherited DOM member / $expose verb (Lit collision) ──────
    //
    // GATE (Phase 61 Plan 09): this collision is REAL only for a SCOPED or
    // PORTAL slot. On Lit, ONLY a scoped/portal slot lowers to a bare
    // `@property`-decorated class member named after the slot
    // (`@property title?: (scope) => unknown` — see emitSlotDecl.ts
    // `isScopedOrPortal` + portalSlotMemberName) — THAT bare member shadows the
    // inherited `HTMLElement.title` (TS2416). A PLAIN consumer-provided named
    // slot (no `portal`, no `:params`) lowers to ONLY `_`-prefixed internal
    // members (`_hasSlotTitle` / `_slotTitleElements`) plus a native
    // `<slot name="title">` element — NEITHER collides with any DOM member. The
    // Plan-02 generalization fired on slot NAME unconditionally, false-positiving
    // every plain named slot whose name happened to be a DOM word (e.g. the
    // slot-matrix `consumer-re-projection` wrapper's `<slot name="title">`, which
    // the committed Lit snapshot proves compiles clean). Restrict the check to
    // the slots that actually mint the bare accessor.
    const slotMintsBareAccessor =
      slot.isPortal === true || (slot.params?.length ?? 0) > 0;
    if (!slotMintsBareAccessor) continue;

    const exposeHit = exposeByName.get(slot.name);
    const isDomFootgun = SLOT_DOM_FOOTGUNS.has(slot.name);
    if (exposeHit !== undefined || isDomFootgun) {
      const surface = exposeHit !== undefined
        ? `the \`$expose\` verb '${slot.name}'`
        : `the inherited HTMLElement/Element/Node member '${slot.name}'`;
      const why = exposeHit !== undefined
        ? `On Lit the scoped/named slot lowers to a bare class accessor that collides with the exposed method of the same name (TS2416).`
        : `On Lit the scoped/named slot lowers to a bare \`@property\`-decorated class field that shadows the inherited DOM member (TS2416).`;
      diagnostics.push({
        code: RozieErrorCode.SLOT_PROP_NAME_COLLISION,
        severity: 'error',
        message: `<slot name="${slot.name}"> collides with ${surface}. ${why} Rename the slot so its name is distinct.`,
        loc: slot.sourceLoc,
        hint: `Rename the slot — e.g. append 'Content' (name="${slot.name}Content") or the engine hook name. The exposed verb / DOM member keeps its name.`,
        ...(exposeHit !== undefined
          ? { related: [{ message: `$expose verb '${slot.name}' declared here`, loc: exposeHit.sourceLoc }] }
          : {}),
      });
    }
  }
}
