/**
 * hoistModuleLet — Plan 04-02 Task 2 (Wave 0 spike resolution).
 *
 * Detects module-scoped `let X = init` declarations referenced from a
 * LifecycleHook setup body (directly or via one-level helper indirection),
 * auto-hoists them to a `useRef(init)` inside the component body, and
 * rewrites every reference (read AND write) to `X.current`.
 *
 * Spike outcome (04-02-SPIKE.md): Modal.rozie's `let savedBodyOverflow = ''`
 * referenced by `lockScroll`/`unlockScroll` (top-level arrows passed
 * directly to $onMount/$onUnmount as Identifiers) is category (b) ONE-LEVEL
 * HELPER → AUTO-HOIST is feasible. Emits ROZ522 advisory.
 *
 * Detection rules (verbatim from 04-02-SPIKE.md):
 *   1. Top-level VariableDeclaration nodes with kind === 'let'
 *   2. Top-level helpers (const X = arrow|fn OR function X) → which
 *      module-lets they reference
 *   3. For each LifecycleHook:
 *      (a) setup is arrow/fn whose body references a module-let → hoist
 *      (b) setup OR cleanup is Identifier matching a top-level helper that
 *          references a module-let → hoist
 *      (c) deeper indirection / unknown — leave UNHOISTED (no diagnostic
 *          in v1; user code remains as `let X = ...` and survives via the
 *          residual top-level Program. Plan 04-04 may add ROZ523 promotion.)
 *
 * For hoisted lets:
 *   - REMOVE the original `let X = init` from cloned Program top level
 *   - Synthesize HoistInstruction { name, initialExpr }
 *   - Rewrite ALL Identifier references to `X.current` MemberExpression
 *     (both reads and writes) anywhere in the cloned Program
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

export interface HoistInstruction {
  name: string;
  initialExpr: t.Expression;
}

export interface HoistResult {
  hoisted: HoistInstruction[];
  diagnostics: Diagnostic[];
}

/** Walk a function/arrow body and collect identifier references matching a name set. */
function collectIdentifierRefs(
  bodyNode: t.Node,
  candidateNames: ReadonlySet<string>,
): Set<string> {
  const found = new Set<string>();
  // The walker needs a Program-rooted path. BlockStatements lift directly
  // into the Program; everything else (Expressions / Arrows / FnExprs /
  // Identifiers) we wrap in an ExpressionStatement first.
  const programStmts: t.Statement[] = t.isBlockStatement(bodyNode)
    ? bodyNode.body
    : [t.expressionStatement(bodyNode as t.Expression)];
  traverse(t.file(t.program(programStmts)), {
    Identifier(path) {
      if (!candidateNames.has(path.node.name)) return;
      const parent = path.parent;
      // Skip property positions of MemberExpressions: `obj.X` — that X
      // is a property, not a real reference.
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      // Skip ObjectProperty key positions when not shorthand.
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.shorthand) {
        return;
      }
      // Skip declaration-id positions.
      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
      if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
      if (t.isFunction(parent) && parent.params.includes(path.node)) return;
      // Skip import/export specifier identifier slots.
      if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
      if (t.isExportSpecifier(parent)) return;
      if (t.isLabeledStatement(parent) && parent.label === path.node) return;
      found.add(path.node.name);
    },
  });
  return found;
}

/**
 * Auto-hoist module-scoped `let` declarations referenced from lifecycle setup
 * bodies. Mutates `program` in place.
 */
