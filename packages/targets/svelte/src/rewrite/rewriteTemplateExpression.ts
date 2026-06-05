/**
 * rewriteTemplateExpression — Phase 5 Plan 02a Task 2.
 *
 * Renders a Babel Expression as a Svelte-template-friendly string. Mirrors
 * rewriteRozieIdentifiers but operates on a single Expression. Same rewrites
 * as the script-side path because Svelte 5's template surface uses bare
 * identifiers (no `.value` suffix; no `props.` prefix):
 *
 *   - `$props.value` (model)     → `value`
 *   - `$props.step`  (non-model) → `step`
 *   - `$data.hovering`           → `hovering`
 *   - `$refs.dialogEl`           → `dialogEl`
 *   - `$slots.foo`               → `foo`
 *   - `$emit('foo', x)`          → `onfoo?.(x)`
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * (IR-04) is never violated.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';
import { svelteCallbackPropName } from './rewriteScript.js';
import { portalSlotMergeName } from '../emit/portalSlotMergeName.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Render a Babel Expression as a Svelte-template-friendly string.
 * IR is consulted for prop/data/ref/slot name lookups.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
): string {
  // Clone the expression so we don't mutate the IR's preserved nodes.
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? 'default' : s.name)));

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X` in template
  // event handlers (`@click="$model.open = false"`), bindings, AND <listeners>-
  // body inline handlers (this file is re-exported as rewriteListenerExpression
  // — Svelte has NO separate listener-write path; A1 conclusion). `$model` is
  // model-only by contract (Wave 1 rejected non-model/non-existent before
  // lowering) and always a member-expression object (D-03), so we normalize the
  // accessor `$model` → `$props` before the main traversal; every downstream
  // write/read then routes through the IDENTICAL `$props.<modelProp>` Svelte
  // lowering → same bare local, byte-identical emit. Reuse, not reimplement.
  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });

  traverse(wrapper, {
    // Phase 14 D-04 / Plan 14-05 — the `$attrs` magic accessor lowers to a
    // synthesised `__rozieAttrs` rest binding produced by Svelte 5's runes-
    // mode `$props()` destructure (e.g. `let { value, ...__rozieAttrs } =
    // $props()`). Bare `r-bind="$attrs"` therefore emits `{...__rozieAttrs}`.
    //
    // The original Plan 14-04 lowering to `$$restProps` was INCORRECT for
    // runes-mode Svelte 5: `Cannot use \`$$restProps\` in runes mode`
    // (legacy_rest_props_invalid). The Svelte target emits `<script lang="ts">`
    // with `$state`/`$derived`/`$props()` runes — so the legacy auto-
    // populated `$$restProps` symbol is forbidden. Plan 14-05 swaps the
    // rewrite target to `__rozieAttrs`, which is the rest-destructure name
    // synthesised in `emitScript.ts` `buildPropsDestructureEntries`.
    //
    // The spread emitter has ALREADY decided this is a `$attrs` case BEFORE
    // calling rewrite; this visitor is what turns the bare `$attrs` Identifier
    // into the synthesised rest-binding name.
    Identifier(path) {
      // Phase 14 D-04 — `$attrs` → `__rozieAttrs` (Svelte 5 runes-mode rest
      // binding from `$props()`). Phase 15 D-19 — `$listeners` also maps to
      // the same `__rozieAttrs` rest binding because Svelte 5 does NOT
      // semantically separate attribute props from listener props: both
      // arrive in the same `$props()` rest object (a consumer's
      // `<Wrapper class="x" onclick={fn} />` lands `{ class: 'x', onclick: fn }`
      // in `__rozieAttrs`). The Svelte runtime also rejects bare `$listeners`
      // as an illegal `$`-prefixed identifier (CompileError
      // `global_reference_invalid`), so the rewrite is load-bearing for the
      // emit to compile. The dedicated `applyListeners` action's per-key
      // attach loop spreads any `oncamelcase` handlers onto the node verbatim.
      if (path.node.name !== '$attrs' && path.node.name !== '$listeners') return;
      // Skip the RHS-position of a MemberExpression / OptionalMemberExpression
      // (handled by their own visitors when applicable). Skip object-literal
      // property keys (`{ $attrs: x }` is not a magic reference).
      const parent = path.parent;
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node
      ) {
        return;
      }
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.computed) {
        return;
      }
      path.replaceWith(t.identifier('__rozieAttrs'));
      path.skip();
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      // Unreachable: a non-computed MemberExpression property is always an
      // Identifier; the only non-Identifier form is a PrivateName, which is
      // syntactically invalid outside a class body and cannot reach here.
      /* v8 ignore next */
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(t.identifier(prop.name));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Collision-gated `Slot` suffix: lockstep with the `$derived` merge
        // identifier (portalSlotMergeName) so a `$slots.X` read in a template /
        // listeners expression targets the suffixed merge when X collides with a
        // declared prop. Non-colliding slots stay bare (byte-identical).
        path.replaceWith(t.identifier(portalSlotMergeName(prop.name, ir)));
        path.skip();
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      // Unreachable for the same reason as the MemberExpression twin above —
      // a non-computed optional-member property is always an Identifier.
      /* v8 ignore next */
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(t.identifier(prop.name));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Collision-gated `Slot` suffix (see MemberExpression twin above).
        path.replaceWith(t.identifier(portalSlotMergeName(prop.name, ir)));
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $classSelector('grip') → ".grip" — same lowering as the <script> path
      // (rewriteScript.ts); both hooks call the SAME shared helper so they
      // cannot drift (Pitfall 4). Handled BEFORE the $emit-only early-return so
      // a :attr-position $classSelector is rewritten.
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      // $emit('foo', x) → onfoo?.(x)
      if (callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      // Use the SHARED normalizer (the same one rewriteScript.ts's $emit
      // lowering and emitScript's Props-interface emit use). A raw
      // `on${first.value}` produces the invalid identifier `onevent-click`
      // for a hyphenated event name; svelteCallbackPropName strips hyphens
      // and lowercases so the template path agrees with the script path
      // (WR-06).
      const callbackName = svelteCallbackPropName(first.value);
      const rest = args.slice(1);
      const optCall = t.optionalCallExpression(
        t.identifier(callbackName),
        rest as t.Expression[],
        true,
      );
      path.replaceWith(optCall);
    },
  });

  // Pull the rewritten expression back out of the wrapper.
  const stmt = wrapper.program.body[0]!;
  // The wrapper's body[0] is the ExpressionStatement constructed just above;
  // the `!isExpressionStatement` arm is a defensive fallback and unreachable.
  /* v8 ignore next */
  const rewrittenExpr = !t.isExpressionStatement(stmt) ? cloned : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
