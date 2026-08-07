/**
 * Quick 260807-2qn (Task 1) — prop/emit callback-name collision validator
 * (ROZ148).
 *
 * React and Solid both synthesize an `on<Pascal>(...)?: (...args: any[]) =>
 * void` field on the generated props interface for EVERY declared `$emit`
 * (`emitPropsInterface.ts` in both targets). If the author ALSO declares a
 * `<props>` key exactly equal to that synthesized field name, both fields
 * land on the SAME TypeScript interface with (usually) different types — a
 * hard TS2300 duplicate-identifier break on every strict-TS consumer, on two
 * of six targets, with no typecheck net at author time (the component itself
 * compiles clean per-target; only a STRICT consumer importing the emitted
 * `.d.ts` sees the break).
 *
 * Dan decided this fork 2026-08-07 (mirroring the ROZ127 prop/slot collision
 * precedent): a HARD compile error, not a silent dedup. A dedup would have to
 * pick a consumer-visible return type by accident — neither the prop's
 * declared type nor the emit's synthesized `(...args: any[]) => void` is
 * obviously the one that should win — so this fails loud at author time
 * instead.
 *
 * ── OWNERSHIP: a NEW sibling validator, not folded into
 * `reservedNameCollisionValidator.ts` ──────────────────────────────────────
 * That file's OWNERSHIP SPLIT comment (see its header) documents props+emits
 * as ITS domain for RESERVED-NAME collisions (a public name equal to a
 * per-target reserved word). This is a DIFFERENT collision class — a
 * user-declared prop colliding with a name the compiler itself SYNTHESIZES
 * from another user declaration (the emit). Mirrors the ROZ147 precedent
 * (`litInheritedPropertyValidator.ts`) of giving a closely-related but
 * distinct collision check its own file to keep the already-large sibling
 * validator readable.
 *
 * ── SCOPE FENCE (D-05) — the emit axis ONLY ─────────────────────────────────
 * React/Solid ALSO synthesize `default<Pascal>` and `on<Pascal>Change` for
 * every `model: true` prop (`emitPropsInterface.ts` isModel branch), which
 * produces two more genuine TS2300 duplicate-field shapes: a declared prop
 * named `defaultX`/`onXChange` beside a model prop `x`, or a declared emit
 * named `xChange` beside a model prop `x` (both mint `onXChange`). Both are
 * the same defect CLASS but an UNMEASURED false-positive profile — widening
 * ROZ148 to cover them without a corpus measurement risks breaking a
 * shipping family (the exact failure mode the ROZ142 `LIT_DOM_PROP_FOOTGUNS`
 * curation comment warns against). Planner-side pre-measurement over the
 * 52-file corpus found ZERO live instances of either sibling axis, so they
 * are latent-only and deliberately deferred — filed as
 * `prop-emit-model-companion-field-collision.md`, NOT fixed here. Do not
 * widen this validator to those axes without a fresh corpus measurement.
 *
 * Reads `bindings.props` / `bindings.emits`; never mutates the AST. NEVER
 * throws (D-08, collected-not-thrown).
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable } from '../types.js';

/**
 * PascalCase from a hyphenated/snake_case emit name.
 *
 * MUST stay byte-identical to `toPascalCase` in BOTH target emitters — core
 * cannot import a target package, so this is the inlined-per-target-
 * normalization precedent `svelteNormalizedEmit` established
 * (`reservedNameCollisionValidator.ts`). Verified byte-identical in both
 * targets today (Quick 260807-2qn):
 *   - React: `packages/targets/react/src/emit/emitPropsInterface.ts:107-110`
 *   - Solid: `packages/targets/solid/src/emit/emitPropsInterface.ts:121-124`
 * If either helper changes, change this too (the collision contract depends
 * on the exact normalization matching).
 */
function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * Run the prop/emit callback-name collision validator. Emits ROZ148 (error)
 * into `diagnostics` for every `<props>` key that is EXACTLY equal to the
 * `on<Pascal>` callback field React/Solid synthesize for a declared emit.
 * Case-sensitive, exact-string-equality only (no fuzzy matching). NEVER
 * throws (D-08). Reads `bindings.props` / `bindings.emits`; never mutates the
 * AST.
 */
export function runPropEmitCallbackCollisionValidator(
  _ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  try {
    for (const emit of bindings.emits) {
      const eventPascal = toPascalCase(emit);
      // Both emitters `continue` on an empty pascal form — no field is
      // minted, so there is nothing to collide with. Mirror that guard.
      if (eventPascal.length === 0) continue;

      const synthesizedField = `on${eventPascal}`;
      const collidingProp = bindings.props.get(synthesizedField);
      if (collidingProp === undefined) continue;

      diagnostics.push({
        code: RozieErrorCode.PROP_EMIT_CALLBACK_NAME_COLLISION,
        severity: 'error',
        message: `<props> key '${synthesizedField}' collides with the callback field React and Solid synthesize for the declared emit '${emit}' (\`$emit('${emit}', ...)\` lowers to an \`${synthesizedField}?: (...args: any[]) => void\` prop on both targets). Both fields would land on the SAME generated props interface with different types — a TS2300 duplicate-identifier error for every strict-TS consumer on the React and Solid leaves.`,
        loc: collidingProp.sourceLoc,
        hint: `Rename the prop '${synthesizedField}' so it no longer matches the synthesized callback name, or rename the emit '${emit}' so it no longer normalizes to '${synthesizedField}'. Either side resolves the collision.`,
      });
    }
  } catch {
    // Defensive: bindings.props/emits are already-extracted plain data, but
    // never let an unexpected shape propagate — collected-not-thrown (D-08).
  }
}