export function hoistModuleLet(program: File, ir: IRComponent): HoistResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Collect module-let candidates: top-level VariableDeclaration with kind === 'let'.
  type LetCandidate = {
    name: string;
    initialExpr: t.Expression;
    declStmt: t.VariableDeclaration;
    declIndex: number;
    declaratorIndex: number;
    sourceLoc: { start: number; end: number };
  };
  const moduleLets = new Map<string, LetCandidate>();
  program.program.body.forEach((stmt, idx) => {
    if (!t.isVariableDeclaration(stmt)) return;
    if (stmt.kind !== 'let') return;
    stmt.declarations.forEach((decl, declIdx) => {
      if (!t.isIdentifier(decl.id)) return;
      const init = decl.init ?? t.identifier('undefined');
      const start = stmt.loc?.start.index ?? 0;
      const end = stmt.loc?.end.index ?? 0;
      moduleLets.set(decl.id.name, {
        name: decl.id.name,
        initialExpr: init,
        declStmt: stmt,
        declIndex: idx,
        declaratorIndex: declIdx,
        sourceLoc: { start, end },
      });
    });
  });
  if (moduleLets.size === 0) return { hoisted: [], diagnostics };

  const moduleLetNames = new Set(moduleLets.keys());

  // 2. Build map: top-level helper name → set of module-let names it references.
  const topLevelHelpers = new Map<string, Set<string>>();
  for (const stmt of program.program.body) {
    let helperName: string | null = null;
    let body: t.Node | null = null;

    if (t.isVariableDeclaration(stmt)) {
      // Treat the FIRST declarator as the helper if its init is an arrow/fn-expr.
      for (const d of stmt.declarations) {
        if (
          t.isIdentifier(d.id) &&
          d.init &&
          (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
        ) {
          helperName = d.id.name;
          body = d.init;
          break;
        }
      }
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      helperName = stmt.id.name;
      body = stmt;
    }
    if (!helperName || !body) continue;

    const refs = collectIdentifierRefs(body, moduleLetNames);
    if (refs.size > 0) topLevelHelpers.set(helperName, refs);
  }

  // 3. Walk lifecycle hooks AND watchers → which lets are referenced via
  //     (a) / (a') / (b)? Watchers must participate because the common
  //     "round-trip guard" pattern (FullCalendar / Flatpickr / Leaflet)
  //     mutates a module-scoped let from the watcher and reads it from the
  //     mount-phase setup — both sides must agree on hoisting for the
  //     guard's value to persist across renders.
  const referencedLets = new Set<string>();
  for (const lh of ir.lifecycle) {
    classifyExpr(lh.setup);
    if (lh.cleanup) classifyExpr(lh.cleanup);
  }
  for (const wh of ir.watchers) {
    classifyExpr(wh.getter);
    classifyExpr(wh.callback);
  }

  function classifyExpr(expr: t.Expression | t.BlockStatement): void {
    // (a) DIRECT — arrow/fn expression body references a let.
    if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
      const refs = collectIdentifierRefs(expr, moduleLetNames);
      for (const r of refs) referencedLets.add(r);
      return;
    }
    // (a') DIRECT — BlockStatement body (post-`extractCleanupReturn` lift,
    // the IR's `lh.setup` is the cleanup-trimmed BlockStatement directly).
    // Without this branch any `let` referenced inside a `$onMount(() => {
    // ...; return cleanupFn })` arrow falls through to case (c) and stays
    // unhoisted — its bare-identifier references then re-bind on every
    // React render, breaking the let's "module-scoped scratch state"
    // semantics (e.g. FullCalendar's `let suppressViewSync = false`).
    if (t.isBlockStatement(expr)) {
      const refs = collectIdentifierRefs(expr, moduleLetNames);
      for (const r of refs) referencedLets.add(r);
      return;
    }
    // (b) ONE-LEVEL HELPER — Identifier referring to a top-level helper.
    if (t.isIdentifier(expr) && topLevelHelpers.has(expr.name)) {
      const refs = topLevelHelpers.get(expr.name)!;
      for (const r of refs) referencedLets.add(r);
      return;
    }
    // (c) Anything else — conservative no-hoist.
  }

  if (referencedLets.size === 0) return { hoisted: [], diagnostics };

  // 4. Hoist: synthesize HoistInstructions, remove the let declarations,
  //    emit ROZ522, and rewrite all references to `X.current`.
  const hoisted: HoistInstruction[] = [];
  const indicesToRemove = new Set<number>();
  for (const name of referencedLets) {
    const c = moduleLets.get(name);
    if (!c) continue;
    hoisted.push({ name: c.name, initialExpr: c.initialExpr });
    // Mark the entire VariableDeclaration for removal IF every declarator
    // in it is a hoist target (the common case is single-declarator). For
    // mixed declarations, splice the specific declarator out.
    if (c.declStmt.declarations.length === 1) {
      indicesToRemove.add(c.declIndex);
    } else {
      c.declStmt.declarations.splice(c.declaratorIndex, 1);
    }
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_MODULE_LET_AUTO_HOISTED,
      severity: 'info',
      message: `Module-scoped \`let ${name}\` referenced from a lifecycle hook was auto-hoisted to per-instance storage so each React instance keeps its own copy. Reads and writes to \`${name}\` are handled automatically — no action needed.`,
      loc: c.sourceLoc,
    });
  }

  // Remove single-declarator let statements by index (descending for safety).
  if (indicesToRemove.size > 0) {
    program.program.body = program.program.body.filter(
      (_, i) => !indicesToRemove.has(i),
    );
  }

  // 5. Walk again and rewrite all Identifier references to hoisted names
  //    into `name.current` MemberExpressions.
  const hoistedNames = new Set(hoisted.map((h) => h.name));
  // Identifiers we manufactured as the `.object` of a freshly-built
  // `name.current` MemberExpression — visiting these would double-rewrite
  // into `name.current.current`. Tracked via WeakSet keyed on node identity.
  const synthesizedIdentifiers = new WeakSet<t.Node>();
  if (hoistedNames.size > 0) {
    traverse(program, {
      Identifier(path) {
        if (synthesizedIdentifiers.has(path.node)) return;
        if (!hoistedNames.has(path.node.name)) return;
        const parent = path.parent;
        // Skip property positions.
        if (
          (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
          parent.property === path.node &&
          !parent.computed
        ) {
          return;
        }
        // ObjectProperty key positions:
        //   - non-shorthand `{ X: expr }` → the key is just a property name,
        //     not a reference; skip.
        //   - shorthand `{ X }` is BOTH key and value (same Identifier node).
        //     If the grandparent is an ObjectPattern (destructuring binding,
        //     e.g. `({ X }) => …` or `const { X } = obj`), this is a BINDING
        //     not a reference — skip. If the grandparent is an ObjectExpression
        //     (value position, e.g. `return { X }`), un-shorthand the property
        //     and rewrite the VALUE to `X.current`, leaving the key as `X`.
        if (t.isObjectProperty(parent) && parent.key === path.node) {
          if (!parent.shorthand) return;
          const grandparent = path.parentPath?.parent;
          if (t.isObjectPattern(grandparent)) return;
          // ObjectExpression value position: un-shorthand + rewrite value.
          // We mutate parent (replaceWith doesn't apply — the path is shared
          // between key and value in shorthand form, so replacing it would
          // also clobber the key). Mark the new object Identifier as
          // synthesized so the visitor skips it on its next descent —
          // otherwise it would re-rewrite into `name.current.current`.
          const synthObject = t.identifier(path.node.name);
          synthesizedIdentifiers.add(synthObject);
          parent.shorthand = false;
          parent.value = t.memberExpression(synthObject, t.identifier('current'));
          path.skip();
          return;
        }
        // Skip declaration-id positions.
        if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
        if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
        if (t.isFunction(parent) && parent.params.includes(path.node)) return;
        if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
        if (t.isExportSpecifier(parent)) return;
        if (t.isLabeledStatement(parent) && parent.label === path.node) return;
        // Skip identifiers nested ANYWHERE inside an ObjectPattern /
        // ArrayPattern (destructuring binding positions — function params,
        // `const { x } = …`, `[a, b] = …`). The shorthand-ObjectProperty
        // branch above catches the most common case directly; this guard
        // catches nested patterns (`{ x: { y } }`) and array-pattern
        // elements. AssignmentPattern default values (`{ x = expr }`) are
        // expressions, NOT bindings — those should still get rewritten,
        // so we stop the walk at AssignmentPattern.right.
        {
          let walker: typeof path.parentPath | null = path.parentPath;
          while (walker) {
            const node = walker.node;
            if (t.isObjectPattern(node) || t.isArrayPattern(node)) return;
            if (
              t.isAssignmentPattern(node) &&
              walker.parentPath?.node &&
              (t.isObjectProperty(walker.parentPath.node) ||
                t.isArrayPattern(walker.parentPath.node) ||
                t.isObjectPattern(walker.parentPath.node))
            ) {
              // We're inside an AssignmentPattern. If we descended via the
              // RIGHT (default value), it's an expression → keep rewriting.
              // If via the LEFT (the binding), skip.
              if (node.left === path.node || isAncestorVia(node, 'left', path.node)) {
                return;
              }
              break;
            }
            if (t.isFunction(node)) break;
            walker = walker.parentPath;
          }
        }

        // Lexical-scope shadowing: if a local binding (function param,
        // destructuring pattern, inner let/const) shadows the hoisted
        // name, the reference points at the LOCAL, not the (now-removed)
        // module-let. Skip the rewrite. After removing the module-let
        // declarations, the only remaining bindings for these names are
        // local — but Babel's scope cache is stale post-mutation, so we
        // do a manual ancestor walk looking for binding nodes that
        // introduce a local `name` shadow.
        if (hasShadowingBinding(path, path.node.name)) return;

        // Replace `X` → `X.current`.
        path.replaceWith(
          t.memberExpression(t.identifier(path.node.name), t.identifier('current')),
        );
        path.skip();
      },
    });
  }

  return { hoisted, diagnostics };
}

