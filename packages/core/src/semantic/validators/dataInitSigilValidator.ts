/**
 * Spike-012 R9 / ROZ208 — `<data>`-initializer sigil-leak validator.
 * SCOPED DOWN by quick 260717-uvl to `$refs`/`$slots` only.
 *
 * Detects a member-access `$`-sigil ($refs/$slots) inside a `<data>` block
 * INITIALIZER expression:
 *
 *   <data>
 *   { el: $refs.box }
 *   </data>
 *
 * `$props`/`$data` member reads in a `<data>` initializer (`{ count:
 * $props.initial }` — the idiomatic Vue-port derived-initial pattern) are now
 * sigil-lowered: each target's state-initializer emit routes the initializer
 * through that target's EXISTING `rewriteTemplateExpression` (the same
 * machinery already used to lower `$props.X`/`$data.X` in templates and
 * handlers — reuse, not a fork), so `$props`/`$data` no longer leak a raw
 * free identifier and no longer flag here.
 *
 * `$refs`/`$slots` remain flagged: neither is meaningful at `<data>`-
 * initializer time — nothing has mounted yet when the initializer runs, so a
 * `$refs.x` read at that point is always `undefined` (refs are only safe to
 * read inside `$onMount`, per project convention), and `$slots.x` has no
 * useful init-time meaning either. The portable fix is to seed from a ref (or
 * slot) in `$onMount` (the corpus idiom):
 *
 *   $onMount(() => { $data.count = $refs.box.someValue })
 *
 * DESIGN CAVEAT (preserved from the original R9 note): even the now-working
 * `$props`/`$data` lowering SNAPSHOTS the prop/data value at init time and
 * will NOT track later changes (the derived-state footgun, uniform across
 * frameworks). The `$onMount` seed remains the honest REACTIVE form; this fix
 * only makes the SNAPSHOT form work — it does not try to make it reactive.
 *
 * FLAGGED: any MemberExpression whose ROOT object is a bare `$refs`/`$slots`
 * identifier, anywhere in a `<data>` initializer subtree — including nested
 * inside object/array literals, ternaries, and arrow-valued fields. Fires
 * once per offending access.
 *
 * NOT FLAGGED:
 *   - a `$props`/`$data` member access — sigil-lowered per target (make-it-work,
 *     260717-uvl);
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

// The sigils that are NOT meaningful in a `<data>` initializer — nothing has
// mounted yet at init time. `$props`/`$data` were removed from this set by
// quick 260717-uvl: both are now sigil-lowered per target and no longer leak.
const LEAKING_SIGILS = new Set(['$refs', '$slots']);

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
        message: `'${obj.name}' is referenced in a <data> initializer, where it is not meaningful — nothing has mounted yet at init time.`,
        loc: locFromBabel(path.node),
        hint: `Seed from ${obj.name} in $onMount instead, e.g. $onMount(() => { $data.<key> = ${obj.name}.<member> }).`,
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
