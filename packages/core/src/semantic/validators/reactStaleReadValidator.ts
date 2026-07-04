/**
 * Phase 46 (ITEM-4, D-03b/A3) — React stale-read validator (ROZ138).
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
 *     - a READ of the SAME key later in the same body.
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
 * This is a deliberately CONSERVATIVE same-body syntactic scan (A3): no CFG, no
 * branch/loop reasoning. It can miss a real stale-read that crosses a branch, and
 * could in theory flag a write+read that a `return`/branch makes unreachable —
 * but a warning is non-blocking and never mutates emit, so the locked decision
 * (D-03b warn) accepts the residual imprecision. Severity is `warning`.
 *
 * The validator NEVER throws (D-08) and never mutates the AST. No bindings
 * dependency (mirrors ROZ135).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
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

      // Per-body state: cellKey → byte offset of the FIRST write. Track member
      // nodes that are an assignment LHS so the read pass excludes the write
      // target itself.
      const writtenAt = new Map<string, number>();
      const assignmentTargets = new WeakSet<t.Node>();

      // Traverse THIS function's body within the existing tree (NodePath.traverse
      // — no node re-parenting). Skip nested functions so each body is scanned in
      // isolation: a nested callback runs later (post-write-flush) and is itself
      // a separate scope the outer Function visitor will reach independently.
      // First pass — collect writes (LHS member nodes + first-write offsets).
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
          // Keep the EARLIEST write-completion offset per cell (a later write
          // would only push the domination boundary further right).
          const prev = writtenAt.get(key);
          if (prev === undefined || off < prev) writtenAt.set(key, off);
        },
      });

      if (writtenAt.size === 0) return; // no reactive writes in this body.

      // Second pass — flag reactive-member READS dominated by a write to the
      // same cell (textually after it) and not themselves an assignment target.
      fnPath.traverse({
        Function(innerPath) {
          innerPath.skip();
        },
        MemberExpression(memPath) {
          const node = memPath.node;
          if (assignmentTargets.has(node)) return; // this IS a write target.
          const key = reactiveCellKey(node);
          if (key === null) return;
          const writeOff = writtenAt.get(key);
          if (writeOff === undefined) return; // never written in this body.
          const readOff = node.start ?? 0;
          // Dominated = the read STARTS after the write's assignment fully ends.
          // A read inside the write's own RHS (evaluated first) starts before the
          // assignment end → not flagged (the `$model.x = !$props.x` case).
          if (readOff < writeOff) return;
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
