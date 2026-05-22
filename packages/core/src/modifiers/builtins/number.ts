/**
 * `.number` — built-in r-model MODEL modifier (Phase 12 / D-03).
 *
 * Coerces the bound value to a number, mirroring Vue's `v-model.number`
 * (`looseToNumber`): parse the value as a float and fall back to the raw
 * string when the result is `NaN`. The descriptor's `valueTransform` is a
 * single self-contained JS expression — a conditional over the `$v`
 * placeholder, which each target emitter substitutes with its own
 * extracted-value access expression.
 *
 * Per D-07 `.number` is ALWAYS TERMINAL in the fixed Vue-canonical compose
 * pipeline (`.trim` -> custom string-transforms -> `.number`), because it
 * produces a non-string value: any transform composed after it would
 * operate on a number, which is out of scope for v1.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModelModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

/**
 * Vue `looseToNumber`-equivalent inline fragment.
 *
 * This MUST be a single, statement-free, declaration-free JS expression: the
 * string-based emitters (notably Angular) splice it verbatim into a TEMPLATE
 * binding expression, and Angular's template expression language forbids
 * block-body arrow functions, `const` declarations, and statements. An earlier
 * IIFE form (`((__v) => { const __n = ...; return ...; })($v)`) compiled fine
 * for the JS-context targets (React/Vue/Svelte/Solid/Lit) but failed Angular
 * AOT — the host component's template never compiled, so it never rendered.
 *
 * Pure-expression form: parse `$v` as a float, fall back to the raw `$v` when
 * the result is `NaN`. Globals are reached through the `Number` namespace
 * (`Number.parseFloat` ≡ `parseFloat`, `Number.isNaN` is the non-coercing NaN
 * check) because Angular template expressions cannot reference bare globals
 * like `parseFloat`/`isNaN` — the Angular emitter's `KNOWN_TEMPLATE_GLOBALS`
 * mechanism exposes `Number` as a component member so the reference resolves.
 *
 * `$v` substitutes to a pure value-access expression in every emitter
 * (`$event`, `e.target.value`, …), so evaluating `Number.parseFloat($v)` twice
 * is side-effect-free. `$v` is the placeholder each emitter substitutes.
 */
const NUMBER_VALUE_TRANSFORM =
  '(Number.isNaN(Number.parseFloat($v)) ? $v : Number.parseFloat($v))';

export const number: ModelModifierImpl = {
  kind: 'model',
  name: 'number',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.number' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { descriptor: {}, diagnostics };
    }
    return {
      descriptor: { valueTransform: NUMBER_VALUE_TRANSFORM },
      diagnostics: [],
    };
  },
};