/**
 * Check whether `node` is reachable from `ancestor` exclusively via the
 * named property (e.g. an AssignmentPattern's `left` subtree). Used to
 * distinguish "this identifier is the binding side of `{ x = default }`"
 * from "this identifier is in the default expression side."
 */
function isAncestorVia(ancestor: t.Node, key: 'left' | 'right', target: t.Node): boolean {
  const seed = (ancestor as unknown as Record<string, unknown>)[key];
  if (!seed) return false;
  let found = false;
  function walk(n: t.Node | null | undefined): void {
    if (!n || found) return;
    if (n === target) { found = true; return; }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
      const v = (n as unknown as Record<string, unknown>)[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object' && 'type' in item) walk(item as t.Node);
        }
      } else if (v && typeof v === 'object' && 'type' in v) {
        walk(v as t.Node);
      }
    }
  }
  walk(seed as t.Node);
  return found;
}

/**
 * Returns true if `name` is bound by a local declaration that lexically
 * encloses `path`. Walks ancestors looking for function parameters
 * (including destructuring patterns) and inner `let`/`const`/`var`
 * declarations that introduce a shadowing binding.
 *
 * We do NOT rely on Babel's `path.scope.getBinding` here because the
 * scope cache is stale after the module-let declarations have been
 * spliced out of the Program body (step 4 above mutates the AST
 * without crawling). Manual ancestor inspection avoids the staleness.
 */
