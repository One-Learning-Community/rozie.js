/**
 * Spike-012 R9 / ROZ208 — `<data>`-initializer sigil-leak validator.
 *
 * Detects a member-access `$`-sigil ($props/$data/$refs/$slots) inside a `<data>`
 * block INITIALIZER expression:
 *
 *   <data>
 *   { count: $props.initial }   // the idiomatic Vue-port derived-initial pattern
 *   </data>
 *
 * The `<data>` initializer is carried into the emit VERBATIM (lowerData copies the
 * Babel Expression with no sigil-lowering pass), so the sigil leaks as a raw free
 * identifier on ALL SIX targets — `useState($props.initial)` (React),
 * `ref($props.initial)` (Vue), `signal($props.initial)` (Angular/Lit), etc. → a
 * `TS2304 Cannot find name '$props'` under any config PLUS a runtime
 * ReferenceError, SILENTLY (no diagnostic today). Rozie's promise is one source →
 * six working targets, and this breaks on all six at once.
 *
 * The portable fix is to seed derived state in `$onMount` (the corpus idiom —
 * every shipped `.rozie` does exactly this; 0/340 reference a sigil in a `<data>`
 * initializer):
 *
 *   $onMount(() => { $data.count = $props.initial })
 *
 * Note: even a correctly-lowered `data`-from-`props` initializer would SNAPSHOT
 * the prop and not track later changes (the derived-state footgun, uniform across
 * frameworks), so steering to an explicit `$onMount` seed is the honest fix — not
 * merely a lowering gap. A real per-target data-init sigil lowering is backlogged.
 *
 * FLAGGED: any MemberExpression whose ROOT object is a bare sigil identifier
 * ($props/$data/$refs/$slots), anywhere in a `<data>` initializer subtree —
 * including nested inside object/array literals, ternaries, and arrow-valued
 * fields (none of which are lowered). Fires once per offending access.
 *
 * NOT FLAGGED:
 *   - a bare whole-object sigil (`{ p: $props }`) — ROZ978's concern, not a
 *     member access;
 *   - a member access on a NON-sigil object (`{ x: Math.PI }`);
 *   - `$attrs`/`$listeners` member access (mirrors ROZ978's exemption of those
 *     two — out of scope here).
 *
 * Per D-08 collected-not-thrown: NEVER throws. Reads `bindings.data` (the parsed
 * `<data>` initializers, which carry ABSOLUTE byte offsets via parserPositionFor).
 * Mutates `diagnostics` in place; NEVER mutates the AST.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import type { BindingsTable } from '../types.js';

// Default-export interop (see dataNestedMutationValidator.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

// The object sigils that leak as raw free identifiers when not lowered. Matches
// bareSigilValidator's BARE_SIGILS set ($attrs/$listeners deliberately excluded).
const LEAKING_SIGILS = new Set(['$props', '$data', '$refs', '$slots']);

/**
 * Walk one `<data>` initializer Expression, emitting ROZ208 for each
 * MemberExpression whose root object is a bare leaking sigil.
 */
function checkInitializer(init: t.Expression, diagnostics: Diagnostic[]): void {
  // Wrap so traverse() has a Program root; the initializer's own byte offsets are
  // preserved (absolute), so diagnostic locs point into the .rozie source.
  const wrapped = t.file(t.program([t.expressionStatement(init)]));
  traverse(wrapped, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj) || !LEAKING_SIGILS.has(obj.name)) return;
      diagnostics.push({
        code: RozieErrorCode.DATA_INIT_SIGIL_NOT_LOWERED,
        severity: 'error',
        message: `'${obj.name}' is referenced in a <data> initializer, where it is not sigil-lowered — it leaks as a raw free identifier on all six targets (TS2304 + a runtime ReferenceError).`,
        loc: locFromBabel(path.node),
        hint: `Seed derived state in $onMount instead, e.g. $onMount(() => { $data.<key> = ${obj.name}.<member> }).`,
      });
    },
  });
}

export function runDataInitSigilValidator(
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  for (const entry of bindings.data.values()) {
    checkInitializer(entry.initializer, diagnostics);
  }
}
