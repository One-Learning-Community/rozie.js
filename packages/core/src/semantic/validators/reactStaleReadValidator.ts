/**
 * Phase 46 (ITEM-4, D-03b/A3) — React stale-read validator (ROZ138).
 * Narrowed by quick task 260829-8w1 with two sound control-flow suppressions —
 * see `.planning/notes/roz138-triage.md` for the corpus census that motivated
 * this and the per-site derivation of both shapes below.
 *
 * On React, a write to reactive state lowers to an ASYNC `setState`. So within a
 * single SYNCHRONOUS function body, a read of the same reactive key AFTER the
 * write binds the PRE-write value — the closure captured the old value, the
 * setter hasn't flushed yet. The listbox combobox `onInput` is the canonical
 * footgun:
 *
 *   function onInput(e) {
 *     $data.query = e.target.value     // async setState on React
 *     fireSearch($data.query)          // reads the PRE-write query on React ONLY
 *   }
 *
 * The other five targets assign reactively/synchronously (`ref.value = …`,
 * `$state` rune, `signal.set`), so the same author source works there — a
 * target-asymmetric React trap. ROZ138 (warning) fires on the dominated read,
 * steering the author to capture the fresh local
 * (`const q = e.target.value; … fireSearch(q)`).
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   Within ONE <script> function body (FunctionDeclaration / FunctionExpression /
 *   ArrowFunctionExpression with a block body), in SOURCE ORDER:
 *     - a WRITE to `$data.x` / `$model.x` / `$props.x` (assignment LHS is a
 *       static member rooted at the accessor), followed by
 *     - a READ of the SAME key later in the same body, UNLESS every candidate
 *       write to that key is proven unreachable-before-the-read by one of the
 *       two narrowings below.
 *   `$model.x` (write) and `$props.x` (read) address the SAME reactive cell — a
 *   write via `$model.foo` followed by a read of `$props.foo` is flagged.
 *
 * ── DO-NOT-FLAG (the conservative false-positive cases, A3) ───────────────────
 *   - a read with NO preceding write to that key in the same body;
 *   - a write and a read of DIFFERENT keys;
 *   - reads / writes in SEPARATE function bodies (per-body scan only — no
 *     interprocedural / control-flow analysis);
 *   - a read that is textually BEFORE the write (not dominated);
 *   - <listeners> handler bodies — intentionally NOT walked (A2 conservative
 *     default, mirroring refsPreMountValidator).
 *
 * ── CONTROL-FLOW NARROWINGS (260829-8w1, R1-R4) ───────────────────────────────
 * Suppression is decided PER (write, read) PAIR, not per cell: a read is
 * flagged only if AT LEAST ONE candidate write (any write to the same key whose
 * assignment ends at or before the read) survives BOTH narrowings below. This
 * keeps the "flag unless proven unreachable" conservative posture — narrowing
 * only ever REMOVES flags, never adds one a plain textual scan would have
 * missed.
 *
 *   (A) Abrupt-completion. Ask: after the write executes, must control leave
 *       the FUNCTION before reaching the read? Walk up from the write toward
 *       the lowest common ancestor (LCA) of write and read. At each level
 *       BELOW the LCA, take the statement list containing the current node (a
 *       `BlockStatement.body` or a `SwitchCase.consequent`) and check whether
 *       any statement AFTER the current node in that list completes abruptly
 *       (`completesAbruptly`, below). If so, control can never fall out of
 *       that list, so the read is unreachable on this write's path — suppress.
 *       Never check the LCA's own statement list (that's where the read
 *       lives). `completesAbruptly` counts only `return`/`throw` (directly, or
 *       via a BlockStatement containing one, or via an `if/else` where BOTH
 *       arms complete abruptly) — deliberately NOT `break`/`continue`, which
 *       exit only the nearest loop/switch, not the function:
 *       `for (…) { if (c) { $data.x = 1; continue } use($data.x) }` is a REAL
 *       cross-iteration stale read that treating `continue` as abrupt would
 *       silently unflag. This restriction is strictly the safe direction (it
 *       can only suppress LESS, never more).
 *   (B) Branch exclusivity. If the LCA of write and read is an `IfStatement`
 *       with one under `.consequent` and the other under `.alternate`, they
 *       cannot both execute on the same call — suppress. `else if` chains fall
 *       out for free (the nested `IfStatement` lives in `.alternate`).
 *       Deliberately NOT extended to `SwitchCase` (fallthrough means a write
 *       in one arm CAN reach a read in a later arm — the non-fallthrough case
 *       is already covered by (A) via its `return`/`break`) or to
 *       `ConditionalExpression` (`c ? a : b`).
 *
 * REJECTED alternative — "require the write's enclosing block to contain the
 * read": also drives this corpus to zero, but it would silently stop flagging
 * the genuine `if (cond) $data.x = 1; use($data.x)` shape (a write in a
 * non-abrupt `if` with no `else`, read after it) — trading the false-positive
 * problem for an undetectable false-negative one. NOT implemented. The two
 * positive-control unit tests below exist specifically to catch a regression
 * toward this shortcut.
 *
 * This is a deliberately CONSERVATIVE same-body syntactic scan (A3): still no
 * general CFG — no loop-iteration reasoning, no cross-function / async-window
 * reasoning (that gap is real but premature; see the triage doc's §6/§7 — the
 * ancestor-walk + abrupt-completion helpers here are exactly the substrate
 * that future checker will need for its intraprocedural half, but no
 * cross-function machinery or new diagnostic code was added). It can still
 * miss a real stale-read that crosses a loop iteration boundary, and a warning
 * is non-blocking and never mutates emit, so the locked decision (D-03b warn)
 * accepts the residual imprecision. Severity is `warning`.
 *
 * The validator NEVER throws (D-08) and never mutates the AST. No bindings
 * dependency (mirrors ROZ135).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import { detectMagicAccess } from '../visitors.js';

// Default-export interop: see refsPreMountValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

interface ValidatorContext {
  diagnostics: Diagnostic[];
}

/** `<script>` nodes carry absolute .rozie offsets — baseOffset 0. */
function locFromNode(node: t.Node): SourceLoc {
  return locFromBabel(node);
}

