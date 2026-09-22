/**
 * Quick 260922-hk4 (N-04) — setup-once `$props` / `$model` read validator
 * (ROZ150, warning).
 *
 * A top-level `<script>` statement runs ONCE, at setup. Where that "once"
 * lands differs per target (measured 2026-09-22 against the built compiler):
 *
 *   - Vue / React / Svelte / Solid: setup runs with the consumer's bound props
 *     already present — a setup-once read sees the bound value. Correct.
 *   - Angular: setup-once STATEMENTS go into the constructor and top-level
 *     DECLARATIONS become class fields. Both run during construction, and
 *     Angular sets inputs AFTER construction, so `input()` / `model()` still
 *     return their DEFAULT.
 *   - Lit: setup-once statements go into `firstUpdated()` (correct), but a
 *     top-level DECLARATION initializer (`const snap = $props.x`) becomes a
 *     class field, evaluated during construction before Lit applies
 *     consumer-bound properties — the same default-read as Angular.
 *
 * The real-world instance: EditorDate opened EMPTY on Angular for every row
 * while Vue and Lit seeded correctly (data-table, fixed at source in
 * 52d279314 by converting all seven setup-once seeds to derived reads).
 *
 * Scope fence — this diagnostic is about CROSS-TARGET PARITY, not validity. A
 * setup-once read is correct on Vue, React, Svelte and Solid; an author who
 * only targets those has done nothing wrong, which is why this is a warning
 * (advisory; every compile gate filters on severity === 'error') and why the
 * owner chose a diagnostic over a codegen change (moving setup-once code to
 * ngOnInit would change WHEN every setup-once statement runs on Angular,
 * library-wide, for a pattern the shipped corpus does not use).
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   - a non-computed `$props.<x>` / `$model.<x>` READ in `<script>` with NO
 *     enclosing function (Program top level, including inside a top-level
 *     `if` / `for` / block, and inside a top-level declaration initializer).
 *   Deduplicated per (top-level statement, sigil.member); reported at the
 *   first read.
 *
 * ── DO-NOT-FLAG ──────────────────────────────────────────────────────────────
 *   - any read inside a function: arrow, function expression/declaration,
 *     object or class method, and therefore every `$onMount` / `$onUnmount` /
 *     `$onUpdate` / `$watch` / `$computed` callback — `path.getFunctionParent()
 *     !== null` covers all of them (same discriminator as ROZ149);
 *   - reads inside a class body (a class-field initializer is not setup code);
 *   - the TARGET of a write (`$props.x = …`, `$props.x++`) — write validators
 *     (ROZ200 / ROZ203) own writes;
 *   - computed access `$props['x']` — ROZ106's concern;
 *   - `<template>` bindings/interpolations and `<listeners>` handlers — they
 *     are live reads, never walked here.
 *
 * Script nodes carry absolute .rozie byte offsets (base offset 0, as ROZ149).
 * Per D-08 collected-not-thrown: NEVER throws. No bindings dependency.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

// Default-export interop: see refsPreMountValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

const PROP_SIGILS = new Set(['$props', '$model']);

/** `$props.<x>` / `$model.<x>` static read → `{ sigil, member }`, else null. */
function propMember(node: t.MemberExpression): { sigil: string; member: string } | null {
  if (node.computed) return null;
  if (!t.isIdentifier(node.object) || !PROP_SIGILS.has(node.object.name)) return null;
  if (!t.isIdentifier(node.property)) return null;
  return { sigil: node.object.name, member: node.property.name };
}

/** True when `path` is the target of a write (`= / op=` LHS, or `++`/`--` operand). */
function isWriteTarget(path: NodePath<t.MemberExpression>): boolean {
  const parent = path.parent;
  if (t.isAssignmentExpression(parent) && parent.left === path.node) return true;
  if (t.isUpdateExpression(parent) && parent.argument === path.node) return true;
  return false;
}

/** True when the read sits inside the `init` of a Program-level variable declaration. */
function inTopLevelDeclarationInit(path: NodePath<t.MemberExpression>): boolean {
  let child: NodePath = path;
  let cur: NodePath | null = path.parentPath;
  while (cur) {
    if (cur.isVariableDeclarator()) {
      return child.key === 'init' && cur.parentPath?.parentPath?.isProgram() === true;
    }
    if (cur.isProgram()) return false;
    child = cur;
    cur = cur.parentPath;
  }
  return false;
}

/** The Program-level statement that encloses `path`. */
function topLevelStatement(path: NodePath): t.Node | null {
  const stmt = path.findParent((p) => p.parentPath?.isProgram() === true);
  return stmt ? stmt.node : null;
}

function buildMessage(sigil: string, member: string, lit: boolean): string {
  const read = `${sigil}.${member}`;
  const litClause = lit
    ? ' On Lit a top-level declaration initializer becomes a class field, evaluated at the same point.'
    : '';
  return (
    `Setup-once code reads \`${read}\`. On Angular this runs in the constructor, where the input still returns its default — the value the consumer bound is not available yet.${litClause}` +
    ` Read it through a derived function instead (\`const ${member}Value = () => ${read}\`), which is correct on all six targets with no flash on the fine-grained ones.`
  );
}

const HINT =
  "Reference implementation: FilterSelect.rozie's `selectValue()` in @rozie-ui/data-table. When the value is also locally editable, keep a local draft plus a `touched` latch so the live read does not overwrite the user mid-edit (the data-table editor drop-ins' `draftValue()` shape). Code only ever compiled for Vue/React/Svelte/Solid may ignore this warning.";

/**
 * Run the setup-once prop-read validator. Emits ROZ150 (warning) into
 * `diagnostics`. NEVER throws (D-08).
 */
export function runSetupOncePropReadValidator(ast: RozieAST, diagnostics: Diagnostic[]): void {
  try {
    if (!ast.script) return;
    const seen = new Set<string>();
    const stmtIds = new Map<t.Node, number>();
    traverse(ast.script.program, {
      MemberExpression(path: NodePath<t.MemberExpression>) {
        const hit = propMember(path.node);
        if (hit === null) return;
        if (path.getFunctionParent() !== null) return; // deferred by an enclosing function.
        if (path.findParent((p) => p.isClassBody()) !== null) return; // class-field initializer.
        if (isWriteTarget(path)) return; // writes are ROZ200/ROZ203's concern.
        const stmt = topLevelStatement(path);
        if (stmt === null) return;
        let id = stmtIds.get(stmt);
        if (id === undefined) {
          id = stmtIds.size;
          stmtIds.set(stmt, id);
        }
        const key = `${id}:${hit.sigil}.${hit.member}`;
        if (seen.has(key)) return;
        seen.add(key);
        diagnostics.push({
          code: RozieErrorCode.SETUP_ONCE_PROP_READ,
          severity: 'warning',
          message: buildMessage(hit.sigil, hit.member, inTopLevelDeclarationInit(path)),
          loc: { start: path.node.start ?? 0, end: path.node.end ?? 0 },
          hint: HINT,
        });
      },
    });
  } catch {
    // D-08: collected-not-thrown — a validator crash must never fail a compile.
  }
}
