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
 *   - bare `canIncrement` (computed) → `canIncrement` (NO .value — auto-unwrap)
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
): string {
  // Clone the expression so we don't mutate the IR's preserved nodes.
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));

  // Wrap in a Program shell so traverse() works on a top-level Node.
  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value  (NO .value in template — auto-unwrap)
          path.replaceWith(t.identifier(prop.name));
          path.skip();
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step
          path.node.object = t.identifier('props');
          return;
        }
        // Unknown prop — leave as-is (Phase 2 ROZ100 already warned).
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering  (NO .value in template)
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogElRef (NO .value in template — Pitfall 4 suffix only)
        path.replaceWith(t.identifier(prop.name + 'Ref'));
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
          path.replaceWith(t.identifier(prop.name));
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
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name + 'Ref'));
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      // $emit('foo', x) → emit('foo', x) (in case template inlines a $emit).
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === '$emit') {
        path.node.callee = t.identifier('emit');
      }
    },
  });

  // Generate from the wrapped ExpressionStatement.
  const stmt = wrapper.program.body[0]!;
  const raw = !t.isExpressionStatement(stmt)
    ? generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
