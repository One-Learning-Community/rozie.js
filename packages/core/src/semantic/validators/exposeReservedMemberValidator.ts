/**
 * Phase 46 (ITEM-3, D-02/D-03b) — `$expose` verb shadows an inherited member
 * validator (ROZ137).
 *
 * `$expose({ valueOf })` exposes a `<script>` function as a consumer-callable
 * imperative handle. On the CLASS-BASED targets the exposed method becomes a
 * class method, so a verb name that shadows an INHERITED member of the emitted
 * class silently breaks compilation on those targets ONLY — a brutal
 * target-asymmetric footgun:
 *
 *   - `Object.prototype` member (Angular + Lit class targets): `valueOf`,
 *     `toString`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`,
 *     `toLocaleString`. A class method named `valueOf` breaks the legacy
 *     `@property` decorator's `Object`-assignability and cascades TS1240/TS1271
 *     to EVERY decorator on the Lit class (the listbox `valueOf` finding — 38
 *     errors from ONE name). React/Vue/Svelte/Solid (where the handle is an
 *     object literal, not a class) compile clean.
 *   - `HTMLElement`/`Element`/`Node` inherited member (LIT only): `focus`,
 *     `blur`, `click`, `scrollTo`, `scrollIntoView`, `nodeType`, `id`, …. The
 *     Lit component IS an `HTMLElement` subclass, so the exposed method shadows
 *     the base-class method/property (the Embla `scrollTo`→TS2416 finding).
 *
 * ROZ137 (warning severity) fires when a verb name is in either reserved set,
 * naming the affected class targets and suggesting a suffix rename
 * (`valueOf` → `readValue`, `scrollTo` → `scrollToIndex`). Warn (not error): a
 * legitimate non-class-target build still compiles — it is a target-asymmetric
 * footgun, not a universal break.
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   A `$expose` verb name (from `bindings.expose`, the canonical top-level call's
 *   extracted key names) that is in the `Object.prototype` set OR the
 *   `HTMLElement`/`Element`/`Node` inherited-member set.
 *
 * ── DO-NOT-FLAG ──────────────────────────────────────────────────────────────
 *   - A non-reserved verb (`open`, `clear`, `flyTo`, …) — zero false positives.
 *   - A plain `<script>` local named `valueOf` that is NOT exposed (a separate
 *     class-field concern; this validator scopes to the EXPOSED surface only).
 *   - `constructor`/`prototype`/`__proto__` are filtered out by the collector
 *     BEFORE they reach `bindings.expose` (see ExposedMethodEntry), so they
 *     never appear here. (They are still in the Object.prototype rationale set,
 *     but they cannot be exposed in the first place.)
 *
 * Reads `bindings.expose` (same source as `runExposeValidator`'s collision
 * check), so each entry carries a `sourceLoc` — no AST re-walk, precise loc.
 * Never mutates the AST. NEVER throws (D-08).
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import {
  OBJECT_PROTOTYPE_MEMBERS as OBJECT_PROTOTYPE_MEMBERS_SOURCE,
  LIT_DOM_MEMBERS,
  LIT_LIFECYCLE_MEMBERS,
  ANGULAR_LIFECYCLE_MEMBERS,
  ANGULAR_CVA_MEMBERS,
} from '../../rewrite/reservedNames.js';
import type { BindingsTable } from '../types.js';

/**
 * `Object.prototype` members an exposed verb must not shadow on a class-based
 * target (Angular + Lit). Sourced from the shared `reservedNames.ts` single-
 * source-of-truth (Plan 61-01) so ROZ137 and the new ROZ142 validator never
 * drift. `constructor` cannot actually be exposed (the collector filters it), so
 * the Object.prototype set is used as-is for the OBJECT-MEMBER class; the
 * Angular-lifecycle `constructor` is folded into the WIDENED set below for the
 * class-target lifecycle class.
 */
const OBJECT_PROTOTYPE_MEMBERS = OBJECT_PROTOTYPE_MEMBERS_SOURCE;

