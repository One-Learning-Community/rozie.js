/**
 * Phase 61 Plan 61-02 (Half B, SC-3) — public-contract reserved-name collision
 * validator (ROZ142 + ROZ981).
 *
 * A consumer-VISIBLE author name — a `<props>` key (plain or `model:true`), an
 * emit name, or a `$expose` verb — that equals a per-target RESERVED name CANNOT
 * be auto-renamed: renaming it would silently break the consumer-facing API.
 * Half A (the per-target emitter deconfliction) only renames INTERNAL bindings;
 * a public-contract collision has no safe auto-fix, so it must surface as ONE
 * clear compile error at author time instead of a downstream TS2300/TS2416/
 * TS1005 wall (gate 3/4) — or, worse, a SILENT runtime bug that no typecheck
 * catches at all.
 *
 * The SILENT danger tier is handled FIRST and as `severity: 'error'`:
 *   - Vue: a `<props>` key in `key`/`ref`/`is`/`ref_for`/`ref_key` is STRIPPED
 *     by Vue's template compiler — the prop silently never receives a value
 *     (no TS error).
 *   - React: a `<props>` key in `key`/`ref`/`children`/`dangerouslySetInnerHTML`
 *     is SWALLOWED by React's element machinery — a behavior bug with no TS
 *     error at any gate.
 *   - Svelte: two emits that NORMALIZE to the same `on<normalized>` callback
 *     prop (`fooBar` + `foo-bar` → `onfoobar`) collapse onto one callback at
 *     runtime — the second silently shadows the first (ROZ981, runtime-only).
 *
 * The non-silent tier (hard typecheck breaks) also fires as `error` because a
 * public-contract name CANNOT be auto-renamed — it is a genuine compile failure
 * downstream:
 *   - Lit: a `<props>` key that is an inherited DOM member (`id`/`title`/
 *     `tabIndex`/…) becomes a class field colliding with `HTMLElement.id` etc.
 *     → hard TS2416/TS1238/TS1240 at the per-leaf typecheck (the `id`→`idBase`
 *     manual-fix history).
 *   - Angular/Lit/Svelte: a reserved-word / rune-named prop is illegal as a
 *     binding.
 *
 * OWNERSHIP SPLIT (no double-firing):
 *   - This SEMANTIC validator owns: props (plain+model), emits, $expose verbs
 *     ($expose delegates to the WIDENED ROZ137 in exposeReservedMemberValidator
 *     — NOT re-checked here), provide/inject keys (no work — see note below).
 *   - The IR validator `validateSlotPropCollision` (ROZ127) owns ALL slot-name
 *     collisions: slot==prop, slot-key-shape (hyphenated/leading-digit), and
 *     slot==DOM-member/expose-verb. Slots are therefore NOT checked here.
 *
 * provide/inject: the inject-LOCAL binding is INTERNAL (Half A auto-renames it);
 * the KEY is a runtime string literal (never an identifier), so it cannot
 * collide with a reserved name. No work here beyond this note.
 *
 * Sources its reserved tables from `packages/core/src/rewrite/reservedNames.ts`
 * (the single source of truth — Plan 61-01) so this validator and Half A never
 * drift. Reads `bindings.props` / `bindings.emits`; never mutates the AST. NEVER
 * throws (D-08).
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { SourceLoc } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import {
  OBJECT_PROTOTYPE_MEMBERS,
  LIT_DOM_METHOD_MEMBERS,
  LIT_LIFECYCLE_MEMBERS,
  ANGULAR_LIFECYCLE_MEMBERS,
  VUE_RESERVED_PROPS,
  REACT_RESERVED_PROPS,
  SVELTE_RUNE_NAMES,
  JS_RESERVED_WORDS,
} from '../../rewrite/reservedNames.js';
import type { BindingsTable } from '../types.js';

/**
 * ── ERROR tier ───────────────────────────────────────────────────────────────
 * A `<props>` key equal to one of these is a HARD compile error on at least one
 * target with NO safe outcome — either a SILENT runtime bug (Vue strips
 * key/ref/is/ref_for/ref_key; React swallows key/ref/children/
 * dangerouslySetInnerHTML — no typecheck net), or a genuinely illegal binding
 * (a JS reserved word / a Svelte rune name cannot be a destructured prop on any
 * target). Verified to have ZERO members in the shipping corpus, so it can fire
 * as `error` without breaking the corpus zero-error gate.
 */
const PROP_ERROR_TIER: ReadonlySet<string> = new Set<string>([
  ...VUE_RESERVED_PROPS, // key, ref, is, ref_for, ref_key — Vue SILENT strip
  ...REACT_RESERVED_PROPS, // key, ref, children, dangerouslySetInnerHTML — React SILENT swallow
  ...JS_RESERVED_WORDS, // illegal as a binding on every target
  ...SVELTE_RUNE_NAMES, // `$props`/`$state`/… illegal/shadowing in Svelte runes mode
]);

