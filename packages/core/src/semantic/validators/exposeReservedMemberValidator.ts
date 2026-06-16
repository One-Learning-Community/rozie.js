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
import type { BindingsTable } from '../types.js';

/**
 * `Object.prototype` members an exposed verb must not shadow on a class-based
 * target (Angular + Lit). `constructor` is documented for rationale but cannot
 * actually be exposed (the collector filters it), so it is omitted from the live
 * match set to avoid implying it could appear. Source: the enumerable +
 * well-known non-enumerable `Object.prototype` members per `lib.es5.d.ts`.
 */
const OBJECT_PROTOTYPE_MEMBERS = new Set<string>([
  'valueOf',
  'toString',
  'toLocaleString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
]);

/**
 * Inherited `HTMLElement` / `Element` / `Node` / `EventTarget` members an
 * exposed verb must not shadow on Lit (the LitElement IS an HTMLElement
 * subclass). Derived from `lib.dom.d.ts` (per A2: the inherited surface a
 * component author is most likely to collide with — methods + a handful of
 * well-known properties). Conservative high-signal subset; a name absent here
 * is simply not flagged (warn-only, no false-positive cost).
 */
const DOM_INHERITED_MEMBERS = new Set<string>([
  // EventTarget
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  // Node
  'appendChild',
  'cloneNode',
  'contains',
  'insertBefore',
  'removeChild',
  'replaceChild',
  'normalize',
  'nodeType',
  'nodeName',
  'nodeValue',
  'textContent',
  'childNodes',
  'firstChild',
  'lastChild',
  'parentNode',
  'parentElement',
  'nextSibling',
  'previousSibling',
  // Element
  'getAttribute',
  'setAttribute',
  'removeAttribute',
  'hasAttribute',
  'getBoundingClientRect',
  'closest',
  'matches',
  'querySelector',
  'querySelectorAll',
  'scrollTo',
  'scrollBy',
  'scrollIntoView',
  'attachShadow',
  'id',
  'className',
  'classList',
  'innerHTML',
  'outerHTML',
  'slot',
  'attributes',
  'tagName',
  // HTMLElement
  'focus',
  'blur',
  'click',
  'title',
  'hidden',
  'style',
  'dataset',
  'offsetWidth',
  'offsetHeight',
  'offsetParent',
]);

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
      const isDomMember = DOM_INHERITED_MEMBERS.has(name);
      if (!isObjectMember && !isDomMember) continue;

      // Build the target list + rationale. An Object.prototype member breaks
      // Angular + Lit (both class targets); a DOM-inherited member breaks Lit
      // only (the HTMLElement subclass). A name that is in BOTH sets (none
      // currently, but defensively) names the broader Angular+Lit surface.
      const targets = isObjectMember ? 'Angular + Lit' : 'Lit';
      const surface = isObjectMember
        ? `inherited Object.prototype member`
        : `inherited HTMLElement/Element/Node member`;
      const suggestion = isObjectMember ? 'readValue' : `${name}Index`;

      diagnostics.push({
        code: RozieErrorCode.EXPOSE_RESERVED_MEMBER,
        severity: 'warning',
        message: `$expose({ ${name} }) shadows the ${surface} '${name}' on the class-based target(s) ${targets} — the exposed method becomes a class member that collides with the inherited one (TS1240/TS1271 on Lit's @property decorators for Object.prototype names; TS2416 for DOM members). Suffix-rename the verb (e.g. '${suggestion}').`,
        loc: entry.sourceLoc,
        hint: `Rename the exposed method so its name is not an inherited ${isObjectMember ? 'Object.prototype' : 'HTMLElement/Element/Node'} member (e.g. '${suggestion}'); the rename is internal — the consumer-facing handle name is whatever you choose.`,
      });
    }
  } catch {
    // Defensive: bindings.expose is already-extracted plain data, but never let
    // an unexpected shape propagate — collected-not-thrown (D-08).
  }
}
