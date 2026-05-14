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
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

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

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? '' : s.name)));
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
    classMembers.add(name);
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
        // Bug 7: when the author wrote a NON-optional access on `$refs.X`
        // (e.g. `$refs.triggerEl.getBoundingClientRect()` — `$refs.X` is the
        // `object` of a non-optional MemberExpression, or the `callee` of a
        // CallExpression), each `?.` lowering produces a fresh independent
        // optional chain that TS cannot re-narrow across an earlier
        // `if (!$refs.X) return` guard → TS2532. The author already opted
        // out of optionality by not writing `?.`, so emit a non-null
        // assertion `this.foo()!.nativeElement` instead.
        const parent = path.parent;
        const authoredNonOptional =
          (t.isMemberExpression(parent) && parent.object === path.node) ||
          (t.isCallExpression(parent) && parent.callee === path.node);
        if (authoredNonOptional) {
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
        const tplName =
          prop.name === ''
            ? 'defaultTpl'
            : `${prop.name}Tpl`;
        path.replaceWith(
          t.memberExpression(t.thisExpression(), t.identifier(tplName)),
        );
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
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) {
        return;
      }
      const eventName = firstArg.value;
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