/**
 * ── WARNING tier ─────────────────────────────────────────────────────────────
 * A `<props>` key equal to one of these is a TARGET-ASYMMETRIC footgun, NOT a
 * universal break: on the CLASS targets (Lit/Angular) the prop becomes a class
 * field that shadows an inherited DOM member (`tabIndex`/`inputMode`/`hidden`/…
 * → hard TS2416/TS1238 on a Lit leaf); the five non-Lit / non-class targets
 * compile clean. `warning` (mirrors ROZ137's warn-on-class-asymmetric-footgun
 * philosophy), steering the author to a `${name}Base` rename WITHOUT breaking
 * the corpus zero-error gate.
 *
 * IMPORTANT — CORPUS-ABSENT subset, NOT the full `LIT_DOM_MEMBERS` set. The
 * shipping corpus byte-verifiably ships a handful of DOM-member-named props
 * (`id`, `title`, `draggable`, `autofocus`, `style`, plus the entire aria*
 * reflection block via `ariaLabel`) cleanly across all six targets — flagging
 * those is a FALSE POSITIVE (the "zero false positives on the existing passing
 * corpus" must-have). So the WARNING tier is the HISTORY-DRIVEN high-collision
 * subset of `LIT_DOM_MEMBERS` (the names that actually caused TS2416/TS1238 in
 * the port findings — see the playbook collision catalogue) MINUS every name the
 * corpus ships. Lit lifecycle / Object.prototype / Angular lifecycle members are
 * folded in (none appear in the corpus as a prop). If the corpus later adds a
 * prop named one of these, narrow this set further rather than downgrade to the
 * full DOM chain.
 */
const LIT_DOM_PROP_FOOTGUNS: ReadonlySet<string> = new Set<string>([
  // Inherited HTMLElement reflected properties that became class-field collisions
  // in the port findings (otp/combobox: `inputMode`/`tabIndex`; rete `Port`:
  // `nodeType`). Curated to the high-collision names ABSENT from the corpus.
  'tabIndex', 'inputMode', 'hidden', 'lang', 'dir', 'translate', 'spellcheck',
  'accessKey', 'contentEditable', 'nonce', 'popover', 'inert', 'autocapitalize',
  'autocorrect', 'enterKeyHint', 'nodeType', 'nodeName', 'className', 'innerHTML',
  'outerHTML', 'localName', 'namespaceURI', 'scrollTop', 'scrollLeft',
]);
// The inherited DOM *method* names (`LIT_DOM_METHOD_MEMBERS`) are folded in
// WHOLESALE, not curated like `LIT_DOM_PROP_FOOTGUNS`. A `@property` field named
// after an inherited method is an UNCONDITIONAL TS2416 on the Lit leaf (a data
// type is never assignable to the inherited `(...) => T` signature), whereas a
// reflected data-prop collides only conditionally — so the method class needs no
// hand-curation, and it is corpus-absent (503 .rozie files ship zero method-named
// props). This closes the wavesurfer `normalize` gap (`Node.prototype.normalize`)
// that slipped compile()×6 and only surfaced at the per-leaf Lit typecheck.
const PROP_WARNING_TIER: ReadonlySet<string> = new Set<string>([
  ...LIT_DOM_PROP_FOOTGUNS,
  ...LIT_DOM_METHOD_MEMBERS,
  ...LIT_LIFECYCLE_MEMBERS,
  ...OBJECT_PROTOTYPE_MEMBERS,
  ...ANGULAR_LIFECYCLE_MEMBERS,
]);
// The SILENT/illegal ERROR tier is the high-priority subset of the SILENT set —
// kept as its own predicate for the message wording (Vue strip / React swallow).
const SILENT_RESERVED_PROPS: ReadonlySet<string> = new Set<string>([
  ...VUE_RESERVED_PROPS,
  ...REACT_RESERVED_PROPS,
]);

/**
 * Svelte's emit→callback-prop normalization: `$emit('foo-bar')` lowers to the
 * callback prop `onfoobar`. Two emits whose normalized names are equal collapse
 * onto ONE callback prop at runtime — the second silently shadows the first.
 * MUST stay byte-identical to the Svelte target's `svelteCallbackPropName`
 * (`packages/targets/svelte/src/rewrite/rewriteScript.ts`); core cannot import a
 * target package, so the rule is inlined here. If that helper changes, change
 * this too (the collision contract depends on the exact normalization).
 */
function svelteNormalizedEmit(name: string): string {
  return `on${name.replace(/-/g, '').toLowerCase()}`;
}

/**
 * Suggest a non-reserved rename for a colliding public-contract prop name. The
 * scheme follows the manual-fix history: a DOM-member-ish name gets a `Base`
 * suffix (`id` → `idBase`, the listbox/otp finding), everything else gets a
 * descriptive suffix the author can refine. The consumer must update their
 * call-site, so the suggestion is advisory — the point is to unblock with a
 * known-safe name.
 */
