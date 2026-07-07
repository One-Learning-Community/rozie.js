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
import { portalKey } from '../../../../core/src/ir/types.js';
import type { File, Program, Expression, Statement } from '@babel/types';
import { isInTypePosition } from '../../../../core/src/ast/typePosition.js';
import {
  deconflictReservedClassFields,
  reservedClassMembers,
  DECONFLICT_SUFFIX,
} from '../../../../core/src/rewrite/deconflict.js';
import { cloneScriptProgram } from './cloneProgram.js';
import {
  hasShadowingBinding,
  isInBindingPosition,
} from './scopeAwareSkip.js';
import { redirectNestedThis } from './redirectNestedThis.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';
import type { RuntimeLitImportCollector } from './collectLitImports.js';

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
 * Map a JS compound-assignment operator (`+=`, `-=`, …) to its binary
 * counterpart (`+`, `-`, …). Used to desugar a producer-internal compound
 * model write into a functional-updater `write(prev => prev OP rhs)` call.
 */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '&=': '&',
  '|=': '|',
  '^=': '^',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
};

/**
 * Build the producer-internal model-write call:
 *
 *   `$props.items = next`        →  `this._itemsControllable.write(next)`
 *   `$props.value += $props.step` →  `this._valueControllable.write(prev => prev + $props.step)`
 *
 * The producer mutating its OWN `model: true` prop must NOT go through the
 * public `set <name>()` property setter — that setter is reserved for an
 * external parent's `.prop=${…}` binding and routes through
 * `notifyPropertyWrite` (controlled-mode entry). Routing the producer's own
 * write there would spuriously flip a standalone uncontrolled producer into
 * controlled mode and freeze its local state. So the producer write is lowered
 * to a direct `_<name>Controllable.write(…)` call (mirroring React's
 * `setValue(…)` model-write contract).
 *
 * The returned node is left UN-skipped by the caller so the surrounding
 * traversal still descends into the `write(…)` argument and rewrites any
 * `$props.X` / `$data.X` reads inside the RHS.
 */
function buildModelWriteCall(
  propName: string,
  operator: string,
  rhs: t.Expression,
): t.CallExpression {
  const controllable = t.memberExpression(
    t.memberExpression(t.thisExpression(), t.identifier(`_${propName}Controllable`)),
    t.identifier('write'),
  );
  if (operator === '=') {
    return t.callExpression(controllable, [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    // Unknown compound operator — fall back to a plain write of the RHS.
    return t.callExpression(controllable, [rhs]);
  }
  // `prev => prev OP rhs` — functional updater so the OLD value is read
  // through the controllable's resolver rather than via the public getter.
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(controllable, [arrow]);
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
    // Spike-012 R3-5: `$refs.X` lowers to the PREFIXED `this._refX` @query field,
    // so a same-named TOP-LEVEL user binding (`const box = 0` alongside
    // `ref="box"`) does NOT collide with the ref field — it is a genuine promoted
    // class field (`box`) whose references must become `this.box`. Refs are
    // therefore NOT reserved here: excluding them left the user binding's
    // references bare (`… + box` instead of `this.box`) → TS2663. A `const box =
    // $refs.box` self-shadow is impossible to reach (refs outside `$onMount` are a
    // ROZ123 error), so this only ever promotes a real user binding.
    ...ir.props.map((p) => p.name),
    ...ir.slots.map((s) => (s.name === '' ? 'default' : s.name)),
  ]);
  // Phase 46 ITEM-5 / D-02 — a top-level user binding whose name is a reserved
  // class-field member (Object.prototype on Lit+Angular; inherited DOM members
  // on Lit) is auto-renamed to `<name>$local` by `deconflictReservedClassFields`
  // in `rewriteScript`. The method-name set MUST reflect that rename so the bare
  // `<name>` references in lifecycle/watcher FRAGMENTS (which receive this set as
  // `methodNamesOverride`) rewrite to `this.<name>$local` consistently with the
  // renamed class field. Same deterministic transform, single source of truth.
  const litReserved = reservedClassMembers('lit');
  // PUBLIC-CONTRACT names ($expose verbs + prop names) are NEVER renamed (D-02).
  const litProtected = new Set<string>([
    ...(ir.expose ?? []).map((e) => e.name),
    ...(ir.props ?? []).map((p) => p.name),
  ]);
  const classFieldName = (n: string): string =>
    litReserved.has(n) && !litProtected.has(n) ? `${n}${DECONFLICT_SUFFIX}` : n;

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
          names.add(classFieldName(decl.id.name));
        }
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id && !reserved.has(stmt.id.name)) {
      names.add(classFieldName(stmt.id.name));
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
  /**
   * Optional runtime-import collector. When provided, the CallExpression
   * visitor registers `__rozieReconcileAfterDomMutation` from
   * `@rozie/runtime-lit` whenever a `$reconcileAfterDomMutation()` call is
   * lowered (pre-Phase-16 cleanup Item 3). When undefined, the call is still
   * rewritten — but the caller is responsible for ensuring the import line
   * lands in the emitted SFC. emitScript.ts always passes the collector;
   * test-only callers may omit it.
   */
  runtime?: RuntimeLitImportCollector;
}