/**
 * Normalize a magic-access scope+member into a single reactive-CELL key.
 *
 * `$data.x` is its own cell (`data:x`). `$model.x` (write) and `$props.x` (read)
 * address the SAME reactive cell — a model prop — so both normalize to the same
 * `prop:x` key. A non-model `$props.x` read can never be paired with a write
 * (you cannot write a non-model prop — ROZ200), so collapsing props+model is
 * sound and conservative.
 */
function cellKey(scope: string, member: string): string | null {
  if (scope === 'data') return `data:${member}`;
  if (scope === 'model' || scope === 'props') return `prop:${member}`;
  return null; // refs / slots — not a setState-backed reactive write target.
}

/**
 * If `node` is a static member rooted at a reactive accessor ($data/$model/
 * $props), return its cell key; else null.
 */
function reactiveCellKey(node: t.Node): string | null {
  const access = detectMagicAccess(node);
  if (!access) return null;
  return cellKey(access.scope, access.member);
}

/**
 * (A) helper — does `stmt` complete abruptly (i.e. control can never fall out
 * the bottom of it)? Only `return`/`throw` count (R3 — NOT `break`/`continue`,
 * which exit only the nearest loop/switch, not the function). A `BlockStatement`
 * completes abruptly if ANY statement in its body does (an early `return`
 * followed by dead code still means the block never falls through). An
 * `IfStatement` completes abruptly only if it has an `alternate` AND BOTH arms
 * complete abruptly — an `if` with no `else`, or an `if/else` where only one
 * arm returns, can still fall through. Everything else (`SwitchStatement`,
 * loops, `TryStatement`, labelled statements, and — implicitly, since this is
 * never called on one — nested function declarations) is NOT abrupt: this
 * helper is only ever invoked on statements within the CURRENT function's own
 * body, so it never needs to special-case descending into a nested function.
 */
function completesAbruptly(stmt: t.Statement): boolean {
  if (t.isReturnStatement(stmt) || t.isThrowStatement(stmt)) return true;
  if (t.isBlockStatement(stmt)) return stmt.body.some((s) => completesAbruptly(s));
  if (t.isIfStatement(stmt)) {
    if (!stmt.alternate) return false;
    return completesAbruptly(stmt.consequent) && completesAbruptly(stmt.alternate);
  }
  return false;
}

