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
  traverse(t.file(t.program([t.expressionStatement(bodyNode as t.Expression)])), {
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

  // 3. Walk lifecycle hooks → which lets are referenced via (a) or (b)?
  const referencedLets = new Set<string>();
  for (const lh of ir.lifecycle) {
    classifyExpr(lh.setup);
    if (lh.cleanup) classifyExpr(lh.cleanup);
  }

  function classifyExpr(expr: t.Expression | t.BlockStatement): void {
    // (a) DIRECT — arrow/fn expression body references a let.
    if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
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
      severity: 'warning',
      message: `Module-scoped \`let ${name}\` referenced from a lifecycle hook auto-hoisted to \`useRef\` (\`${name}.current\`). Reads and writes are rewritten to \`${name}.current\`. To suppress this advisory, refactor to a useRef declaration in your script.`,
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
  if (hoistedNames.size > 0) {
    traverse(program, {
      Identifier(path) {
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
        // Skip ObjectProperty key positions.
        if (t.isObjectProperty(parent) && parent.key === path.node && !parent.shorthand) {
          return;
        }
        // Skip declaration-id positions.
        if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
        if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
        if (t.isFunction(parent) && parent.params.includes(path.node)) return;
        if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
        if (t.isExportSpecifier(parent)) return;
        if (t.isLabeledStatement(parent) && parent.label === path.node) return;

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
