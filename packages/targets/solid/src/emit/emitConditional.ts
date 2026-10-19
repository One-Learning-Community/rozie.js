/**
 * emitConditional — Solid target (P2 complete implementation).
 *
 * Builds `<Show when={...}>` JSX for r-if / r-else-if / r-else branches.
 * Solid uses `<Show>` instead of React's ternary chain.
 *
 * Cases:
 *   - Single r-if (no else): `<Show when={cond}>{body}</Show>`
 *   - r-if + r-else: `<Show when={cond} fallback={elseBody}>{body}</Show>`
 *   - r-if + r-else-if + ...: nested `<Show>` elements in fallback
 *   - EB-2 (quick 261019-9g1) — a chain inside a keyless `<For>` whose test reads
 *     the RAW loop item alias lowers to a fragment-wrapped JSX conditional,
 *     `<>{(t1) ? A : (t2) ? B : C}</>`, instead of `<Show>`.
 *
 * Why not `<Show>` there: `<Show when={...}>` is not a type guard, so inside
 * `<Show when={item !== 'gap'}>` a union alias (`number | 'gap'`) is NOT narrowed
 * and a slot param typed `number` fails strict tsc (TS2322) on Solid alone —
 * React's `&&`, Lit's ternary, Vue's v-if and Svelte's {#if} all narrow. A JSX
 * ternary narrows.
 *
 * Why a FRAGMENT and not a bare ternary: the `<For>` render callback runs
 * untracked, so a bare `(item) => test ? a : b` is evaluated once — a test or
 * branch that reads a signal would stop updating. Inside a fragment,
 * babel-preset-solid compiles the dynamic child to
 * `_$memo(() => _$memo(() => !!(test))() ? a : null)`, the same truthiness-gated
 * memo `<Show>` uses. A row-constant test (only the alias and literals) compiles
 * to a static ternary, equivalent because a keyless `<For>` row's item never
 * changes. `ctx.loopValueBindings` holds ONLY raw keyless-For item aliases, so
 * keyed `<Key>` loops (accessor item) and non-loop conditionals never qualify and
 * keep their byte-identical `<Show>` output.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateConditionalIR, IRTemplateNode as TemplateNode } from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';
import { stripBalancedMustache } from './unwrapMustache.js';

/** AST keys that carry positions / comments, never sub-expressions. */
const SKIP_AST_KEYS: ReadonlySet<string> = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

/**
 * EB-2 — true when `test` contains a free read of one of `names`. An Identifier
 * counts UNLESS it is the non-computed `property` of a (Optional)MemberExpression
 * or the non-computed `key` of an ObjectProperty / ObjectMethod (`$props.item`
 * and `{ item: 1 }` do not read a loop variable named `item`). Deliberately NOT
 * emitTemplateNode's `expressionReferencesIdentifier`, which also matches member
 * property keys.
 */
function testReadsLoopValue(test: unknown, names: ReadonlySet<string>): boolean {
  const walk = (value: unknown, parent: Record<string, unknown> | null, key: string | null): boolean => {
    if (Array.isArray(value)) return value.some((v) => walk(v, parent, key));
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (obj['type'] === 'Identifier' && typeof obj['name'] === 'string' && names.has(obj['name'])) {
      const ptype = parent?.['type'];
      const isMemberProp =
        (ptype === 'MemberExpression' || ptype === 'OptionalMemberExpression') &&
        key === 'property' &&
        parent?.['computed'] !== true;
      const isObjectKey =
        (ptype === 'ObjectProperty' || ptype === 'ObjectMethod') &&
        key === 'key' &&
        parent?.['computed'] !== true;
      return !(isMemberProp || isObjectKey);
    }
    return Object.entries(obj).some(([k, v]) => !SKIP_AST_KEYS.has(k) && walk(v, obj, k));
  };
  return walk(test, null, null);
}

/**
 * EB-2 — render a branch body as a ternary OPERAND. A balanced `{…}` mustache
 * (a `<slot>` invocation) becomes `(inner)`; an element / fragment (starts with
 * `<`) and `null` are used as-is; anything else (static text) is wrapped in a
 * fragment.
 */
function toTernaryOperand(bodyJsx: string): string {
  const body = bodyJsx.trim();
  const inner = stripBalancedMustache(body);
  if (inner !== null) return `(${inner})`;
  if (body.startsWith('<') || body === 'null') return body;
  return `<>${body}</>`;
}

/**
 * Render a branch's body as a single JSX expression. Multiple children
 * become a fragment `<>...</>`.
 */
function renderBranchBody(
  body: TemplateNode[],
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  if (body.length === 0) return 'null';
  if (body.length === 1) {
    return emitNodeFn(body[0]!, ctx);
  }
  const parts = body.map((c) => emitNodeFn(c, ctx)).join('');
  return `<>${parts}</>`;
}