/**
 * Per-(write, read) suppression decision (R1-R4). Returns true when this
 * specific write is PROVABLY unreachable before this specific read — i.e. the
 * read must be suppressed with respect to this write (a DIFFERENT candidate
 * write to the same cell might still dominate; see the caller).
 *
 * Both paths are scanned within the SAME function body (the caller only ever
 * pairs writes/reads collected from one `fnPath.traverse`), so a common
 * ancestor is guaranteed to exist.
 */
function isWriteUnreachableBeforeRead(
  writePath: NodePath<t.AssignmentExpression>,
  readPath: NodePath<t.MemberExpression>,
): boolean {
  const writeAncestry = writePath.getAncestry();
  const readAncestry = readPath.getAncestry();
  const readNodes = new Set(readAncestry.map((p) => p.node));

  let lcaWriteIndex = -1;
  for (let i = 0; i < writeAncestry.length; i++) {
    if (readNodes.has(writeAncestry[i]!.node)) {
      lcaWriteIndex = i;
      break;
    }
  }
  if (lcaWriteIndex <= 0) return false; // no shared ancestor found (defensive — should not happen).
  const lcaNode = writeAncestry[lcaWriteIndex]!.node;

  // (A) Abrupt-completion — walk from the write up toward (but never
  // inspecting) the LCA's own statement list.
  for (let i = 0; i < lcaWriteIndex; i++) {
    const node = writeAncestry[i]!.node;
    const parent = writeAncestry[i + 1]!.node;
    if (parent === lcaNode) break; // the LCA's own list holds the read — never inspect it.
    let list: t.Statement[] | null = null;
    if (t.isBlockStatement(parent)) list = parent.body;
    else if (t.isSwitchCase(parent)) list = parent.consequent;
    if (list === null) continue; // e.g. parent is an IfStatement's .consequent/.alternate slot — no sibling list here.
    const idx = list.indexOf(node as t.Statement);
    if (idx === -1) continue;
    for (let j = idx + 1; j < list.length; j++) {
      if (completesAbruptly(list[j]!)) return true;
    }
  }

  // (B) Branch exclusivity — LCA is an IfStatement, write and read sit under
  // opposite arms.
  if (t.isIfStatement(lcaNode) && lcaNode.alternate) {
    const writeChild = writeAncestry[lcaWriteIndex - 1]?.node;
    let lcaReadIndex = -1;
    for (let i = 0; i < readAncestry.length; i++) {
      if (readAncestry[i]!.node === lcaNode) {
        lcaReadIndex = i;
        break;
      }
    }
    const readChild = lcaReadIndex > 0 ? readAncestry[lcaReadIndex - 1]?.node : undefined;
    if (writeChild && readChild) {
      const writeInConsequent = writeChild === lcaNode.consequent;
      const writeInAlternate = writeChild === lcaNode.alternate;
      const readInConsequent = readChild === lcaNode.consequent;
      const readInAlternate = readChild === lcaNode.alternate;
      if ((writeInConsequent && readInAlternate) || (writeInAlternate && readInConsequent)) {
        return true;
      }
    }
  }

  return false;
}

/** Emit ROZ138 (warning) for a dominated read at `loc`. */
function pushStaleRead(
  ctx: ValidatorContext,
  member: string,
  loc: SourceLoc,
): void {
  ctx.diagnostics.push({
    code: RozieErrorCode.REACT_STALE_READ,
    severity: 'warning',
    message: `Reading '${member}' after writing it in the same function body binds the PRE-write value on React (setState is async) — the other five targets read the updated value, so this is a target-asymmetric stale read.`,
    loc,
    hint: `Capture the value in a local before the write and read the local instead, e.g. \`const next = …; <accessor>.${member} = next; use(next)\`.`,
  });
}

/**
 * Walk the `<script>` program. For each function (declaration / expression /
 * arrow with a block body) at any depth, run an independent per-body
 * write-before-read scan. We use a single traverse with a `Function` visitor;
 * inside each function we do a SECOND scoped traverse over that function's body,
 * skipping nested functions so each body is scanned exactly once in isolation.
 */
