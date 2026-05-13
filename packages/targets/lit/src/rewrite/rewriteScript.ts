/**
 * rewriteScript — Lit target (Plan 06.4-02 Task 1).
 *
 * Rewrites Rozie identifiers inside the cloned `<script>` Babel AST into
 * Lit-class equivalents:
 *
 *   - `$props.X`          → `this.X`            (class field, regardless of model)
 *   - `$data.X`           → `this._X.value`     (signal `.value` access — D-LIT-07)
 *   - `$data.X = Y`       → `this._X.value = Y` (signal `.value` write)
 *   - `$refs.X`           → `this._refX`        (the @query-decorated field)
 *   - `$slots.X`          → `this._hasSlotX`    (presence boolean)
 *   - `$slots[''] / $slots.default` (default) → `this._hasSlotDefault`
 *   - `$emit('name', x)`  → `this.dispatchEvent(new CustomEvent('name', { detail: x, bubbles: true, composed: true }))`
 *   - `$el`               → `this`
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * is never violated (Plan 02 IR-04 lock).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { File, Program, Expression, Statement } from '@babel/types';
import { cloneScriptProgram } from './cloneProgram.js';

// CJS interop normalization.
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

export interface RewriteScriptResult {
  /** Cloned + rewritten Babel File (caller may further mutate). */
  file: File;
  /** Cloned + rewritten Program node (alias for file.program). */
  program: Program;
}

function slotFieldSuffix(name: string): string {
  if (name === '' || name === 'default') return 'Default';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function refFieldName(name: string): string {
  return `_ref${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** Build a `this.X` expression. */
function thisDot(name: string): t.MemberExpression {
  return t.memberExpression(t.thisExpression(), t.identifier(name));
}

/** Build a `this._X.value` expression (signal access). */
function thisSignalRead(name: string): t.MemberExpression {
  return t.memberExpression(
    t.memberExpression(t.thisExpression(), t.identifier(`_${name}`)),
    t.identifier('value'),
  );
}

/**
 * Collect names of top-level script bindings (functions, arrow consts) that
 * become class methods/fields. References to these names inside class-method
 * bodies need `this.` prefix.
 */
export function collectMethodNamesFromProgram(file: File, ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
  ]);
  for (const stmt of file.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id) && !reserved.has(decl.id.name)) {
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

export interface RewriteScriptOpts {
  /**
   * Override the method-name set computed from the program. When wrapping a
   * partial fragment (e.g. a lifecycle hook BlockStatement) for re-emit, the
   * caller must supply the method names collected from the FULL IR script
   * program so identifiers like `lockScroll` are still rewritten to `this.lockScroll`.
   */
  methodNamesOverride?: Set<string>;
}

export function rewriteScript(
  fileIn: File,
  ir: IRComponent,
  opts: RewriteScriptOpts = {},
): RewriteScriptResult {
  const cloned = cloneScriptProgram(fileIn);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? 'default' : s.name)));
  const methodNames =
    opts.methodNamesOverride ?? collectMethodNamesFromProgram(cloned, ir);

  traverse(cloned, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop) || left.computed) return;

      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.x = y  →  this._x.value = y
        path.get('left').replaceWith(thisSignalRead(prop.name));
        return;
      }

      if (
        obj.name === '$props' &&
        (modelProps.has(prop.name) || nonModelProps.has(prop.name))
      ) {
        // $props.x = y  →  this.x = y
        // (For non-model props this is a runtime error path; emitter does
        //  best-effort. Model props go through the public getter/setter pair.)
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
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(thisDot(prop.name));
          path.skip();
          return;
        }
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
        // $slots.x → this._hasSlot<X> (presence boolean)
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
        // $refs.foo?.bar  →  this._refFoo?.bar — re-wire the object.
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
      // Don't touch identifiers inside declarations or property keys.
      if (name === '$el') {
        const parentPath = path.parentPath;
        if (parentPath && parentPath.isVariableDeclarator() && parentPath.node.id === path.node) {
          return;
        }
        path.replaceWith(t.thisExpression());
        path.skip();
        return;
      }

      if (!computedNames.has(name) && !methodNames.has(name)) return;

      const parentPath = path.parentPath;
      if (!parentPath) return;

      // Skip the BINDING SITES of these names:
      //   - `const X = ...` (X is the binding)
      //   - `function X() {}` (X is the binding)
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      if (parentPath.isFunctionDeclaration() && parentPath.node.id === path.node) return;

      // Skip property keys + member-expression property references.
      if (parentPath.isMemberExpression() && parentPath.node.property === path.node && !parentPath.node.computed) return;
      if (parentPath.isObjectProperty() && parentPath.node.key === path.node && !parentPath.node.computed) return;

      // Skip function parameters.
      if (
        parentPath.isFunctionExpression() ||
        parentPath.isArrowFunctionExpression() ||
        parentPath.isFunctionDeclaration()
      ) {
        const fnNode = parentPath.node as t.Function;
        if (fnNode.params.some((p) => p === path.node)) return;
      }

      // Rewrite to `this.<name>`.
      path.replaceWith(thisDot(name));
      path.skip();
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      const args = path.node.arguments;

      if (callee.name === '$emit' && args.length > 0) {
        const firstArg = args[0]!;
        if (!t.isStringLiteral(firstArg)) return;
        const eventName = firstArg.value;
        const restArgs = args.slice(1);
        const detail = restArgs.length === 0
          ? t.identifier('undefined')
          : (restArgs[0] as t.Expression);
        // new CustomEvent('name', { detail, bubbles: true, composed: true })
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
        return;
      }

      // $computed(() => expr) inside variable declarators is handled separately
      // by the script-partitioner; leave the call alone otherwise.
      // Pre-bare computed identifier references (e.g. canIncrement) inside
      // template/listener expressions are also rewritten elsewhere.
    },
  });

  return { file: cloned, program: cloned.program };
}

/**
 * Render a Babel Expression as a string (for in-template `${expr}` embed).
 * The caller has already cloned + rewritten the expression. We collapse
 * newlines for inline template embedding.
 */
export function renderExpression(expr: Expression): string {
  return generate(expr, GEN_OPTS).code.replace(/\s*\n\s*/g, ' ').trim();
}

/** Render a statement (or array of statements) as a multi-line string. */
export function renderStatements(stmts: Statement[]): string {
  if (stmts.length === 0) return '';
  return stmts
    .map((s) => generate(s, GEN_OPTS).code)
    .join('\n');
}
