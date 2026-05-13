/**
 * rewriteTemplateExpression — Lit target (Plan 06.4-02 Task 1).
 *
 * Renders a Babel Expression for embedding inside Lit's html`` tagged template
 * literal interpolation `${...}`. Identifier shapes:
 *
 *   - `$props.X`         → `this.X`
 *   - `$data.X`          → `this._X.value`
 *   - `$refs.X`          → `this._refX`
 *   - `$slots.X`         → `this._hasSlot<Suffix>`
 *   - `$emit('n', x)`    → `this.dispatchEvent(new CustomEvent('n', { detail: x, bubbles: true, composed: true }))`
 *   - bare computed name → `this.<name>` (computed getters are class methods)
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';

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

function slotFieldSuffix(name: string): string {
  if (name === '' || name === 'default') return 'Default';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function refFieldName(name: string): string {
  return `_ref${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function thisDot(name: string): t.MemberExpression {
  return t.memberExpression(t.thisExpression(), t.identifier(name));
}

function thisSignalRead(name: string): t.MemberExpression {
  return t.memberExpression(
    t.memberExpression(t.thisExpression(), t.identifier(`_${name}`)),
    t.identifier('value'),
  );
}

/**
 * Collect top-level method names from the user's <script> body. Variables and
 * function declarations whose names don't collide with state/computed/refs/etc.
 * become class methods — references inside template expressions need `this.`
 * prefix.
 */
function collectMethodNames(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
    ...ir.slots.map((s) => (s.name === '' ? 'default' : s.name)),
  ]);
  const body = ir.setupBody.scriptProgram.program.body;
  for (const stmt of body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id) && !reserved.has(decl.id.name)) {
          // Skip $computed() init — those become getters and are tracked via computedNames.
          if (
            decl.init &&
            t.isCallExpression(decl.init) &&
            t.isIdentifier(decl.init.callee) &&
            decl.init.callee.name === '$computed'
          ) {
            continue;
          }
          names.add(decl.id.name);
        }
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id && !reserved.has(stmt.id.name)) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

export function rewriteTemplateExpression(
  expr: t.Expression,
  ir: IRComponent,
): string {
  const cloned = t.cloneNode(expr, true, false);
  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? 'default' : s.name)));
  const methodNames = collectMethodNames(ir);

  traverse(wrapper, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop) || left.computed) return;

      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.get('left').replaceWith(thisSignalRead(prop.name));
        return;
      }
      if (
        obj.name === '$props' &&
        (modelProps.has(prop.name) || nonModelProps.has(prop.name))
      ) {
        path.get('left').replaceWith(thisDot(prop.name));
        return;
      }
    },

    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        path.replaceWith(thisDot(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(thisSignalRead(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(thisDot(refFieldName(prop.name)));
        path.skip();
        return;
      }
      if (obj.name === '$slots') {
        const key = prop.name === '' ? 'default' : prop.name;
        if (slotNames.has(key)) {
          path.replaceWith(thisDot(`_hasSlot${slotFieldSuffix(prop.name)}`));
          path.skip();
          return;
        }
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.node.object = thisDot(refFieldName(prop.name));
        return;
      }
      if (obj.name === '$props') {
        path.node.object = t.thisExpression();
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(thisSignalRead(prop.name));
        path.skip();
        return;
      }
    },

    Identifier(path) {
      const name = path.node.name;
      if (name === '$el') {
        path.replaceWith(t.thisExpression());
        path.skip();
        return;
      }
      if (!computedNames.has(name) && !methodNames.has(name)) return;

      const parentPath = path.parentPath;
      if (!parentPath) return;

      // Skip when identifier is a property key.
      if (parentPath.isMemberExpression() && parentPath.node.property === path.node && !parentPath.node.computed) return;
      if (parentPath.isObjectProperty() && parentPath.node.key === path.node && !parentPath.node.computed) return;
      // Skip if it's a function parameter or pattern target.
      if (parentPath.isFunctionExpression() || parentPath.isArrowFunctionExpression() || parentPath.isFunctionDeclaration()) {
        if ((parentPath.node as t.Function).params.some((p) => p === path.node)) return;
      }

      // Replace bare computed/method reference with `this.<name>`.
      path.replaceWith(thisDot(name));
      path.skip();
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) return;

      const eventName = firstArg.value;
      const restArgs = args.slice(1);
      const detail =
        restArgs.length === 0
          ? t.identifier('undefined')
          : (restArgs[0] as t.Expression);
      const customEvent = t.newExpression(t.identifier('CustomEvent'), [
        t.stringLiteral(eventName),
        t.objectExpression([
          t.objectProperty(t.identifier('detail'), detail),
          t.objectProperty(t.identifier('bubbles'), t.booleanLiteral(true)),
          t.objectProperty(t.identifier('composed'), t.booleanLiteral(true)),
        ]),
      ]);
      path.replaceWith(
        t.callExpression(
          t.memberExpression(t.thisExpression(), t.identifier('dispatchEvent')),
          [customEvent],
        ),
      );
    },
  });

  const stmt = wrapper.program.body[0]!;
  const raw = !t.isExpressionStatement(stmt)
    ? generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
}
