/**
 * findRForLoopVarShadows — pure detector for the TWO RUNTIME-ONLY Svelte loop
 * shadow classes that `findRForSlotNameCollisions` does NOT cover
 * (collision-svelte §3 risks 1 + 2). Both crash at runtime with NO compile
 * signal: svelte-check passes, tsdown/oxc dts does NOT body-typecheck, and the
 * `@rozie-ui` svelte leaves ship raw source with no body-typecheck gate.
 *
 * RISK 2 — loop-var == script HELPER (`loopVarHelperShadows`):
 *
 *   <script>const toggle = (x) => …</script>
 *   <li r-for="toggle in items">{{ toggle(toggle) }}</li>
 *
 *   Svelte lowers this to `{#each items as toggle}…{toggle(toggle)}…{/each}`.
 *   Inside the loop the bare `toggle` resolves to the loop ITEM (a non-function),
 *   so the helper CALL `toggle(...)` invokes the item → "toggle is not a
 *   function". The fix RENAMES THE LOOP VAR (→ `toggle$loop`) at the `{#each}`
 *   decl / key / loop-item reads, while the helper CALL-callee stays bare
 *   (`toggle(…)` now resolves to the un-shadowed helper). The detector returns
 *   the set of loop-var names that (a) equal a top-level `<script>` binding AND
 *   (b) appear as a CALL CALLEE inside that loop's body.
 *
 * RISK 1 — slot-PARAM shadow (`slotParamShadows`):
 *
 *   <li r-for="node in rows">
 *     <Row><template #body="{ node }">{{ node.label }}</template></Row>
 *   </li>
 *
 *   The consumer slot-fill param `node` shadows the enclosing `{#each rows as
 *   node}` loop var. `findRForSlotNameCollisions` handles the producer-slot-NAME
 *   variant but NOT this consumer slot-PARAM variant. The fix RENAMES THE SNIPPET
 *   PARAM (→ `node$$slot`) + its filler-body reads, leaving the loop var intact.
 *   The detector returns the set of `(loopVar)` names that a slot-filler param
 *   shadows; the emit-side applies the per-filler rename when a filler param is
 *   in an enclosing loop's variable set.
 *
 * SCOPE-PRECISE + PURE: a name is returned ONLY for a genuine in-loop shadow.
 * Case-sensitive. NEVER throws; NEVER mutates `ir`. The detector is the
 * single source of truth the Svelte emitter consults to decide which loop vars
 * to rename — mirroring the `findRForSlotNameCollisions` precedent.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { Expression } from '@babel/types';
import type {
  IRComponent,
  TemplateLoopIR,
  TemplateNode,
} from './types.js';

/**
 * Collect the names of top-level `<script>` bindings (consts, lets, function
 * declarations) — the candidate HELPER names a loop var can shadow. Computed
 * names (`const X = $computed(...)`) are bindings too and are included; the
 * caller's collision is still a real loop-var shadow.
 */
export function collectTopLevelScriptBindings(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const program = ir.setupBody?.scriptProgram;
  if (!program) return names;
  for (const stmt of program.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id)) names.add(decl.id.name);
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

/** Does `expr` contain a CallExpression whose callee is the identifier `name`? */
function exprCallsIdentifier(expr: Expression, name: string): boolean {
  let found = false;
  const visit = (node: t.Node | null | undefined): void => {
    if (found || node === null || node === undefined) return;
    if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
      const callee = node.callee;
      if (t.isIdentifier(callee) && callee.name === name) {
        found = true;
        return;
      }
    }
    // Shallow recursive walk over child nodes. We avoid @babel/traverse here so
    // the detector stays a cheap pure function with no scope-binding setup.
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) visit(c as t.Node);
      } else if (child && typeof (child as t.Node).type === 'string') {
        visit(child as t.Node);
      }
    }
  };
  visit(expr as unknown as t.Node);
  return found;
}