function hasShadowingBinding(path: { parentPath: ParentPathLike | null }, name: string): boolean {
  for (let walker: ParentPathLike | null = path.parentPath; walker; walker = walker.parentPath) {
    const node = walker.node;
    // Function boundary: check parameters (including destructured ones).
    if (t.isFunction(node)) {
      for (const param of node.params) {
        if (patternIntroducesBinding(param, name)) return true;
      }
      // Don't stop here — keep walking outer scopes.
    }
    // Block-scoped declarations inside the same scope.
    if (t.isBlockStatement(node) || t.isProgram(node)) {
      for (const stmt of node.body) {
        if (!t.isVariableDeclaration(stmt)) continue;
        for (const decl of stmt.declarations) {
          if (patternIntroducesBinding(decl.id, name)) return true;
        }
      }
    }
  }
  return false;
}

type ParentPathLike = {
  node: t.Node;
  parentPath: ParentPathLike | null;
};

/**
 * Returns true if a binding-pattern node (Identifier in simple cases,
 * ObjectPattern / ArrayPattern / AssignmentPattern / RestElement for
 * destructured forms) introduces a binding for `name`.
 */
function patternIntroducesBinding(pattern: t.Node, name: string): boolean {
  if (t.isIdentifier(pattern)) return pattern.name === name;
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (patternIntroducesBinding(prop.value as t.Node, name)) return true;
      } else if (t.isRestElement(prop)) {
        if (patternIntroducesBinding(prop.argument, name)) return true;
      }
    }
    return false;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el && patternIntroducesBinding(el, name)) return true;
    }
    return false;
  }
  if (t.isAssignmentPattern(pattern)) {
    return patternIntroducesBinding(pattern.left, name);
  }
  if (t.isRestElement(pattern)) {
    return patternIntroducesBinding(pattern.argument, name);
  }
  return false;
}