/**
 * Build a <Show> element for a single branch. The `fallback` prop is
 * optional — omit when no else branch.
 *
 * R10-1 fix (260710-uwr): `fallbackJsx` splices into the `fallback={…}`
 * JSX-ATTRIBUTE position. When it is a single balanced `{...}` mustache (a
 * `<slot>` or interpolation in the r-else arm), the doubled braces
 * (`fallback={{resolved()}}`) are an object-literal inside a JSX-attribute
 * expression — invalid. Strip the outer pair; `fallback={ }` already
 * supplies the delimiter parens so no re-wrap is needed. A nested `<Show …>`
 * element or `<>…</>` fragment (starts with `<`) is left untouched — it's
 * valid JSX there. `bodyJsx` (JSX-CHILDREN position, `>…</Show>`) is NOT
 * touched — a `{...}` mustache is a valid JSX child.
 *
 * 260711-ad5 — routed through the shared `stripBalancedMustache` primitive
 * (also used by `emitLoop`'s R11-1 fix). Byte-identical to the original
 * inline `startsWith/endsWith/length` check — same heuristic, still BARE
 * (no re-wrap) since the `fallback={ }` attribute already supplies the
 * delimiters.
 */
function buildShow(testCode: string, bodyJsx: string, fallbackJsx: string | null): string {
  if (fallbackJsx !== null) {
    const inner = stripBalancedMustache(fallbackJsx);
    const fallbackAttr = inner !== null ? inner : fallbackJsx;
    return `<Show when={${testCode}} fallback={${fallbackAttr}}>${bodyJsx}</Show>`;
  }
  return `<Show when={${testCode}}>${bodyJsx}</Show>`;
}

export function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  const { solid: solidImports } = ctx.collectors;

  const branches = node.branches;

  // EB-2 — narrowing lowering for a chain that reads a raw keyless-For item alias.
  const loopNames = ctx.loopValueBindings;
  if (
    loopNames !== undefined &&
    loopNames.size > 0 &&
    branches.some((b) => b.test !== null && testReadsLoopValue(b.test, loopNames))
  ) {
    // Build right to left: `rest` starts as `null` (no r-else) and every branch
    // wraps it as `(test) ? operand : rest`. An r-else supplies its body as `rest`.
    let rest = 'null';
    for (let i = branches.length - 1; i >= 0; i--) {
      const branch = branches[i]!;
      const operand = toTernaryOperand(renderBranchBody(branch.body, ctx, emitNodeFn));
      if (branch.test === null) {
        rest = operand;
        continue;
      }
      const testCode = rewriteTemplateExpression(branch.test, ctx.ir, {
        invokeAccessors: ctx.invokeAccessors,
        loopValueBindings: ctx.loopValueBindings,
        scopeAccessorParams: ctx.scopeAccessorParams,
      });
      rest = `(${testCode}) ? ${operand} : ${rest}`;
    }
    return `<>{${rest}}</>`;
  }

  solidImports.add('Show');
  if (branches.length === 0) return '{null}';

  // Build from right to left. The last branch is either:
  //   - A plain r-else (test === null): used as fallback for the second-to-last Show
  //   - A r-else-if or lone r-if: wrapped in Show with no fallback
  //
  // Strategy: walk branches left-to-right, building nested <Show> elements.
  // The rightmost branch with test === null is the r-else fallback.

  // Find trailing r-else (if any).
  const lastBranch = branches[branches.length - 1]!;
  let currentFallback: string | null = null;

  if (lastBranch.test === null) {
    // r-else — render as the initial fallback body (no Show wrapper)
    currentFallback = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
  } else {
    // No trailing r-else — last branch becomes a Show with no fallback
    const testCode = rewriteTemplateExpression(lastBranch.test, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,
      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    const bodyJsx = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
    currentFallback = null;
    // Build from second-to-last going left
    const startIdx = branches.length - 1;
    const show = buildShow(testCode, bodyJsx, null);
    if (startIdx === 0) {
      // Only one branch
      return `{${show}}`;
    }
    // Continue with remaining branches
    for (let i = startIdx - 1; i >= 0; i--) {
      const branch = branches[i]!;
      if (branch.test === null) {
        // r-else at a non-tail position (malformed; emit body unconditionally)
        currentFallback = renderBranchBody(branch.body, ctx, emitNodeFn);
        continue;
      }
      const bTestCode = rewriteTemplateExpression(branch.test, ctx.ir, {
        invokeAccessors: ctx.invokeAccessors,
        loopValueBindings: ctx.loopValueBindings,
        scopeAccessorParams: ctx.scopeAccessorParams,
      });
      const bBodyJsx = renderBranchBody(branch.body, ctx, emitNodeFn);
      // The "show" we built for the next branch becomes the fallback here
      const innerShow = buildShow(
        bTestCode,
        bBodyJsx,
        i === startIdx - 1 ? show : currentFallback!,
      );
      currentFallback = innerShow;
    }
    if (currentFallback === show) {
      return `{${show}}`;
    }
    return `{${currentFallback}}`;
  }

  // Build from right to left with r-else as base fallback
  let result: string = '';
  for (let i = branches.length - 2; i >= 0; i--) {
    const branch = branches[i]!;
    if (branch.test === null) {
      // r-else not at the end is malformed; treat as fallback
      currentFallback = renderBranchBody(branch.body, ctx, emitNodeFn);
      continue;
    }
    const testCode = rewriteTemplateExpression(branch.test, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,
      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    const bodyJsx = renderBranchBody(branch.body, ctx, emitNodeFn);
    result = buildShow(testCode, bodyJsx, currentFallback);
    currentFallback = result;
  }

  return `{${result}}`;
}
