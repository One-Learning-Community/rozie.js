/**
 * Phase 12 dogfood: the `.phone` custom MODEL modifier.
 *
 * The acceptance canary for Phase 12's Requirement 7/8 — a third-party plugin
 * author can ship a custom `r-model` modifier using ONLY the public
 * `@rozie/core` surface, and it compiles correctly across all six targets
 * (React, Vue, Svelte, Angular, Solid, Lit) with zero change to `@rozie/core`.
 *
 * `.phone` is a value-transform model modifier — a US phone-number reformatter.
 * It mirrors `tests/plugins/swipe` (the EVENT-modifier dogfood) on the MODEL
 * side: where swipe carries six per-target `vue()/react()/...` methods (event
 * wiring genuinely diverges per target), `.phone` declares ONE target-agnostic
 * descriptor — its `valueTransform` is the SAME regex-reformat expression on
 * every target (D-03).
 *
 * Public-API surface used (all SemVer-stable v1 per D-22b):
 *   - ModelModifierImpl, ModelModifierDescriptor   (the model-modifier shape)
 *   - ModifierArg, ModifierContext                 (resolve() inputs)
 *   - Diagnostic                                   (collected-not-thrown)
 *
 * This import line IS the SemVer assertion — if a future `@rozie/core` moves
 * any of these behind an internal path, this module fails at the import
 * boundary.
 *
 * Usage in a .rozie file (paired with the built-in `.lazy` per CONTEXT
 * §Discretion — reformat on commit, not on every keystroke):
 *   <template>
 *     <input r-model.phone.lazy="$data.tel" />
 *   </template>
 */
import type {
  ModelModifierImpl,
  ModelModifierDescriptor,
  ModifierArg,
  ModifierContext,
  Diagnostic,
} from '@rozie/core';

/**
 * The `$v`-placeholder value-transform fragment for `.phone`.
 *
 * A single self-contained JS expression (an IIFE — no block statements at the
 * top level, so it splices verbatim into both the AST-based react/solid/lit
 * emitters and the string-based vue/svelte/angular emitters). It:
 *   1. Coerces the bound value to a string and strips every non-digit.
 *   2. Drops a leading US country-code `1` if present, capping at 10 digits.
 *   3. Formats progressively as the user types — `(123) 456-7890` once all
 *      ten digits are present, partial groupings before that.
 *
 * Double-underscore-prefixed param/local names avoid colliding with the `$v`
 * placeholder the emitter substitutes.
 */
const PHONE_VALUE_TRANSFORM: string = [
  '((__v) => {',
  ' const __d = String(__v).replace(/\\D/g, "").replace(/^1(?=\\d{10})/, "").slice(0, 10);',
  ' const __a = __d.slice(0, 3), __b = __d.slice(3, 6), __c = __d.slice(6, 10);',
  ' return __c ? `(${__a}) ${__b}-${__c}`',
  '      : __b ? `(${__a}) ${__b}`',
  '      : __a ? (__d.length > 3 ? `(${__a}) ` : __a)',
  '      : __d;',
  '})($v)',
].join('');

/**
 * The `.phone` model modifier. Exported as a named const so the test suite can
 * register it onto a fresh ModifierRegistry per test.
 *
 * Per D-22 (NO module-import side effects): importing this module does NOT
 * register anything; consumers must explicitly call
 * `registry.register(phoneModifier)`.
 *
 * Per D-01/D-03: `kind: 'model'` (required discriminant), and `resolve()`
 * returns a single `{ descriptor, diagnostics }` — NOT `{ entries }` — with no
 * per-target methods.
 */
export const phoneModifier: ModelModifierImpl = {
  kind: 'model',
  name: 'phone',
  arity: 'none',
  resolve(
    args: ModifierArg[],
    ctx: ModifierContext,
  ): { descriptor: ModelModifierDescriptor; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = [];
    if (args.length !== 0) {
      diagnostics.push({
        // Reuse the generic modifier-arity error code as a BARE string literal.
        // Third-party plugins do NOT import the first-party `RozieErrorCode`
        // type — `Diagnostic.code` is plain `string`, so a bare literal is the
        // canary's only error-code dependency (mirrors tests/plugins/swipe).
        code: 'ROZ111',
        severity: 'error',
        message: `'.phone' takes no arguments (got ${args.length})`,
        loc: ctx.sourceLoc,
      });
      return { descriptor: {}, diagnostics };
    }
    return {
      descriptor: { valueTransform: PHONE_VALUE_TRANSFORM },
      diagnostics,
    };
  },
};