function suggestPropRename(name: string): string {
  return `${name}Base`;
}

/**
 * Run the public-contract reserved-name collision validator. Emits ROZ142
 * (props) and ROZ981 (Svelte emit-normalization collapse) into `diagnostics`.
 * NEVER throws (D-08). Reads `bindings.props` / `bindings.emits`; never mutates
 * the AST.
 */
export function runReservedNameCollisionValidator(
  _ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  try {
    // ── PROPS (plain + model) ────────────────────────────────────────────────
    // A public-contract prop key that is a per-target reserved name cannot be
    // auto-renamed. Two tiers:
    //   - ERROR: SILENT runtime bug (Vue strip / React swallow) or an illegal
    //     binding (JS reserved word / Svelte rune) — verified zero corpus
    //     members, so a hard error is safe.
    //   - WARNING: a class-target-only footgun (Lit/Angular class-field shadow
    //     of an inherited DOM/lifecycle/Object.prototype member) — the corpus
    //     ships such props, so warn (don't break the gate) and steer to a rename.
    // The ERROR tier takes precedence when a name is in both.
    for (const [name, entry] of bindings.props) {
      const isError = PROP_ERROR_TIER.has(name);
      const isWarning = !isError && PROP_WARNING_TIER.has(name);
      if (!isError && !isWarning) continue;

      const isSilent = SILENT_RESERVED_PROPS.has(name);
      const suggestion = suggestPropRename(name);
      const detail = isSilent
        ? `is SILENTLY consumed by the target framework — Vue's template compiler strips the reserved prop and React's element machinery swallows it, so the prop never receives a value AND no typecheck catches it`
        : isError
          ? `is illegal as a prop binding (a JS reserved word or a Svelte rune name)`
          : `becomes a class field on the CLASS targets (Lit/Angular) that shadows an inherited DOM/lifecycle/Object.prototype member (hard TS2416/TS1240/TS2300 on a Lit leaf); the non-class targets compile clean, so this is a target-asymmetric footgun`;

      diagnostics.push({
        code: RozieErrorCode.PUBLIC_CONTRACT_NAME_COLLISION,
        severity: isError ? 'error' : 'warning',
        message: `<props> key '${name}' collides with a reserved name across the shipped targets and ${detail}. A public-contract prop name cannot be auto-renamed (it would break the consumer API) — rename it at author time (e.g. '${suggestion}').`,
        loc: entry.sourceLoc,
        hint: `Rename the prop so its name is not a per-target reserved name — e.g. '${suggestion}' (the historical fix renamed prop 'id' → 'idBase'). Update consumer call-sites to the new name.`,
      });
    }

    // ── EMITS (Svelte emit-normalization collapse) ───────────────────────────
    // `bindings.emits` is a Set<string> with no per-entry loc; group emit names
    // by their Svelte-normalized callback-prop name and flag any group with >1
    // member (the second emit silently shadows the first on Svelte). Runtime-only
    // collision (no typecheck net) → ROZ981.
    const byNormalized = new Map<string, string[]>();
    for (const emit of bindings.emits) {
      const key = svelteNormalizedEmit(emit);
      const bucket = byNormalized.get(key);
      if (bucket) bucket.push(emit);
      else byNormalized.set(key, [emit]);
    }
    // Emits carry no sourceLoc — fall back to a zero loc (renderers compute the
    // frame lazily; the message names the exact emit pair so the author can find
    // it without a code-frame).
    const emitLoc: SourceLoc = { start: 0, end: 0 };
    for (const [normalized, names] of byNormalized) {
      if (names.length < 2) continue;
      const sorted = [...names].sort();
      diagnostics.push({
        code: RozieErrorCode.RUNTIME_ONLY_NAME_COLLISION,
        severity: 'error',
        message: `Emits ${sorted.map((n) => `'${n}'`).join(' and ')} normalize to the SAME Svelte callback prop '${normalized}' (Svelte lowers \`$emit('x')\` to \`on\${x.replace(/-/g,'').toLowerCase()}\`), so they collapse onto one callback at runtime — the later emit silently shadows the earlier. No typecheck catches this. Rename one emit so the normalized names differ.`,
        loc: emitLoc,
        hint: `Rename one of ${sorted.map((n) => `'${n}'`).join(' / ')} so they do not collapse to '${normalized}' on Svelte (e.g. avoid pairing a camelCase and a hyphenated form of the same word).`,
      });
    }

    // ── $expose verbs ────────────────────────────────────────────────────────
    // Delegated to the WIDENED ROZ137 (exposeReservedMemberValidator) — not
    // re-checked here to avoid double-firing.

    // ── provide/inject keys ──────────────────────────────────────────────────
    // No work: the inject-LOCAL is internal (Half A renames it); the KEY is a
    // runtime string literal, not an identifier, so it cannot collide.
  } catch {
    // Defensive: bindings.props/emits are already-extracted plain data, but
    // never let an unexpected shape propagate — collected-not-thrown (D-08).
  }
}