function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  traverse(script.program, {
    Function(fnPath) {
      const body = fnPath.node.body;
      // Only block-bodied functions have statement sequencing to reason about;
      // an expression-bodied arrow (`() => $data.x`) cannot write-then-read.
      if (!t.isBlockStatement(body)) return;

      // Per-body state: cellKey → the list of every write to that cell (path +
      // assignment-end offset — R1). Suppression is decided PER (write, read)
      // PAIR, not per cell, so pass 1 must keep every candidate write, not just
      // the earliest. Track member nodes that are an assignment LHS so the read
      // pass excludes the write target itself.
      const writes = new Map<string, Array<{ path: NodePath<t.AssignmentExpression>; endOffset: number }>>();
      const assignmentTargets = new WeakSet<t.Node>();

      // Traverse THIS function's body within the existing tree (NodePath.traverse
      // — no node re-parenting). Skip nested functions so each body is scanned in
      // isolation: a nested callback runs later (post-write-flush) and is itself
      // a separate scope the outer Function visitor will reach independently.
      // First pass — collect writes (LHS member nodes + write offsets).
      //
      // The write's "established" offset is the END of the whole assignment
      // expression, NOT the LHS start: a read inside the SAME assignment's RHS
      // (`$model.open = !$props.open`) evaluates BEFORE the write commits — JS
      // evaluates the RHS first — so it is NOT a stale read. Keying the write at
      // the assignment END excludes any read textually inside that statement,
      // while still flagging a read in a LATER statement of the body.
      fnPath.traverse({
        Function(innerPath) {
          innerPath.skip();
        },
        AssignmentExpression(asgn) {
          const left = asgn.node.left;
          const key = reactiveCellKey(left);
          if (key === null) return;
          assignmentTargets.add(left);
          const off = asgn.node.end ?? left.end ?? 0;
          const entry = { path: asgn, endOffset: off };
          const list = writes.get(key);
          if (list) list.push(entry);
          else writes.set(key, [entry]);
        },
      });

      if (writes.size === 0) return; // no reactive writes in this body.

      // Second pass — flag reactive-member READS dominated by (textually after)
      // AT LEAST ONE candidate write to the same cell that is not itself an
      // assignment target and survives neither control-flow narrowing (R1).
      fnPath.traverse({
        Function(innerPath) {
          innerPath.skip();
        },
        MemberExpression(memPath) {
          const node = memPath.node;
          if (assignmentTargets.has(node)) return; // this IS a write target.
          const key = reactiveCellKey(node);
          if (key === null) return;
          const candidates = writes.get(key);
          if (candidates === undefined) return; // never written in this body.
          const readOff = node.start ?? 0;
          let dominatedBySurvivingWrite = false;
          for (const candidate of candidates) {
            // Dominated = the read STARTS after the write's assignment fully
            // ends. A read inside the write's own RHS (evaluated first) starts
            // before the assignment end → not a candidate (the
            // `$model.x = !$props.x` case).
            if (readOff < candidate.endOffset) continue;
            if (isWriteUnreachableBeforeRead(candidate.path, memPath)) continue;
            dominatedBySurvivingWrite = true;
            break;
          }
          if (!dominatedBySurvivingWrite) return;
          const access = detectMagicAccess(node);
          const member = access ? access.member : key;
          pushStaleRead(ctx, member, locFromNode(node));
        },
      });
    },
  });
}

/**
 * Run the React stale-read validator over the given AST. Emits ROZ138 (warning)
 * into `diagnostics`. NEVER throws (D-08). No bindings dependency.
 *
 * Note: <listeners> is intentionally NOT walked (A2 conservative default,
 * mirroring refsPreMountValidator).
 */
export function runReactStaleReadValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { diagnostics };
  if (!ast.script) return;
  try {
    validateScript(ast.script, ctx);
  } catch {
    // @babel/traverse scope-binding can throw on malformed input (the parser
    // layer already diagnosed it). Keep whatever was collected — never propagate
    // (D-08).
  }
}