/**
 * Phase 18 (Req 2) — normalize the producer-side two-way-write sigil `$model`
 * to `$props` across a cloned File, in place. See the call-site comment in
 * `rewriteScript` for the full contract; `$model.X` is model-only and always a
 * member-expression object, so the object-Identifier rename routes read/write
 * through the IDENTICAL `$props.<modelProp>` lowering. Reuse, not reimplement.
 */
function normalizeModelAccessor(file: File): void {
  traverse(file, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });
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
    ir.slots.filter((s) => s.isPortal === true).map((s) => portalKey(s)),
  );
  const methodNames =
    opts.methodNamesOverride ?? collectMethodNamesFromProgram(cloned, ir);

  // Spike-012 R4-E — a top-level user binding whose name is a reserved class
  // member (`const title` → HTMLElement.title) is renamed to `title$local` (both
  // the emitted field AND `methodNames`, via `classFieldName` in
  // `collectMethodNamesFromProgram`). The MAIN program's references are renamed in
  // lockstep by `deconflictReservedClassFields`, but a LIFECYCLE-hook FRAGMENT
  // (`$onMount` body — rewritten from the ORIGINAL `hook.setup.body` with a
  // `methodNamesOverride`) still carries the bare `title`, which never matched the
  // `title$local` in `methodNames` → the read stayed a free `title` (TS2663). This
  // local `classFieldName` normalizes a bare reference to its emitted field name in
  // BOTH the match guard and the `this.<field>` output, so a fragment `title` reads
  // as `this.title$local` consistently with the field. Non-reserved names are
  // identity-mapped (byte-identical).
  const litReservedFields = reservedClassMembers('lit');
  const litProtectedFields = new Set<string>([
    ...(ir.expose ?? []).map((e) => e.name),
    ...(ir.props ?? []).map((p) => p.name),
  ]);
  const classFieldNameFor = (n: string): string =>
    litReservedFields.has(n) && !litProtectedFields.has(n) ? `${n}${DECONFLICT_SUFFIX}` : n;

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X`.
  // `$model` is model-only by contract: Wave 1's core semantic pass already
  // rejected `$model.<nonModelProp>` (ROZ205) / `$model.<nonExistent>` (ROZ113)
  // BEFORE lowering, so every `$model.X` reaching the emitter is a declared
  // model prop. `$model` is always a member-expression object (D-03), so we
  // normalize the accessor `$model` → `$props` in a single pre-pass; every
  // downstream write/read site then routes through the IDENTICAL
  // `$props.<modelProp>` lowering (same `_<name>Controllable.write(...)` on
  // write, same `this.<name>` getter on read) → byte-identical emit. Reuse,
  // not reimplement (SPEC Req 2).
  normalizeModelAccessor(cloned);

  // UNIFIED DECONFLICTION PASS (Phase 46 ITEM-5 / D-02) — CLASS-TARGET sub-case.
  // Lit's accessors are `this.`-qualified (immune to the bare-ident accessor
  // shadow) BUT its component class `extends LitElement` → `HTMLElement`, so a
  // top-level user `<script>` binding that becomes a CLASS FIELD named e.g.
  // `valueOf` (Object.prototype) or `focus`/`scrollTo`/`nodeType` (inherited DOM)
  // overrides the inherited member and breaks `@property` assignability,
  // cascading TS1240/TS1271 to every decorator on the class (the listbox
  // `valueOf` finding — 38 errors from one name). Rename such a top-level binding
  // to `X$local`; the `this.X$local` references + the methodNames set (which
  // applies the SAME suffix transform) follow. Only-on-collision: a non-reserved
  // top-level name is byte-identical. Runs on the freshly-cloned Program before
  // the lowering traversal.
  deconflictReservedClassFields(
    cloned,
    reservedClassMembers('lit'),
    new Set<string>([
      ...(ir.expose ?? []).map((e) => e.name),
      ...(ir.props ?? []).map((p) => p.name),
    ]),
  );

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

      if (obj.name === '$props' && modelProps.has(prop.name)) {
        // $props.x = y  (model write) →  this._xControllable.write(y)
        //
        // The producer mutating its own model goes through the controllable's
        // `write()` directly, NOT through the public `set x()` property
        // setter. The setter is the external-parent entry point and routes
        // through `notifyPropertyWrite` (controlled-mode entry); sending the
        // producer's own write there would flip a standalone uncontrolled
        // producer into controlled mode. Compound writes (`+=` etc.) desugar
        // to `write(prev => prev OP rhs)`. This mirrors React's `setValue(…)`
        // model-write contract.
        //
        // No `path.skip()` — let the traversal descend into the synthesized
        // `write(…)` argument so `$props.Y` / `$data.Y` reads in the RHS
        // (e.g. `$props.value += $props.step`, `[...$props.items, …]`) are
        // still rewritten by the MemberExpression visitor.
        path.replaceWith(
          buildModelWriteCall(prop.name, node.operator, node.right),
        );
        return;
      }

      if (obj.name === '$props' && nonModelProps.has(prop.name)) {
        // $props.x = y  (non-model write) →  this.x = y
        // (This is a runtime error path; emitter does best-effort.)
        path.get('left').replaceWith(thisDot(prop.name));
        return;
      }
    },

    /**
     * `$props.x++` / `$props.x--` (model) — the UpdateExpression mutation.
     *
     * `$data.x++` does NOT need handling here: the MemberExpression visitor
     * lowers `$data.x` to the settable signal property `this._x.value`, and
     * `this._x.value++` is valid. But a MODEL `$props.x` lowers to the public
     * getter `this.x`, and `this.x++` would route through the public setter
     * (`notifyPropertyWrite`, the external-parent / controlled-mode entry) —
     * the SAME bug the AssignmentExpression visitor avoids by going through
     * `_<name>Controllable.write(...)`. So we intercept the model `++`/`--`
     * here and route it through the SAME `buildModelWriteCall` path the
     * compound-assignment case uses: `++` → `write(prev => prev + 1)`.
     *
     * Statement-context only — see the React target's UpdateExpression visitor
     * for the postfix-expression-value rationale.
     */
    UpdateExpression(path) {
      const node = path.node;
      const arg = node.argument;
      if (!t.isMemberExpression(arg) || arg.computed) return;
      const obj = arg.object;
      const prop = arg.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;
      if (obj.name !== '$props' || !modelProps.has(prop.name)) return;

      if (!path.parentPath?.isExpressionStatement()) return;

      const op = node.operator === '++' ? '+=' : '-=';
      path.replaceWith(buildModelWriteCall(prop.name, op, t.numericLiteral(1)));
    },

    MemberExpression(path) {
      // WR-02 (Phase 9) — skip member expressions in TS type position
      // (`let x: typeof $data.foo`). Without this the `$data.foo` rewrite
      // would mangle a `typeof`-query inside a type annotation.
      if (isInTypePosition(path)) return;
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
      // WR-02 (Phase 9) — skip identifiers in TypeScript type position. A
      // `<script lang="ts">` Program carries `TS*` nodes and @babel/traverse
      // descends into them; without this guard a type-reference identifier
      // (`let x: someComputed`) whose name collides with a promoted class
      // field/method would be rewritten to `this.someComputed` INSIDE the
      // type annotation, producing invalid TS. Mirrors the identical guard in
      // core's computeDeps.
      if (isInTypePosition(path)) return;
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

      // R4-E — a reserved-named binding's field is `<name>$local`; match a bare
      // reference by its normalized field name (a non-reserved name is unchanged),
      // and emit `this.<field>` below via `emitField`.
      const emitField = classFieldNameFor(name);
      if (
        !computedNames.has(name) &&
        !methodNames.has(name) &&
        !methodNames.has(emitField)
      )
        return;

      const parentPath = path.parentPath;
      if (!parentPath) return;

      // Skip the BINDING SITES of these names:
      //   - `const X = ...` (X is the binding)
      //   - `function X() {}` (X is the binding)
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      if (parentPath.isFunctionDeclaration() && parentPath.node.id === path.node) return;

      // Skip statement-LABEL slots — a `LabeledStatement.label`, `break X`, or
      // `continue X` label named like a promoted verb is a non-reference
      // identifier position babel-types forbids from being a MemberExpression
      // (rewriting `reset: for (…)` → `this.reset: for (…)` throws). Same class
      // as the import/export-specifier + catch-param guards. Spike-012 NEW-1.
      if (
        (parentPath.isLabeledStatement() && parentPath.node.label === path.node) ||
        (parentPath.isBreakStatement() && parentPath.node.label === path.node) ||
        (parentPath.isContinueStatement() && parentPath.node.label === path.node)
      ) return;

      // Skip import/export specifier NAME slots — `imported`/`local`/`exported`
      // are module-binding names, never value references. An aliased import whose
      // imported name equals a promoted verb (`import { undo as undoCmd }` where
      // `undo` is an $expose verb) would otherwise have its `imported` Identifier
      // rewritten to `this.undo` — an invalid `ImportSpecifier.imported` node that
      // throws in @babel/types ("expected Identifier|StringLiteral but got
      // MemberExpression"). Same class as the ObjectMethod-key guard below: an
      // identifier sitting in a non-reference slot must not be rewritten.
      if (
        parentPath.isImportSpecifier() ||
        parentPath.isImportDefaultSpecifier() ||
        parentPath.isImportNamespaceSpecifier() ||
        parentPath.isExportSpecifier()
      ) return;

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
        parentPath.node.value = thisDot(emitField);
        path.skip();
        return;
      }

      // ObjectMethod / ClassMethod key positions (`{ get color() {…} }`,
      // `{ color() {…} }`, `{ async color() {…} }`) — the key is a NON-COMPUTED
      // property name, never a reference, so it must NOT be rewritten. Phase 36
      // ($provide / $inject) surfaced this: a provided value carrying a getter
      // over a promoted name (`$provide('theme', { get color() { return color },
      // cycle })`) put the promoted identifier `color`/`cycle` in an
      // `ObjectMethod.key` slot — without this guard the visitor rewrote the key
      // to `this.color`, which is an invalid `ObjectMethod` key node and threw
      // in @babel/generator ("Property key of ObjectMethod expected … got
      // MemberExpression"). The getter/method BODY is a separate subtree and is
      // still visited + rewritten normally; only the key position is skipped.
      if (
        (parentPath.isObjectMethod() || parentPath.isClassMethod()) &&
        parentPath.node.key === path.node &&
        !parentPath.node.computed
      ) return;

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

      // Rewrite to `this.<field>` (`<name>` normalized to its emitted field name).
      path.replaceWith(thisDot(emitField));
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

      // $clone(x) → structuredClone(x) — Phase 45 (D-01). Lit `@property`
      // accessors return plain values, so there is no reactive proxy to
      // unwrap; a direct structuredClone gives an independent deep copy safe
      // for undo/history stacks. No `toRaw` (Vue-only) / `$state.snapshot`
      // (Svelte-only) here. Uses the in-scope `const args` hoisted above the
      // if-chain (do NOT re-declare). Do NOT path.skip() — the single argument
      // may carry $props.X / $data.X reactive reads (e.g. $clone($data.graph))
      // that still need rewriting to the `this._X.value` form.
      if (callee.name === '$clone') {
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) {
            path.replaceWith(
              t.callExpression(t.identifier('structuredClone'), [arg]),
            );
          }
        }
        return;
      }

      // $classSelector('grip') → ".grip" — Lit keeps authored class names
      // literal in the emitted DOM (style isolation via [data-rozie-s-<hash>]),
      // so the compile-time literal is correct. Shared with
      // rewriteTemplateExpression.ts via lowerClassSelectorCall so the two
      // hooks cannot drift (Pitfall 4).
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      // $reconcileAfterDomMutation() → __rozieReconcileAfterDomMutation(this)
      // — pre-Phase-16 cleanup Item 3 escape hatch for engine wrappers whose
      // third-party DOM mutation has desynchronised lit-html's `repeat`
      // directive cache. The helper tears down the part tree via
      // `render(nothing, host.renderRoot)` and schedules a fresh update.
      // Non-Lit targets lower this call to `void 0` (no-op); Lit is the only
      // target that needs the runtime helper because lit-html's `repeat`
      // is uniquely sentinel-comment-cache-keyed in the matrix (every other
      // target's reconciler diffs against live `parent.children` at patch
      // time, so the in-source DOM-restore dance suffices).
      if (callee.name === '$reconcileAfterDomMutation') {
        path.replaceWith(
          t.callExpression(t.identifier('__rozieReconcileAfterDomMutation'), [
            t.thisExpression(),
          ]),
        );
        opts.runtime?.add('__rozieReconcileAfterDomMutation');
        return;
      }

      // Phase 16 — $restoreFocus(sel, idx) → queueMicrotask(() =>
      //   (this.renderRoot.querySelectorAll(sel)?.[idx] as HTMLElement |
      //     undefined)?.focus()). lit-html's keyed reconciler (`repeat`
      //   directive) recreates row DOM on reorder; restore focus scoped to
      //   the host's renderRoot. SPEC R4 lowering table. NO runtime helper —
      //   pure DOM API. D-04 permits upgrading to `this.updateComplete.then(...)`
      //   if VR exposes a flake.
      //
      //   Phase 16-04 typecheck — `querySelectorAll(...)` returns
      //   `NodeListOf<Element>`; `Element` lacks `.focus()`. Cast the indexed
      //   result so the optional-chained `.focus?.()` typechecks cleanly.
      if (callee.name === '$restoreFocus') {
        const callArgs = path.node.arguments;
        const selArg = callArgs[0];
        const idxArg = callArgs[1];
        if (!selArg || !idxArg) return; // validator ROZ976 already caught this
        if (!t.isExpression(selArg) || !t.isExpression(idxArg)) return;
        const indexedAccess = t.optionalMemberExpression(
          t.callExpression(
            t.memberExpression(
              t.memberExpression(
                t.thisExpression(),
                t.identifier('renderRoot'),
              ),
              t.identifier('querySelectorAll'),
            ),
            [selArg],
          ),
          idxArg,
          /* optional */ true,
          /* computed */ true,
        );
        const asHtmlElement = t.tsAsExpression(
          indexedAccess,
          t.tsUnionType([
            t.tsTypeReference(t.identifier('HTMLElement')),
            t.tsUndefinedKeyword(),
          ]),
        );
        const focusCall = t.optionalCallExpression(
          t.optionalMemberExpression(
            asHtmlElement,
            t.identifier('focus'),
            /* computed */ false,
            /* optional */ true,
          ),
          [],
          /* optional */ true,
        );
        const arrow = t.arrowFunctionExpression([], focusCall);
        path.replaceWith(
          t.callExpression(t.identifier('queueMicrotask'), [arrow]),
        );
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

  // Post-pass: repair `this` inside nested plain functions (BUG-2). Runs after
  // the main lowering so every emitter-injected `this.<…>` is visible.
  redirectNestedThis(cloned);

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
