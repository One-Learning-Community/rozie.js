/**
 * rewriteScript — Phase 5 Plan 05-04a Task 1 (Angular target).
 *
 * Walks a CLONED Babel Program and rewrites Rozie magic accessors into
 * Angular 17+ idiomatic identifier shapes per RESEARCH Pattern 6:
 *
 *   - `$props.value`  (model)     → `this.value()`              (model() signal call)
 *   - `$props.value = x` (model)  → `this.value.set(x)`         (model.set())
 *   - `$props.value += step`      → `this.value.set(this.value() + step)` (compound)
 *   - `$props.step`   (non-model) → `this.step()`               (input() signal call)
 *   - `$data.foo`                 → `this.foo()`                (signal() call)
 *   - `$data.foo = x`             → `this.foo.set(x)`           (signal.set())
 *   - `$data.foo += 1`            → `this.foo.set(this.foo() + 1)`
 *   - `$refs.foo`                 → `this.foo()?.nativeElement` (viewChild signal)
 *   - `$slots.foo` (boolean)      → `this.fooTpl` (TemplateRef-typed @ContentChild)
 *   - `$emit('foo', x)`           → `this.foo.emit(x)`          (output() signal)
 *
 * Bare identifier references to top-level user-introduced names ALSO get
 * rewritten so cross-method calls and computed reads work as class members:
 *
 *   - bare `canIncrement` (ComputedDecl)  → `this.canIncrement()` (signal read)
 *   - bare `increment`    (user arrow)    → `this.increment`      (member ref)
 *   - bare `increment()`                  → `this.increment()`    (member call)
 *
 * Collision rename: when a user method/arrow collides with an emit name (e.g.,
 * Modal: user `close` arrow + `$emit('close')` → field `close = output<unknown>()`),
 * the user's arrow is renamed to `_close` so the output keeps the bare name.
 *
 * `$onMount`/`$onUnmount`/`$onUpdate` are NOT mutated by this pass — consumed
 * structurally from `ir.lifecycle` by emitScript.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws.
 * Per Phase 2 D-T-2-01-04 CJS-interop: normalize default-export.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import {
  hasShadowingBinding,
  isInBindingPosition,
} from './scopeAwareSkip.js';
import { sanitizeEventName } from './sanitizeEventName.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Decide whether a `$refs.X` access should lower to a non-null assertion
 * (`this.foo()!.nativeElement`) instead of the default optional chain
 * (`this.foo()?.nativeElement`).
 *
 * The optional chain is the safe DEFAULT — a ref whose element is `r-if`-gated
 * (e.g. Dropdown's `panelEl`) is genuinely `undefined` before it renders, and
 * guard code like `if (!$refs.panelEl) return` depends on `?.` yielding
 * `undefined`.
 *
 * Two contexts prove the author has asserted the element exists:
 *
 *   1. The author wrote a NON-optional access on it — `$refs.X.method()` /
 *      `$refs.X.prop` — so each independent `?.` lowering would otherwise
 *      defeat TS narrowing across an earlier `if (!$refs.X) return` (TS2532).
 *   2. It is handed to a function/constructor call — `flatpickr($refs.inputEl)`,
 *      `new Chart($refs.canvasEl)`, `new Editor({ element: $refs.editorEl })`
 *      — the canonical engine-wrapper pattern. The host element a vanilla-JS
 *      engine mounts into is unconditional by construction; passing a
 *      possibly-`undefined` value into a typed engine constructor is TS2379
 *      under `exactOptionalPropertyTypes`. The walk steps out through enclosing
 *      object/array literals so `{ element: $refs.editorEl }` is recognised as
 *      "passed into `new Editor(...)`".
 */
