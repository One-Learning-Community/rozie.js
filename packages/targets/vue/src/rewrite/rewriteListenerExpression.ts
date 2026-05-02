/**
 * rewriteScriptExpression — Phase 3 Plan 04 Task 2 helper.
 *
 * Renders a Babel Expression for inlining inside `<script setup>` — applies
 * the SAME rewrites as rewriteRozieIdentifiers (Plan 02 — `.value` suffix on
 * Refs / model props / computed reads / data names / template refs) but
 * operates on a single Expression and returns a code string ready to splice
 * into a watchEffect body or a `useOutsideClick(...)` call.
 *
 * Used by emitListeners (`<listeners>`-block lowering) for the listener's
 * `handler` and `when` expressions — both must run in script context (not
 * template), so `.value` IS appended (in contrast to rewriteTemplateExpression
 * which omits `.value` for Vue's template auto-unwrap).
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
 * Render a Babel Expression as a Vue script-side string with `.value` suffix
 * applied to model props / data refs / template refs / computed reads.
 *
 * Mirrors rewriteRozieIdentifiers (Plan 02) but works on a single Expression
 * embedded inside a fresh wrapper Program so `traverse()` can walk it.
 */
export function rewriteScriptExpression(
  expr: t.Expression,
  ir: IRComponent,
): string {
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));

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
          // $props.value (model) → value.value
          path.node.object = t.identifier(prop.name);
          path.node.property = t.identifier('value');
        } else if (nonModelProps.has(prop.name)) {
          // $props.step → props.step
          path.node.object = t.identifier('props');
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering.value
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogElRef.value
        path.node.object = t.identifier(prop.name + 'Ref');
        path.node.property = t.identifier('value');
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.node.object = t.identifier(prop.name);
          path.node.property = t.identifier('value');
        } else if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name + 'Ref');
        path.node.property = t.identifier('value');
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === '$emit') {
        path.node.callee = t.identifier('emit');
      }
    },

    Identifier(path) {
      const name = path.node.name;
      if (!computedNames.has(name)) return;

      const parent = path.parent;

      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.object === path.node &&
        !parent.computed &&
        t.isIdentifier(parent.property) &&
        parent.property.name === 'value'
      ) {
        return;
      }
      if (t.isObjectProperty(parent) && parent.key === path.node && parent.shorthand) {
        return;
      }
      if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
      if (t.isFunction(parent) && parent.params.includes(path.node)) return;
      if (t.isImportSpecifier(parent)) return;
      if (t.isExportSpecifier(parent)) return;
      if (t.isLabeledStatement(parent) && parent.label === path.node) return;

      path.replaceWith(t.memberExpression(t.identifier(name), t.identifier('value')));
      path.skip();
    },
  });

  // Pull the rewritten expression back out of the wrapper.
  const stmt = wrapper.program.body[0]!;
  const rewrittenExpr = !t.isExpressionStatement(stmt)
    ? cloned
    : stmt.expression;
  const raw = generate(rewrittenExpr, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
