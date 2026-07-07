/**
 * rewriteTemplateExpression — Phase 3 Plan 03 Task 1.
 *
 * Renders a Babel Expression for use inside a Vue <template>. Mirrors
 * rewriteRozieIdentifiers but OMITS the trailing `.value` because Vue's
 * template compiler auto-unwraps top-level Refs in template context
 * (per RESEARCH.md Pattern 7 line 905; D-31 / D-32 / D-34).
 *
 * Mappings:
 *   - `$props.value` (model)     → `value`        (NO .value — auto-unwrap)
 *   - `$props.step`  (non-model) → `props.step`   (props proxy)
 *   - `$data.hovering`           → `hovering`     (NO .value — auto-unwrap)
 *   - `$refs.dialogEl`           → `dialogElRef`  (NO .value — Pitfall 4 Ref suffix)
 *   - `$emit('foo')` call         → `emit('foo')`
 *   - bare `canIncrement` (computed) → `canIncrement` (NO .value — auto-unwrap;
 *                                      template context) / `canIncrement.value`
 *                                      (script context — lifted debounce/throttle,
 *                                      Spike-012 R5 C6: `ComputedRef` is NOT
 *                                      auto-unwrapped outside the template)
 *   - `$slots.header`            → `$slots.header` (Vue's $slots proxy passthrough)
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * (IR-04) is never violated. No diagnostics — pre-render rewriting is purely
 * structural (collisions are already detected at script-emit time per
 * rewriteRozieIdentifiers' ROZ420 pass).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';

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

// `compact: false` preserves readable spacing inside object/array literals
// (`{ hovering: hovering }` rather than `{hovering:hovering}`). Template
// attribute values must be single-line, so we collapse the generator's
// newlines + multi-space runs after generation.
const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Render a Babel Expression as a Vue-template-friendly string.
 * IR is consulted for prop/data/ref/computed name lookups.
 */
export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
  /**
   * Spike-012 R4 — SCRIPT-context rendering (default false = template context).
   * A `.debounce`/`.throttle` template handler is LIFTED into `<script setup>`
   * (emitTemplateEvent), where Vue's template Ref auto-unwrap is NOT in effect:
   * `$data.q` / a model `$props.value` / `$refs.el` must carry an explicit
   * `.value` (they are `Ref<T>` consts in script scope). Without this the lifted
   * handler emits `q = …` — a write to a `const` ref → TS2588 + a runtime
   * "Assignment to constant variable" that never updates the ref. Template
   * callers pass false (unchanged, byte-identical).
   *
   * Spike-012 R5 C6 — the same script-vs-template split applies to a bare
   * `$computed` READ: `computed()` returns a `ComputedRef<T>`, which Vue's
   * template compiler auto-unwraps (bare `canIncrement`), but a lifted
   * `.debounce`/`.throttle` body is real `<script setup>` code where the
   * `ComputedRef` object itself is in scope — reading it bare (`q.value =
   * label`) assigns the wrapper object, not its value. In scriptContext a
   * bare computed identifier now carries `.value`; template context is
   * unaffected (byte-identical).
   */
  scriptContext = false,
): string {
  // Clone the expression so we don't mutate the IR's preserved nodes.
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));

  // In script context a lowered Ref name reads/writes through `.value`; in
  // template context Vue auto-unwraps, so the bare identifier stands.
  const asRef = (name: string): t.Expression =>
    scriptContext
      ? t.memberExpression(t.identifier(name), t.identifier('value'))
      : t.identifier(name);

  // Wrap in a Program shell so traverse() works on a top-level Node.
  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X` in template
  // event handlers (`@click="$model.open = false"`) and bindings. `$model` is
  // model-only by contract (Wave 1 semantic pass rejected non-model/non-existent
  // `$model.X` before lowering) and is always a member-expression object (D-03),
  // so we normalize the accessor `$model` → `$props` before the main traversal.
  // Every downstream write/read site then routes through the IDENTICAL
  // `$props.<modelProp>` Vue lowering → same setter, byte-identical emit.
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
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value (template) / value.value (script)
          path.replaceWith(asRef(prop.name));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step (proxy — no .value in either context)
          path.node.object = t.identifier('props');
          return;
        }
        // Unknown prop — leave as-is (Phase 2 ROZ100 already warned).
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (template) / hovering.value (script)
        path.replaceWith(asRef(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogElRef (template) / dialogElRef.value (script)
        path.replaceWith(asRef(prop.name + 'Ref'));
        path.skip();
        return;
      }
      // $slots, $emit on member exprs are handled below or pass through.
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.replaceWith(asRef(prop.name));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(asRef(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(asRef(prop.name + 'Ref'));
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;

      // $classSelector('grip') → ".grip" — same lowering as the <script> path
      // (rewriteScript.ts); both hooks call the SAME shared helper so they
      // cannot drift (Pitfall 4). Handled before the $emit branch so a
      // :attr-position $classSelector is rewritten.
      if (t.isIdentifier(callee) && callee.name === '$classSelector') {
        // 'single' — a Vue `:attr="..."` binding double-quotes its expression;
        // the lowered literal must serialize with single quotes so it does not
        // collide with that wrapper (`:attr="".grip""`).
        lowerClassSelectorCall(path, 'single');
        return;
      }

      // $emit('foo', x) → emit('foo', x) (in case template inlines a $emit).
      if (t.isIdentifier(callee) && callee.name === '$emit') {
        path.node.callee = t.identifier('emit');
      }
    },

    /**
     * Spike-012 R5 C6 — a bare `$computed` READ inside a lifted
     * `.debounce`/`.throttle` handler (scriptContext) must carry `.value`;
     * template context (scriptContext=false, the entire existing corpus) is
     * UNCHANGED — a bare computed name stays bare (auto-unwrap, doc header
     * above), so this visitor is a byte-identical no-op there.
     */
    Identifier(path) {
      if (!scriptContext) return;
      const name = path.node.name;
      if (!computedNames.has(name)) return;
      // Only rewrite READ (referenced) positions — excludes declaration ids,
      // non-computed member-expression properties, object-property keys,
      // import/export specifiers, labels, etc.
      if (!path.isReferencedIdentifier()) return;
      // Object-shorthand value (`{ label }`) is technically a read, but is
      // deliberately left bare here — no debounce/throttle handler in the
      // corpus constructs an object shorthand over a computed name, and
      // rewriting the VALUE half of a shorthand pair changes its printed
      // shape in a way that's out of scope for this fix.
      const parent = path.parent;
      if (t.isObjectProperty(parent) && parent.shorthand && parent.value === path.node) return;
      // Shadow-safe: a local binding for this name inside the lifted body
      // (e.g. a parameter or local var that happens to share the computed's
      // name) is NOT the computed — leave it bare.
      if (path.scope.getBinding(name)) return;
      path.replaceWith(t.memberExpression(t.identifier(name), t.identifier('value')));
      path.skip();
    },
  });

  // Generate from the wrapped ExpressionStatement.
  const stmt = wrapper.program.body[0]!;
  const raw = !t.isExpressionStatement(stmt)
    ? generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