function refLowersToNonNull(path: NodePath<t.MemberExpression>): boolean {
  const parent = path.parent;
  // (1) authored non-optional member/call on the ref itself. OptionalMember /
  //     OptionalCall parents are intentionally excluded — the author opted
  //     into optionality there (`$refs.dialogEl?.focus()`).
  if (t.isMemberExpression(parent) && parent.object === path.node) return true;
  if (t.isCallExpression(parent) && parent.callee === path.node) return true;
  // (2) flows into a Call/NewExpression argument, possibly nested inside
  //     object/array literals.
  let child: t.Node = path.node;
  let p: NodePath | null = path.parentPath;
  while (p) {
    const n = p.node;
    if (
      (t.isCallExpression(n) || t.isNewExpression(n)) &&
      n.arguments.some((a) => (a as t.Node) === child)
    ) {
      return true;
    }
    if (t.isObjectProperty(n) && n.value === child) {
      child = n;
      p = p.parentPath;
      continue;
    }
    if (
      t.isObjectExpression(n) ||
      t.isArrayExpression(n) ||
      t.isSpreadElement(n)
    ) {
      child = n;
      p = p.parentPath;
      continue;
    }
    break;
  }
  return false;
}

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
  /**
   * Map of collision-renames applied to top-level user-method/arrow names
   * that conflict with emit-output field names. Plumbed to template + listener
   * emitters so identifier references in template attrs/events also get renamed.
   *
   * Example: when user has `const close = () => {...}` AND `$emit('close')`,
   * the user's arrow becomes `_close` (so output `close = output<unknown>()` can
   * keep its bare name). Template binding `@click="close"` rewrites to
   * `_close()` consequently.
   */
  collisionRenames: Map<string, string>;
  /**
   * Set of computed/state/method names that should be prefixed with `this.`
   * when referenced as bare identifiers. Plumbed to template + listener
   * emitters.
   */
  classMembers: Set<string>;
  /**
   * Subset of `classMembers` that are SIGNAL-typed (computed/state/props/refs/
   * model/input). When referenced as a bare identifier in READ position (NOT
   * call/assign), they need a `()` invocation suffix.
   */
  signalMembers: Set<string>;
}

const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
};

/**
 * Phase 07.3.2 Plan 10 — script-context `$slots.X` merge with dynamic-name
 * fallback. Produces `(this.<X>Tpl ?? this.templates()?.['<x>'])` so the
 * outer-r-if-guard semantics survive lowering through the class-body context.
 *
 * Single quotes on the computed-key string applied via `extra.raw` to match
 * emitSlotInvocation.ts:326 convention and minimize dist-parity diff.
 */
function buildScriptSlotsMerge(
  tplName: string,
  dynKey: string,
): t.Expression {
  const staticRef = t.memberExpression(t.thisExpression(), t.identifier(tplName));
  const templatesCall = t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier('templates')),
    [],
  );
  const dynKeyLit = t.stringLiteral(dynKey);
  (dynKeyLit as t.StringLiteral & { extra?: { raw?: string; rawValue?: string } }).extra = {
    raw: `'${dynKey}'`,
    rawValue: dynKey,
  };
  const dynamicRef = t.optionalMemberExpression(
    templatesCall,
    dynKeyLit,
    true,
    true,
  );
  const merge = t.logicalExpression('??', staticRef, dynamicRef);
  return t.parenthesizedExpression(merge);
}

/**
 * Build `this.foo.set(rhs)` for a plain `=`, or
 * `this.foo.set(this.foo() OP rhs)` for compound operators.
 */
