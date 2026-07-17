/**
 * Quick 260717-8zb (Task 2 Item 5) — Lit inherited-HTMLElement/Element/Node
 * PROPERTY prop-name validator (ROZ147, suppressible warning).
 *
 * The property-sibling gap of the existing ROZ142
 * (`PUBLIC_CONTRACT_NAME_COLLISION`, reservedNameCollisionValidator.ts)
 * prop-warning tier. ROZ142 folds `LIT_DOM_METHOD_MEMBERS` in WHOLESALE (an
 * inherited-method-named prop is an UNCONDITIONAL TS2416 on Lit, so no
 * curation is needed) but folds inherited DATA PROPERTIES in only via
 * `LIT_DOM_PROP_FOOTGUNS` — a deliberately CURATED, corpus-absent subset,
 * hand-picked to the names that actually caused a TS2416/TS1238 break in the
 * port findings, explicitly EXCLUDING names the shipping corpus already ships
 * safely (`id`, `title`, `draggable`, `autofocus`, `style`, the aria*
 * reflection block — see that file's comment for the full rationale).
 *
 * ROZ147 widens coverage to the REMAINING inherited HTMLElement/Element/Node
 * property names — `LIT_DOM_MEMBERS` minus the method set (already handled by
 * ROZ142) minus `LIT_DOM_PROP_FOOTGUNS` (already warned by ROZ142) — so the two
 * validators never double-fire on the same prop. Because this is a BROADER,
 * less-curated set than ROZ142's hand-picked footgun list, it may legitimately
 * flag an ALREADY-SHIPPED prop the corpus carries safely (e.g. a prop whose
 * declared TYPE happens to be assignable to the inherited property's type, so
 * it compiles clean today but is still a latent shadow). That is why ROZ147 is
 * a `warning`, not an `error` — a suppressible steer, not a build-breaking
 * gate. The corpus would-warn list is reported once per release (see the
 * 260717-8zb quick-task SUMMARY) rather than hand-curated away here.
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   A `<props>` key (from `bindings.props`) equal to a name in
 *   `LIT_DOM_MEMBERS` that is NOT in `LIT_DOM_METHOD_MEMBERS` and NOT already
 *   in `LIT_DOM_PROP_FOOTGUNS`.
 *
 * ── DO-NOT-FLAG ──────────────────────────────────────────────────────────────
 *   - A prop name already covered by ROZ142 (method OR curated footgun tier) —
 *     no double-firing.
 *   - Any prop name not in `LIT_DOM_MEMBERS` at all.
 *
 * Reads `bindings.props`; never mutates the AST. NEVER throws (D-08).
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { LIT_DOM_MEMBERS, LIT_DOM_METHOD_MEMBERS } from '../../rewrite/reservedNames.js';
import { LIT_DOM_PROP_FOOTGUNS } from './reservedNameCollisionValidator.js';
import type { BindingsTable } from '../types.js';

/**
 * KNOWN-SAFE corpus names, curated per the SAME rationale ROZ142's own comment
 * documents for `LIT_DOM_PROP_FOOTGUNS`: "the shipping corpus byte-verifiably
 * ships a handful of DOM-member-named props (`id`, `title`, `draggable`,
 * `autofocus`, `style`, plus the entire aria* reflection block via
 * `ariaLabel`) cleanly across all six targets — flagging those is a FALSE
 * POSITIVE." The 28-family corpus scan (Quick 260717-8zb SUMMARY) confirmed
 * this empirically: `ariaLabel` alone accounted for 13/20 raw hits (every
 * accessible-name prop in the corpus is typed `string | null | undefined`,
 * exactly matching `HTMLElement.ariaLabel`'s reflected type, so it never
 * actually breaks a Lit typecheck) and `id`/`autofocus`/`draggable` accounted
 * for the rest. ROZ147 excludes this SAME known-safe set (plus the full
 * aria* reflection block, matched by prefix so the exclusion doesn't drift
 * out of sync with `LIT_DOM_MEMBERS`) so it widens coverage to the GENUINE
 * gap (`baseURI`, `childNodes`, `shadowRoot`, `part`, `slot`, `role`,
 * `tagName`, `offsetWidth`, …) without reproducing ROZ142's exact
 * already-solved false-positive class.
 */
const KNOWN_SAFE_CORPUS_PROPS: ReadonlySet<string> = new Set([
  'id',
  'title',
  'draggable',
  'autofocus',
  'style',
]);

/** Matches the aria* reflection block (`ariaLabel`, `ariaHidden`, …) by prefix
 *  so the exclusion tracks `LIT_DOM_MEMBERS` automatically. */
const ARIA_REFLECTION_PREFIX = /^aria[A-Z]/;

/**
 * The candidate set: inherited HTMLElement/Element/Node PROPERTY names ROZ142
 * does NOT already cover AND that are not a documented known-safe corpus name.
 * Computed once at module load (all source sets are static
 * `ReadonlySet<string>`s).
 */
const LIT_INHERITED_PROPERTY_CANDIDATES: ReadonlySet<string> = new Set(
  [...LIT_DOM_MEMBERS].filter(
    (name) =>
      !LIT_DOM_METHOD_MEMBERS.has(name) &&
      !LIT_DOM_PROP_FOOTGUNS.has(name) &&
      !KNOWN_SAFE_CORPUS_PROPS.has(name) &&
      !ARIA_REFLECTION_PREFIX.test(name),
  ),
);

/**
 * Run the Lit inherited-DOM-property prop-name validator. Emits ROZ147
 * (warning) into `diagnostics` for every `<props>` key that collides with an
 * inherited HTMLElement/Element/Node PROPERTY not already covered by ROZ142.
 * NEVER throws (D-08). Reads `bindings.props`; never mutates the AST.
 */
export function runLitInheritedPropertyValidator(
  _ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  try {
    for (const [name, entry] of bindings.props) {
      if (!LIT_INHERITED_PROPERTY_CANDIDATES.has(name)) continue;
      diagnostics.push({
        code: RozieErrorCode.LIT_INHERITED_PROPERTY_PROP_NAME,
        severity: 'warning',
        message: `<props> key '${name}' collides with the inherited HTMLElement/Element/Node property '${name}' — on Lit this becomes a @property class field that SHADOWS the base-class property. If the declared type is not assignable to the inherited type this is a hard TS2416/TS1238 at the Lit leaf's typecheck; even when it happens to compile, reading/writing '${name}' now hits your prop instead of the real DOM property.`,
        loc: entry.sourceLoc,
        hint: `Rename the prop so its name is not an inherited DOM property (e.g. '${name}Base' or a more descriptive alternative). If this collision is already known-safe and shipped (a grandfathered case), this warning is advisory only — it never blocks the build.`,
      });
    }
  } catch {
    // Defensive: bindings.props is already-extracted plain data, but never let
    // an unexpected shape propagate — collected-not-thrown (D-08).
  }
}