/**
 * Phase 61 (Plan 61-02) WIDENING — the class-target lifecycle / framework-
 * reserved members an exposed verb must not shadow. Previously ROZ137 only
 * caught Object.prototype + DOM-inherited members; the research widened it to
 * the FULL Lit Group C (LitElement/ReactiveElement lifecycle) + Angular
 * lifecycle hooks + `constructor` + the CVA quartet (single-model). Sourced from
 * `reservedNames.ts` so it shares ONE table with Half A and the ROZ142 lint —
 * no inline re-listing.
 *
 * Treated together with the DOM-inherited members below as the "class-target
 * inherited/reserved" class: a verb here breaks Lit (lifecycle override silently
 * disables reactivity, or the CVA quartet duplicate-defines) or Angular (a
 * same-named member is invoked as a real hook, or the CVA quartet → TS2300).
 */
const CLASS_TARGET_RESERVED_MEMBERS = new Set<string>([
  ...LIT_LIFECYCLE_MEMBERS,
  ...ANGULAR_LIFECYCLE_MEMBERS, // includes `constructor`
  ...ANGULAR_CVA_MEMBERS,
]);

/**
 * Inherited `HTMLElement` / `Element` / `Node` / `EventTarget` members an
 * exposed verb must not shadow on Lit (the LitElement IS an HTMLElement
 * subclass). Sourced from the shared `LIT_DOM_MEMBERS` table (Plan 61-01) — the
 * FULL Group A DOM chain (closes R-NEW-6: `popover`/`inert`/`aria*` no longer
 * slip), replacing the previous hand-maintained conservative subset.
 */
const DOM_INHERITED_MEMBERS = LIT_DOM_MEMBERS;

/**
 * Run the `$expose`-verb-shadows-inherited-member validator over the given AST.
 * Emits ROZ137 (warning) into `diagnostics`. NEVER throws (D-08). Reads
 * `bindings.expose`; never mutates the AST.
 */
export function runExposeReservedMemberValidator(
  _ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  // `bindings.expose` is the extracted key-name list of the canonical top-level
  // `$expose({...})` call (malformed/nested calls produce no names). `[]` when
  // there is no $expose — nothing to validate.
  const exposed = bindings.expose;
  if (exposed.length === 0) return;

  try {
    for (const entry of exposed) {
      const name = entry.name;
      const isObjectMember = OBJECT_PROTOTYPE_MEMBERS.has(name);
      const isClassReserved = CLASS_TARGET_RESERVED_MEMBERS.has(name);
      const isDomMember = DOM_INHERITED_MEMBERS.has(name);
      if (!isObjectMember && !isClassReserved && !isDomMember) continue;

      // Build the target list + rationale. An Object.prototype member OR a
      // class-target lifecycle/CVA member breaks Angular + Lit (both class
      // targets); a DOM-inherited member breaks Lit only (the HTMLElement
      // subclass). Object.prototype + class-reserved take precedence in the
      // message (broader Angular+Lit surface) over a DOM-only match.
      const angularLitClass = isObjectMember || isClassReserved;
      const targets = angularLitClass ? 'Angular + Lit' : 'Lit';
      const surface = isObjectMember
        ? `inherited Object.prototype member`
        : isClassReserved
          ? `framework-reserved class member (Lit/Angular lifecycle or the Angular ControlValueAccessor quartet)`
          : `inherited HTMLElement/Element/Node member`;
      const suggestion = angularLitClass ? 'readValue' : `${name}Index`;

      diagnostics.push({
        code: RozieErrorCode.EXPOSE_RESERVED_MEMBER,
        severity: 'warning',
        message: `$expose({ ${name} }) shadows the ${surface} '${name}' on the class-based target(s) ${targets} — the exposed method becomes a class member that collides with the inherited one (TS1240/TS1271 on Lit's @property decorators for Object.prototype names; TS2416 for DOM members). Suffix-rename the verb (e.g. '${suggestion}').`,
        loc: entry.sourceLoc,
        hint: `Rename the exposed method so its name is not a ${isObjectMember ? 'Object.prototype member' : isClassReserved ? 'framework-reserved class member (lifecycle / CVA)' : 'HTMLElement/Element/Node member'} (e.g. '${suggestion}'); the rename is internal — the consumer-facing handle name is whatever you choose.`,
      });
    }
  } catch {
    // Defensive: bindings.expose is already-extracted plain data, but never let
    // an unexpected shape propagate — collected-not-thrown (D-08).
  }
}