function buildAngularSetterCall(
  signalName: string,
  operator: string,
  rhs: t.Expression,
): t.CallExpression {
  // this.foo.set(...)
  const setterCallee = t.memberExpression(
    t.memberExpression(t.thisExpression(), t.identifier(signalName)),
    t.identifier('set'),
  );
  if (operator === '=') {
    return t.callExpression(setterCallee, [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    return t.callExpression(setterCallee, [rhs]);
  }
  // Inner read: this.foo()
  const innerRead = t.callExpression(
    t.memberExpression(t.thisExpression(), t.identifier(signalName)),
    [],
  );
  return t.callExpression(setterCallee, [t.binaryExpression(binOp, innerRead, rhs)]);
}

/**
 * Pre-walk Program top-level statements to discover user-method/arrow names.
 * Returns the set of names that map to class methods/arrows in emitted output.
 */
function collectUserMethodNames(program: File): Set<string> {
  const names = new Set<string>();
  for (const stmt of program.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id) || !d.init) continue;
        // Skip $computed declarators (handled separately via ComputedDecl).
        if (
          t.isCallExpression(d.init) &&
          t.isIdentifier(d.init.callee) &&
          d.init.callee.name === '$computed'
        ) {
          continue;
        }
        names.add(d.id.name);
      }
      continue;
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

/**
 * Quick task 260520-w18 bug class 5 — Angular signal double-call narrowing.
 *
 * A `$props.X` / `$data.X` referenced TWICE in one function lowers to two
 * independent `this.X()` signal calls. TS narrowing does not survive across
 * two separate call expressions, so a guarded `if ($props.itemKey) … item[$props.itemKey]`
 * still sees `string | null` at the index (TS2538), and
 * `$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null` sees
 * `… | null` at `.join` (TS2531).
 *
 * The idiomatic fix is to read the signal ONCE into a local. This pre-pass
 * runs BEFORE the magic-accessor rewrite: for every function whose body is a
 * BlockStatement, it counts the non-computed `$props.X` / `$data.X` reads that
 * occur DIRECTLY in that function's own scope (descent stops at nested
 * function boundaries — a later-running callback must keep reading the live
 * signal). When the same accessor is read 2+ times read-only, it hoists a
 * `const __<X> = $props.<X>;` at the top of the block and rewrites every
 * occurrence to the bare `__<X>` identifier. The hoisted declarator's
 * `$props.<X>` initializer then flows through the normal MemberExpression
 * rewrite below and becomes `const __X = this.X();` — a single signal read
 * the rest of the body narrows against.
 *
 * Scope discipline keeps this from disturbing already-clean reference
 * examples: Counter's `$props.value += $props.step` reads each accessor once,
 * Dropdown / Modal / SearchInput / TodoList have no in-function double reads.
 */
export function hoistDoubleReadAccessors(program: File): void {
  // Walk one function body's OWN scope (not nested functions) collecting
  // read-only $props.X / $data.X MemberExpressions, keyed by `$accessor.name`.
  function collectInScope(
    node: t.Node,
    found: Map<string, t.MemberExpression[]>,
  ): void {
    // Stop at nested function boundaries — their reads belong to a different
    // (possibly later-running) scope.
    if (
      t.isFunctionDeclaration(node) ||
      t.isFunctionExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isObjectMethod(node) ||
      t.isClassMethod(node)
    ) {
      return;
    }
    if (
      t.isMemberExpression(node) &&
      !node.computed &&
      t.isIdentifier(node.object) &&
      (node.object.name === '$props' || node.object.name === '$data') &&
      t.isIdentifier(node.property)
    ) {
      const key = `${node.object.name}.${node.property.name}`;
      const list = found.get(key) ?? [];
      list.push(node);
      found.set(key, list);
      // Do NOT descend — $props.X has no rewritable children for this purpose.
      return;
    }
    // Recurse into children.
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') {
        continue;
      }
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === 'object' && 'type' in c) {
            collectInScope(c as t.Node, found);
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        collectInScope(child as t.Node, found);
      }
    }
  }

  // True when the given MemberExpression is the LHS of an AssignmentExpression
  // anywhere in the body — model writes / `$data.X = …` must NOT be hoisted.
  function isAssignedAnywhere(
    node: t.Node,
    accessor: string,
    name: string,
  ): boolean {
    let assigned = false;
    function walk(n: t.Node): void {
      if (assigned) return;
      if (t.isAssignmentExpression(n)) {
        const l = n.left;
        if (
          t.isMemberExpression(l) &&
          !l.computed &&
          t.isIdentifier(l.object) &&
          l.object.name === accessor &&
          t.isIdentifier(l.property) &&
          l.property.name === name
        ) {
          assigned = true;
          return;
        }
      }
      for (const key of Object.keys(n)) {
        if (key === 'loc') continue;
        const child = (n as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c === 'object' && 'type' in c) walk(c as t.Node);
          }
        } else if (child && typeof child === 'object' && 'type' in child) {
          walk(child as t.Node);
        }
      }
    }
    walk(node);
    return assigned;
  }

  // Replace every occurrence of `$accessor.name` in `body` (own scope only)
  // with `Identifier(localName)`.
  function replaceInScope(
    node: t.Node,
    accessor: string,
    name: string,
    localName: string,
  ): void {
    if (
      t.isFunctionDeclaration(node) ||
      t.isFunctionExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isObjectMethod(node) ||
      t.isClassMethod(node)
    ) {
      // Still descend into nested functions — the hoisted const is in their
      // closure scope, so replacing the read with the local keeps the single
      // narrowed value. (Nested functions inside `keyFor` etc. are rare; this
      // keeps the rewrite consistent when they DO appear.)
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (let i = 0; i < child.length; i++) {
          const c = child[i];
          if (c && typeof c === 'object' && 'type' in c) {
            const cn = c as t.Node;
            if (
              t.isMemberExpression(cn) &&
              !cn.computed &&
              t.isIdentifier(cn.object) &&
              cn.object.name === accessor &&
              t.isIdentifier(cn.property) &&
              cn.property.name === name
            ) {
              child[i] = t.identifier(localName);
            } else {
              replaceInScope(cn, accessor, name, localName);
            }
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        const cn = child as t.Node;
        if (
          t.isMemberExpression(cn) &&
          !cn.computed &&
          t.isIdentifier(cn.object) &&
          cn.object.name === accessor &&
          t.isIdentifier(cn.property) &&
          cn.property.name === name
        ) {
          (node as unknown as Record<string, unknown>)[key] = t.identifier(
            localName,
          );
        } else {
          replaceInScope(cn, accessor, name, localName);
        }
      }
    }
  }

  // Process a single function-body BlockStatement: hoist double-read accessors.
  function processBlock(block: t.BlockStatement): void {
    const found = new Map<string, t.MemberExpression[]>();
    for (const stmt of block.body) {
      collectInScope(stmt, found);
    }
    const hoists: t.Statement[] = [];
    for (const [key, occurrences] of found) {
      if (occurrences.length < 2) continue;
      const dotIdx = key.indexOf('.');
      const accessor = key.slice(0, dotIdx);
      const name = key.slice(dotIdx + 1);
      // Skip accessors that are also ASSIGNED in the body — single-reading a
      // mutated value would change semantics.
      if (isAssignedAnywhere(block, accessor, name)) continue;
      const localName = `__${name}`;
      // Hoist `const __X = $props.X;` — the initializer flows through the
      // normal $props.X → this.X() lowering downstream.
      hoists.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(localName),
            t.memberExpression(
              t.identifier(accessor),
              t.identifier(name),
            ),
          ),
        ]),
      );
      replaceInScope(block, accessor, name, localName);
    }
    if (hoists.length > 0) {
      block.body.unshift(...hoists);
    }
  }

  // Visit every function body in the Program.
  function visit(node: t.Node): void {
    if (
      (t.isFunctionDeclaration(node) ||
        t.isFunctionExpression(node) ||
        t.isArrowFunctionExpression(node) ||
        t.isObjectMethod(node) ||
        t.isClassMethod(node)) &&
      t.isBlockStatement(node.body)
    ) {
      processBlock(node.body);
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === 'object' && 'type' in c) visit(c as t.Node);
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        visit(child as t.Node);
      }
    }
  }

  visit(program.program);
}

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * Strategy: single-pass @babel/traverse with multiple visitors. Replacements
 * use `path.replaceWith` and DO NOT call `path.skip()` — letting traversal
 * descend into the replacement node ensures nested rewrites apply.
 */
