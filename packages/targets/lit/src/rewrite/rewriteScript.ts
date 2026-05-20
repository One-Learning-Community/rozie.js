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
import {
  hasShadowingBinding,
  isInBindingPosition,
} from './scopeAwareSkip.js';

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
  // WR-12 fix: include slot names in the reserved set to match
  // rewriteTemplateExpression.ts's collectMethodNames. A slot named `header`
  // must not be treated as a class method reference.
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
    ...ir.slots.map((s) => (s.name === '' ? 'default' : s.name)),
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
  // Scoped (non-portal) slots receive the consumer's `.X=${fn}` property fill
  // when the consumer uses a destructured `<template #X="{ p }">` (ec24d26).
  // The producer's `_hasSlot<X>` light-DOM detector never flips for property
  // fills, so the `$slots.X` presence check must union both signals.
  const scopedSlotNames = new Set(
    ir.slots
      .filter((s) => s.isPortal !== true && s.params.length > 0)
      .map((s) => s.name),
  );
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => s.name),
  );
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
        // Portal slots: function-prop filler (`.X=${fn}` on the consumer side)
        // — the `_hasSlot<X>` light-DOM detector never flips, so use the
        // function-prop presence check `this.<X> !== undefined` instead.
        if (portalSlotNames.has(prop.name)) {
          path.replaceWith(
            t.binaryExpression(
              '!==',
              thisDot(prop.name),
              t.identifier('undefined'),
            ),
          );
          path.skip();
          return;
        }
        // Scoped non-portal slots also receive property-fill from destructured
        // `<template #X="{ p }">` consumer fills (ec24d26). Emit the union so
        // the gate flips for BOTH light-DOM legacy fills and property fills.
        if (scopedSlotNames.has(prop.name)) {
          path.replaceWith(
            t.logicalExpression(
              '||',
              thisDot(`_hasSlot${slotFieldSuffix(prop.name)}`),
              t.binaryExpression(
                '!==',
                thisDot(prop.name),
                t.identifier('undefined'),
              ),
            ),
          );
          path.skip();
          return;
        }
        // $slots.x → this._hasSlot<X> (presence boolean)
        const key = prop.name === '' ? 'default' : prop.name;
        if (slotNames.has(key)) {
          path.replaceWith(thisDot(`_hasSlot${slotFieldSuffix(prop.name)}`));
          path.skip();
          return;
        }
      }

      if (obj.name === '$portals' && portalSlotNames.has(prop.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the firstUpdated() method.
        path.node.object = t.identifier('portals');
        return;
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
        // Spike 001 B2 — script-context `$el` lowers to
        // `MemberExpression($refs, __rozieRoot)`. The IR pass
        // `lowerRootElementRef` already appended `RefDecl { name: '__rozieRoot' }`
        // and a `ref="__rozieRoot"` binding on the template root. The
        // synthesised MemberExpression naturally flows into the existing
        // `$refs.X` MemberExpression handler below and lowers to
        // `this._ref__rozieRoot` (the @query template-ref accessor).
        // Previously this lowered to `this` (the host LitElement), but
        // engines that mount into the host append their DOM as LIGHT-DOM
        // children — outside the shadow root — invisible to the shadow's
        // scoped styles and breaking any engine (FullCalendar, Sortable
        // when used with shadow consumers) that needs a stable container
        // inside the rendered tree.
        const parentPath = path.parentPath;
        if (!parentPath) return;
        if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
        if (
          parentPath.isMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        ) {
          return;
        }
        if (
          parentPath.isObjectProperty() &&
          parentPath.node.key === path.node &&
          !parentPath.node.computed
        ) {
          return;
        }
        if (parentPath.isFunction()) {
          const params = (parentPath.node as { params: t.Node[] }).params;
          if (params.includes(path.node)) return;
        }
        path.replaceWith(
          t.memberExpression(t.identifier('$refs'), t.identifier('__rozieRoot')),
        );
        // Don't path.skip() — the synthesised MemberExpression should be
        // re-visited so the `$refs.__rozieRoot` handler fires.
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
      // OptionalMemberExpression (`obj?.X`) has the same shape — guard both,
      // otherwise method-name property positions like `instance?.upload()`
      // get incorrectly rewritten and the AST validator throws.
      if (
        (parentPath.isMemberExpression() || parentPath.isOptionalMemberExpression()) &&
        (parentPath.node as t.MemberExpression | t.OptionalMemberExpression).property === path.node &&
        !(parentPath.node as t.MemberExpression | t.OptionalMemberExpression).computed
      ) return;

      // ObjectProperty key positions:
      //   - non-shorthand `{ X: expr }` → the key is just a property name,
      //     not a reference; skip.
      //   - shorthand `{ X }` is BOTH key and value (same Identifier node).
      //     If the grandparent is an ObjectPattern (a destructuring BINDING,
      //     e.g. `({ X }) => …` or `const { X } = obj`), this is a binding —
      //     skip. If the grandparent is an ObjectExpression (a VALUE position,
      //     e.g. `return { X }`), un-shorthand the property and rewrite the
      //     value to `this.X`, leaving the key as `X`.
      if (parentPath.isObjectProperty() && parentPath.node.key === path.node) {
        if (parentPath.node.computed) return;
        if (!parentPath.node.shorthand) return;
        const grandparent = parentPath.parentPath?.node;
        if (t.isObjectPattern(grandparent)) return;
        // ObjectExpression value position: un-shorthand + rewrite value.
        // The path is shared between key and value in shorthand form, so
        // mutate the parent ObjectProperty directly rather than replaceWith.
        parentPath.node.shorthand = false;
        parentPath.node.value = thisDot(name);
        path.skip();
        return;
      }

      // Skip function parameters that ARE a bare Identifier (e.g.
      // `(editor) => …`). Destructured params (`({ editor }) => …`) are
      // handled by the binding-position / shadowing guards below.
      if (
        parentPath.isFunctionExpression() ||
        parentPath.isArrowFunctionExpression() ||
        parentPath.isFunctionDeclaration()
      ) {
        const fnNode = parentPath.node as t.Function;
        if (fnNode.params.some((p) => p === path.node)) return;
      }

      // Skip identifiers nested ANYWHERE inside an ObjectPattern / ArrayPattern
      // — these are destructuring BINDING positions (function params,
      // `const { x } = …`, `[a] = …`), not references. Catches the
      // destructured-parameter case `onUpdate: ({ editor }) => …` whose
      // `editor` shadows a promoted class field.
      if (isInBindingPosition(path)) return;

      // Lexical-scope shadowing: if a local binding (function param,
      // destructuring pattern, inner let/const/var) shadows the promoted
      // class-field/method name, the reference points at the LOCAL — skip.
      // Babel's scope cache is stale post-mutation, so this is a manual
      // ancestor walk.
      if (hasShadowingBinding(path, name)) return;

      // Rewrite to `this.<name>`.
      path.replaceWith(thisDot(name));
      path.skip();
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      const args = path.node.arguments;

      // $snapshot(x) → x — Lit `@property` accessors return plain values, so
      // the engine library already receives a non-reactive value. Identity
      // lowering keeps wrapper authors' `$snapshot()` calls cross-target
      // safe (the Svelte target uses `$state.snapshot(x)`).
      if (callee.name === '$snapshot') {
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) path.replaceWith(arg);
        }
        return;
      }

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