/** Recursively gather every Expression appearing in a template subtree. */
function collectBodyExpressions(node: TemplateNode, out: Expression[]): void {
  switch (node.type) {
    case 'TemplateLoop': {
      out.push(node.iterableExpression);
      if (node.keyExpression) out.push(node.keyExpression);
      for (const child of node.body) collectBodyExpressions(child, out);
      break;
    }
    case 'TemplateElement': {
      for (const attr of node.attributes) {
        if (attr.kind === 'binding' && attr.expression) out.push(attr.expression);
      }
      for (const ev of node.events ?? []) out.push(ev.handler);
      for (const child of node.children) collectBodyExpressions(child, out);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) collectBodyExpressions(child, out);
        }
      }
      break;
    }
    case 'TemplateInterpolation':
      out.push(node.expression);
      break;
    case 'TemplateConditional':
      for (const branch of node.branches) {
        if (branch.test) out.push(branch.test);
        for (const child of branch.body) collectBodyExpressions(child, out);
      }
      break;
    case 'TemplateMatch':
      out.push(node.discriminant);
      for (const branch of node.branches) {
        for (const child of branch.body) collectBodyExpressions(child, out);
      }
      if (node.hostElement) collectBodyExpressions(node.hostElement, out);
      break;
    case 'TemplateFragment':
      for (const child of node.children) collectBodyExpressions(child, out);
      break;
    case 'TemplateSlotInvocation':
      for (const arg of node.args) out.push(arg.expression);
      for (const child of node.fallback) collectBodyExpressions(child, out);
      break;
    default:
      break;
  }
}

export interface RForLoopVarShadows {
  /**
   * Loop-var names that shadow a top-level `<script>` helper which is CALLED
   * inside the loop (risk 2). The Svelte emitter renames the LOOP VAR for these.
   */
  loopVarHelperShadows: Set<string>;
  /**
   * Loop-var names a consumer slot-filler PARAM shadows inside the loop (risk 1).
   * The Svelte emitter renames the SNIPPET PARAM (`X$$slot`) for these.
   */
  slotParamShadows: Set<string>;
}

/**
 * Walk the template, tracking enclosing `r-for` loops, and detect the two
 * runtime-only shadow classes.
 */
export function findRForLoopVarShadows(ir: IRComponent): RForLoopVarShadows {
  const loopVarHelperShadows = new Set<string>();
  const slotParamShadows = new Set<string>();
  const result: RForLoopVarShadows = { loopVarHelperShadows, slotParamShadows };
  if (ir.template === null) return result;

  const helperNames = collectTopLevelScriptBindings(ir);

  const enclosingVars = (loops: TemplateLoopIR[]): Set<string> => {
    const s = new Set<string>();
    for (const l of loops) {
      s.add(l.itemAlias);
      if (l.indexAlias) s.add(l.indexAlias);
    }
    return s;
  };

  const walk = (node: TemplateNode, loops: TemplateLoopIR[]): void => {
    switch (node.type) {
      case 'TemplateLoop': {
        const next = loops.concat(node);
        // Risk 2: loop var == helper called inside THIS loop's body.
        for (const alias of [node.itemAlias, node.indexAlias]) {
          if (!alias) continue;
          if (!helperNames.has(alias)) continue;
          const exprs: Expression[] = [];
          for (const child of node.body) collectBodyExpressions(child, exprs);
          if (exprs.some((e) => exprCallsIdentifier(e, alias))) {
            loopVarHelperShadows.add(alias);
          }
        }
        for (const child of node.body) walk(child, next);
        break;
      }
      case 'TemplateElement': {
        if (node.slotFillers) {
          const vars = enclosingVars(loops);
          for (const filler of node.slotFillers) {
            for (const param of filler.params) {
              // Risk 1: a slot-fill param shadows an enclosing loop var.
              if (vars.has(param.name)) slotParamShadows.add(param.name);
            }
          }
        }
        for (const child of node.children) walk(child, loops);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, loops);
          }
        }
        break;
      }
      case 'TemplateConditional':
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, loops);
        }
        break;
      case 'TemplateMatch':
        for (const branch of node.branches) {
          for (const child of branch.body) walk(child, loops);
        }
        if (node.hostElement) walk(node.hostElement, loops);
        break;
      case 'TemplateFragment':
        for (const child of node.children) walk(child, loops);
        break;
      case 'TemplateSlotInvocation':
        for (const child of node.fallback) walk(child, loops);
        break;
      default:
        break;
    }
  };

  walk(ir.template, []);
  return result;
}