export function rewriteRozieIdentifiers(
  program: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  // Quick task 260520-w18 bug class 5 — the double-read accessor hoist is
  // run by emitScript BEFORE pairClonedLifecycle (which slices lifecycle
  // hook bodies). Running it here would be too late: a hoisted `const`
  // unshifted after the slice would not survive into the lifecycle copy.

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? '' : s.name)));
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => s.name),
  );
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const emits = new Set(ir.emits);

  // Phase 06.1 P2 (D-104/D-106): name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));

  const userMethodNames = collectUserMethodNames(program);

  // Compute collision renames: any user method whose name matches an emit.
  const collisionRenames = new Map<string, string>();
  for (const name of userMethodNames) {
    if (emits.has(name)) {
      collisionRenames.set(name, `_${name}`);
    }
  }

  // Class member names — used for bare-identifier rewriting (`canIncrement` →
  // `this.canIncrement()`). Includes the RENAMED user methods (e.g., `_close`).
  const classMembers = new Set<string>();
  // Signal-typed members need `()` invocation when read as bare identifier.
  const signalMembers = new Set<string>();

  for (const name of modelProps) {
    classMembers.add(name);
    signalMembers.add(name);
  }
  for (const name of nonModelProps) {
    classMembers.add(name);
    signalMembers.add(name);
  }
  for (const name of dataNames) {
    classMembers.add(name);
    signalMembers.add(name);
  }
  for (const name of refNames) {
    classMembers.add(name);
    signalMembers.add(name);
  }
  for (const name of computedNames) {
    classMembers.add(name);
    signalMembers.add(name);
  }
  for (const name of emits) {
    // Output fields are NOT signals — they're EventEmitter-like. Bare reads
    // shouldn't be invoked, but they shouldn't appear in user code anyway
    // (user uses $emit instead).
    // Bug 2 (260520-gi1): the output() FIELD identifier is the sanitized
    // (valid-identifier) name; `this.<field>.emit(…)` must reference it.
    classMembers.add(sanitizeEventName(name));
  }
  // User methods (after collision rename) are class members but NOT signals.
  for (const original of userMethodNames) {
    const renamed = collisionRenames.get(original) ?? original;
    classMembers.add(renamed);
  }
  // SlotDecl tplFields are class members.
  for (const name of slotNames) {
    const tplField = name === '' ? 'defaultTpl' : `${name}Tpl`;
    classMembers.add(tplField);
  }

  /**
   * Determine whether an Identifier node should be treated as a bare reference
   * to a class member. Returns `true` when:
   *   - The identifier is NOT the LHS of an AssignmentExpression
   *     (we need to allow `_close = ...` declarations on rename, but those
   *     are wrapped in VariableDeclarator paths, not AssignmentExpression LHS).
   *   - The identifier is NOT a property name of a MemberExpression (e.g., `obj.x`).
   *   - The identifier is NOT a key of an ObjectProperty (e.g., `{ x: 1 }`).
   *   - The identifier is NOT a function/arrow parameter binding.
   *   - The identifier is NOT the id of a VariableDeclarator (`const X = ...`).
   *   - The identifier is NOT the id of a FunctionDeclaration.
   *   - The identifier is NOT the local of an ImportSpecifier.
   *   - The identifier is NOT a label.
   */
  function isBareReference(path: import('@babel/traverse').NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    const node = path.node;

    // VariableDeclarator id position: `const X = ...` — declaration, skip.
    if (t.isVariableDeclarator(parent) && parent.id === node) return false;
    // FunctionDeclaration/ArrowFunctionExpression id — declaration.
    if (
      (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent)) &&
      parent.id === node
    ) {
      return false;
    }
    // Parameter position.
    if (
      (t.isArrowFunctionExpression(parent) ||
        t.isFunctionExpression(parent) ||
        t.isFunctionDeclaration(parent)) &&
      parent.params.includes(node)
    ) {
      return false;
    }
    // Object property key (non-computed) — `{ key: val }`.
    if (
      (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
      parent.key === node &&
      !parent.computed
    ) {
      return false;
    }
    // MemberExpression property (non-computed) — `obj.prop`.
    if (
      (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
      parent.property === node &&
      !parent.computed
    ) {
      return false;
    }
    // Label / Break / Continue.
    if (
      t.isLabeledStatement(parent) ||
      t.isBreakStatement(parent) ||
      t.isContinueStatement(parent)
    ) {
      return false;
    }
    // ImportSpecifier — skip imports.
    if (
      t.isImportSpecifier(parent) ||
      t.isImportDefaultSpecifier(parent) ||
      t.isImportNamespaceSpecifier(parent) ||
      t.isExportSpecifier(parent)
    ) {
      return false;
    }
    return true;
  }

  traverse(program, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;

      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$data') {
        if (!dataNames.has(prop.name)) return;
        const setterCall = buildAngularSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        return;
      }

      if (obj.name === '$props') {
        if (!modelProps.has(prop.name)) return;
        const setterCall = buildAngularSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
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
          // $props.value → this.value()  (signal read)
          // Phase 06.1 P2 D-104/D-106: anchor synth nodes to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          const synthCall = t.callExpression(
            t.memberExpression(t.thisExpression(), synthId),
            [],
          );
          if (propDecl) synthCall.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthCall);
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → this.hovering()  (signal read)
        // Phase 06.1 P2 D-104/D-106: anchor synth nodes to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        const synthCall = t.callExpression(
          t.memberExpression(t.thisExpression(), synthId),
          [],
        );
        if (stateDecl) synthCall.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthCall);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.foo → this.foo()?.nativeElement  (default, optional)
        // Phase 06.1 P2 D-104/D-106: anchor synth nodes to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (refDecl) synthId.loc = refDecl.sourceLoc as any;
        const refCall = t.callExpression(
          t.memberExpression(t.thisExpression(), synthId),
          [],
        );
        // Lower to `this.foo()!.nativeElement` (non-null) vs
        // `this.foo()?.nativeElement` (optional) per refLowersToNonNull —
        // authored non-optional access (TS2532 narrowing) OR passed into an
        // engine constructor/function call (TS2379 under
        // exactOptionalPropertyTypes). See refLowersToNonNull's doc comment.
        if (refLowersToNonNull(path)) {
          path.replaceWith(
            t.memberExpression(
              t.tsNonNullExpression(refCall),
              t.identifier('nativeElement'),
            ),
          );
          return;
        }
        path.replaceWith(
          t.optionalMemberExpression(
            refCall,
            t.identifier('nativeElement'),
            false,
            true,
          ),
        );
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 10 — merge with dynamic-name fallback so script
        // expressions referencing $slots.X also benefit from the consumer-side
        // templates() input map. Script context always uses `this.` prefix.
        const tplName = prop.name === '' ? 'defaultTpl' : `${prop.name}Tpl`;
        const dynKey = prop.name === '' ? 'defaultSlot' : prop.name;
        path.replaceWith(buildScriptSlotsMerge(tplName, dynKey));
        return;
      }
      if (obj.name === '$portals' && portalSlotNames.has(prop.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the ngAfterViewInit() method body.
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

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
          );
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
            [],
          ),
        );
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(
          t.optionalMemberExpression(
            t.callExpression(
              t.memberExpression(t.thisExpression(), t.identifier(prop.name)),
              [],
            ),
            t.identifier('nativeElement'),
            false,
            true,
          ),
        );
        return;
      }
    },

    /**
     * `$emit('event', ...args)` → `this.event.emit(...args)`
     *
     * Also: `$snapshot(x)` → `x` — Angular signal reads via `this.X()` yield
     * plain values, so the engine library already receives a non-reactive
     * value. Identity lowering keeps wrapper authors' `$snapshot()` calls
     * cross-target safe (the Svelte target uses `$state.snapshot(x)`).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      if (callee.name === '$snapshot') {
        const args = path.node.arguments;
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) path.replaceWith(arg);
        }
        return;
      }

      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) {
        return;
      }
      // Bug 2 (260520-gi1): the output() field id is the sanitized
      // (valid-identifier) name; `this.<field>.emit(…)` must agree with the
      // field declaration emitted in emitScript.ts.
      const eventName = sanitizeEventName(firstArg.value);
      const restArgs = args.slice(1) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      const replacement = t.callExpression(
        t.memberExpression(
          t.memberExpression(t.thisExpression(), t.identifier(eventName)),
          t.identifier('emit'),
        ),
        restArgs,
      );
      path.replaceWith(replacement);
    },

    /**
     * Bare-identifier rewrite: top-level user-introduced names → class members.
     *
     * Examples:
     *   - bare `canIncrement` (ComputedDecl)        → `this.canIncrement()`
     *   - bare `increment` (user arrow callee)      → `this.increment`
     *   - bare `close` (user arrow, collision-renamed) → `this._close`
     *
     * For VariableDeclarator id positions where the name is a collision-rename
     * target, ALSO rename the declaration site (so `const close = ...` becomes
     * `const _close = ...` before later being lifted to the class field).
     *
     * NOTE: This visitor runs after the structural rewrites above, so we won't
     * accidentally re-rewrite already-rewritten `this.X.emit(...)` calls.
     */
    Identifier(path) {
      const name = path.node.name;

      // Spike 001 B2 — script-context `$el` lowers to
      // `MemberExpression($refs, __rozieRoot)`. The IR pass `lowerRootElementRef`
      // already appended `RefDecl { name: '__rozieRoot' }` to `ir.refs` when a
      // free `$el` read was detected, so the synthesised MemberExpression
      // naturally flows into the existing `$refs.X` handler above and lowers
      // to `this.__rozieRoot()?.nativeElement` (Angular's viewChild() signal
      // accessor).
      if (name === '$el') {
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
        // Do NOT path.skip() — let the visitor re-visit the synthesised
        // MemberExpression so the `$refs.X` handler downstream lowers it.
        return;
      }

      // Handle declaration-site renames for collisions: `const close` →
      // `const _close`, `function close()` → `function _close()`.
      if (collisionRenames.has(name)) {
        const parent = path.parent;
        // VariableDeclarator id position (e.g., `const close = ...`).
        if (t.isVariableDeclarator(parent) && parent.id === path.node) {
          path.node.name = collisionRenames.get(name)!;
          return;
        }
        // FunctionDeclaration id (e.g., `function close() {}`).
        if (t.isFunctionDeclaration(parent) && parent.id === path.node) {
          path.node.name = collisionRenames.get(name)!;
          return;
        }
      }

      // Scope-aware binding guards (Bug 1 — quick task 260520-gi1).
      //
      // Shorthand ObjectProperty `{ X }`: after cloneScriptProgram the key and
      // value Identifiers may be distinct nodes, so `isBareReference` no longer
      // reliably skips the value side. Handle it explicitly:
      //   - grandparent ObjectPattern (a destructuring BINDING, e.g.
      //     `onUpdate: ({ editor }) => …`) → skip; rewriting it to
      //     `{ editor: this.editor }` is an illegal binding pattern.
      //   - grandparent ObjectExpression (a VALUE position, e.g.
      //     `return { editor }`) → un-shorthand to `{ editor: this.editor() }`
      //     so the class-member reference still resolves; the `()` signal
      //     suffix is applied by the normal rewrite path below.
      {
        const p = path.parent;
        if (
          t.isObjectProperty(p) &&
          !p.computed &&
          p.shorthand &&
          (p.key === path.node || p.value === path.node)
        ) {
          const grandparent = path.parentPath?.parentPath?.node;
          if (t.isObjectPattern(grandparent)) return;
          if (t.isObjectExpression(grandparent)) {
            if (!classMembers.has(name) && !collisionRenames.has(name)) return;
            const renamed = collisionRenames.get(name) ?? name;
            const memberRef = t.memberExpression(
              t.thisExpression(),
              t.identifier(renamed),
            );
            p.shorthand = false;
            p.value = signalMembers.has(name)
              ? t.callExpression(memberRef, [])
              : memberRef;
            path.skip();
            return;
          }
        }
      }
      // Identifiers nested ANYWHERE inside an ObjectPattern / ArrayPattern are
      // destructuring BINDING positions, not references — skip. Catches nested
      // patterns (`{ a: { editor } }`) and array-pattern elements that the flat
      // `parent.params.includes(node)` guard in `isBareReference` misses.
      if (isInBindingPosition(path)) return;
      // Lexical-scope shadowing: a local binding (function param, destructuring
      // pattern, inner let/const/var) that shadows a promoted class-member name
      // means the reference points at the LOCAL — skip the `this.` rewrite.
      if (hasShadowingBinding(path, name)) return;

      if (!isBareReference(path)) return;
      // Don't rewrite the magic Rozie identifiers themselves — already handled.
      if (name === '$props' || name === '$data' || name === '$refs' || name === '$slots') {
        return;
      }
      if (name === '$emit' || name === '$onMount' || name === '$onUnmount' || name === '$onUpdate') {
        return;
      }

      // Skip if the Identifier IS the direct first argument of a lifecycle
      // call (e.g., `$onMount(lockScroll)`) — emitScript's pairClonedLifecycle
      // pass needs to see bare Identifier names so it can pair $onMount /
      // $onUnmount Identifier-pair entries (D-19). The renderLifecycleHook
      // helper handles `this.` prefixing on the rendered output side.
      const parent = path.parent;
      if (
        t.isCallExpression(parent) &&
        t.isIdentifier(parent.callee) &&
        (parent.callee.name === '$onMount' ||
          parent.callee.name === '$onUnmount' ||
          parent.callee.name === '$onUpdate') &&
        parent.arguments.includes(path.node)
      ) {
        return;
      }

      // Skip if not a known class member (handles user-local vars, globals, params, etc.).
      if (!classMembers.has(name) && !collisionRenames.has(name)) {
        return;
      }

      const renamedName = collisionRenames.get(name) ?? name;

      // Determine if a `()` call suffix is needed:
      // - Signal members read as a bare identifier in NON-call position need `()`.
      // - In call position (callee of CallExpression), no `()` because the
      //   call expression itself provides invocation; just rewrite to `this.X`.
      // - In the LHS of an AssignmentExpression, rewrite to `this.X` (no call).
      //   But assignments to signals are handled by the AssignmentExpression
      //   visitor above (e.g., `$data.x = y` becomes `this.x.set(y)`); a bare
      //   `hovering = true` (no `$data.` prefix) is technically valid user code
      //   but unusual — Counter doesn't use it. Skip to avoid breaking semantics.

      const isCallee =
        (t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
        parent.callee === path.node;
      const isAssignLeft =
        t.isAssignmentExpression(parent) && parent.left === path.node;

      if (isAssignLeft && signalMembers.has(name)) {
        // Bare `signalName = X` would need `.set(X)` semantics. The structural
        // AssignmentExpression visitor above only handles `$data.X = Y` /
        // `$props.X = Y` shapes — bare assignments are unusual in practice and
        // not exercised by reference examples. Defer to v2 for safety.
        return;
      }

      const memberExpr = t.memberExpression(
        t.thisExpression(),
        t.identifier(renamedName),
      );

      if (isAssignLeft) {
        // Non-signal class member assignment: `savedBodyOverflow = X`
        // → `this.savedBodyOverflow = X`. Plain LValue rewrite.
        path.replaceWith(memberExpr);
        return;
      }

      if (isCallee || !signalMembers.has(name)) {
        // Direct member ref — `this.X` (no auto-call).
        path.replaceWith(memberExpr);
        return;
      }

      // Signal in read position — append `()` for invocation.
      path.replaceWith(t.callExpression(memberExpr, []));
    },
  });

  return {
    rewrittenProgram: program,
    diagnostics,
    collisionRenames,
    classMembers,
    signalMembers,
  };
}
