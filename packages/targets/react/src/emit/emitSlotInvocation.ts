/**
 * emitSlotInvocation — Plan 04-03 Task 2 (React target).
 *
 * Lowers a TemplateSlotInvocationIR to a JSX expression following the
 * 5-pattern table from RESEARCH Pattern 8 lines 758-783:
 *
 * | Pattern                 | JSX form                                                      |
 * |-------------------------|---------------------------------------------------------------|
 * | Default, no params      | `{props.children}` (or `{props.children ?? <fallback>}`)      |
 * | Default with params     | `{typeof props.children === 'function' ? props.children(ctx) : (props.children ?? __defaultChildren(ctx))}` |
 * | Named, no params        | `{props.renderHeader ?? <fallback>}`                          |
 * | Named with params       | `{props.renderTrigger?.(ctx)}` or with-fallback variant       |
 * | Conditional presence    | Wrap by TemplateConditional outside this fn                   |
 *
 * paramObj is `{ key: rewriteTemplateExpression(arg.expression), ... }` per
 * the slot invocation's :paramName="expr" attribute set.
 *
 * Default-slot-with-params dual call shape (dropdown-react-default-slot
 * bugfix, 2026-05-15): Vue/Svelte/Solid runtimes handle "consumer passes JSX
 * children, definition uses :scope params" natively through their respective
 * slot machineries — for Vue it's the SFC slot bridge, for Svelte the snippet
 * runtime, for Solid the `children()` accessor. React has no equivalent
 * mechanism; consumers pass `children` as a JS prop and the runtime can't
 * silently re-shape "JSX.Element[] → (ctx) => JSX.Element" for us. We emit a
 * `typeof === 'function'` discriminator so both call shapes work:
 *   - Render-prop consumer (`<Dropdown>{({close}) => …}</Dropdown>`) → call with scope
 *   - Children consumer (`<Dropdown><div/>…</Dropdown>` from DropdownDemo) →
 *     pass through verbatim (consumer opted out of the scope).
 * Named slots intentionally stay strict-function-only because the
 * `renderHeader={…}` consumer pattern is unambiguous; consumers reach for a
 * render prop deliberately. The default slot is the ambiguous case because
 * it overlaps with React's built-in `children` prop semantics.
 *
 * Side effects:
 *   - May push a `function __defaultX(ctx) { return ...; }` into ctx.scriptInjections
 *
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *
 *   When `node.context === 'fill-body'` (sticky-downward flag set by the
 *   lowerer in Plan 07.2-01 for any <slot> nested inside a SlotFillerDecl.body),
 *   this emitter requires NO branch. The producer-side emission shape —
 *   `props.render<X> ?? <fallback>` — IS the correct re-projection shape
 *   because `props` refers to the CURRENT component's own scope (the wrapper),
 *   not the parent component's. So when a wrapper re-projects its consumer's
 *   `title` slot into Inner's `header` slot via
 *   `<Inner><template #header><slot name="title"/></template></Inner>`,
 *   the emitted React reads `props.renderTitle` — the wrapper's OWN renderTitle
 *   prop, which is the wrapper's incoming slot from its consumer.
 *
 *   D-07 wrapper-only-params semantics are honored by construction: the emit
 *   for `<slot name="title" />` references ONLY `props.renderTitle`, never the
 *   enclosing fill body's scoped params (e.g., `close` from
 *   `<template #header="{ close }">`) — those would only leak if the wrapper
 *   author explicitly forwarded them via `<slot name="title" :close="close" />`.
 *
 *   No parent-chain walking is needed (D-SM-01 anti-pattern avoided): the
 *   producer-side emit reads from `props` (the wrapper's scope) without
 *   knowing or caring whether it's inside a fill body.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  TemplateSlotInvocationIR,
  IRComponent,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { refineSlotTypes } from './refineSlotTypes.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';
// Late-import via a getter to avoid circular import errors during ES module
// initialization. emitTemplateNode imports this module at top-level; we need
// the inverse only inside function bodies (which run after both modules have
// fully initialized).
import * as _emitTemplateNodeModule from './emitTemplateNode.js';

function findSlotDecl(name: string, ir: IRComponent): SlotDecl | null {
  for (const s of ir.slots) {
    if (s.name === name) return s;
  }
  return null;
}

/**
 * Build the param-object literal text from invocation args.
 *   args = [{name:'item', expression: <ID('item')>}, ...]  → `{ item: item, toggle: toggle }`
 *
 * Shorthand collapse: when arg.name === renderedExpression, emit `{ item }` form.
 */
function buildParamObj(
  args: TemplateSlotInvocationIR['args'],
  ir: IRComponent,
): string {
  if (args.length === 0) return '{}';
  const parts = args.map((a) => {
    const code = rewriteTemplateExpression(a.expression, ir);
    if (code === a.name) return a.name; // shorthand
    return `${a.name}: ${code}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/**
 * Render the slot's defaultContent fallback for INLINE use (when defaultLifting
 * was 'inline'). For TextNode, render as a JS string literal.
 */
function renderInlineFallback(slot: SlotDecl, ir: IRComponent): string {
  if (!slot.defaultContent) return 'null';
  if (slot.defaultContent.type === 'TemplateStaticText') {
    return JSON.stringify(slot.defaultContent.text);
  }
  // Shouldn't happen if decideDefaultLifting works; fall back to null.
  void ir;
  return 'null';
}

/**
 * Lift the slot's defaultContent into a top-of-file function-const.
 * Returns the function-const declaration text and the function name.
 *
 * Recursively emits the defaultContent body via the same emitNode pipeline.
 */
function liftDefaultFn(
  slot: SlotDecl,
  fnName: string,
  ctx: EmitNodeCtx,
): string {
  // We need to emit the defaultContent through the standard emitNode pipeline.
  // To avoid an import cycle (emitTemplateNode imports this module), we use
  // a late-bound emitter via a function reference that emitTemplateNode passes
  // through ctx implicitly. Actually emitNode is exported from emitTemplateNode
  // and we already import emitNode at runtime (no cycle issue at runtime
  // because top-level imports resolve before execution).
  // To minimize coupling and avoid cycle warnings, we use dynamic import.
  // Simpler: import emitNode directly. The module graph is acyclic at runtime.
  // (emitTemplateNode imports emitSlotInvocation; emitSlotInvocation needs to
  //  import emitNode → cycle. To break it, we expose emitNode through ctx.)

  // Late-resolve emitNode to avoid the static-import cycle. By the time
  // liftDefaultFn is called, both modules are fully initialized.
  const emitNodeFn = _emitTemplateNodeModule.emitNode;
  let bodyJsx: string;
  if (slot.defaultContent) {
    bodyJsx = emitNodeFn(slot.defaultContent, ctx);
  } else {
    bodyJsx = 'null';
  }

  // Build the param-extraction line
  const paramExtract = slot.params.length > 0
    ? `const { ${slot.params.map((p) => p.name).join(', ')} } = ctx;\n  `
    : '';

  // Wrap bodyJsx in `(...)` if it isn't already an expression
  const isExpr = bodyJsx.startsWith('{') && bodyJsx.endsWith('}');
  void isExpr;
  return `function ${fnName}(ctx: any): any {\n  ${paramExtract}return (${bodyJsx});\n}`;
}

/**
 * Render the invocation-site fallback (TemplateSlotInvocationIR.fallback —
 * the inline children of the <slot> element in the template) as a JSX
 * expression. Used when SlotDecl.defaultContent is null but the invocation
 * site provides inline children. Returns `null` when there's no fallback.
 */
function renderInvocationFallback(
  fallback: TemplateSlotInvocationIR['fallback'],
  ctx: EmitNodeCtx,
): string {
  // Filter out whitespace-only TemplateStaticText nodes between elements —
  // they're an artifact of HTML formatting, not user-meaningful content.
  const realChildren = fallback.filter(
    (c) => !(c.type === 'TemplateStaticText' && c.text.trim() === ''),
  );
  if (realChildren.length === 0) return 'null';
  const emitNodeFn = _emitTemplateNodeModule.emitNode;
  const parts = realChildren.map((child) => emitNodeFn(child, ctx));
  if (parts.length === 1) {
    const single = parts[0]!;
    // Strip a single `{...}` wrap so the result is suitable inside a JSX expr.
    if (single.startsWith('{') && single.endsWith('}') && single.length > 2) {
      return single.slice(1, -1);
    }
    // Bare text from emitStaticText needs string-literal wrap when used as a JS
    // expression (e.g. right-hand side of `??`).
    const trimmed = single.trim();
    if (
      realChildren[0]!.type === 'TemplateStaticText' &&
      !trimmed.startsWith('<')
    ) {
      return JSON.stringify(trimmed);
    }
    return single;
  }
  // Multiple children — wrap in a fragment.
  return `<>${parts.join('')}</>`;
}

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitNodeCtx,
): string {
  // Portal-slot primitive (Spike 003) — portal slots are invoked from script
  // via `$portals.<name>(...)`, NOT from the rendered template tree. Skip
  // emission entirely. The slot still appears in ir.slots so its render-prop
  // appears on the props interface; the engine wrapper consumes it imperatively.
  if (node.isPortal) return '';
  const slotName = node.slotName;
  const slot = findSlotDecl(slotName, ctx.ir);
  // Build the invocation-site fallback once. Used when SlotDecl.defaultContent
  // is null but the <slot> element wraps inline fallback children.
  const invocationFallback = renderInvocationFallback(node.fallback, ctx);
  const hasInvocationFallback = invocationFallback !== 'null';

  // If no SlotDecl, fall back to a default-children lookup as best-effort.
  if (!slot) {
    if (slotName === '') {
      return hasInvocationFallback
        ? `{props.children ?? ${invocationFallback}}`
        : '{props.children}';
    }
    const fieldName = 'render' + slotName.charAt(0).toUpperCase() + slotName.slice(1);
    return hasInvocationFallback
      ? `{props.${fieldName} ?? ${invocationFallback}}`
      : `{props.${fieldName}}`;
  }

  const refined = refineSlotTypes(slot);
  // Phase 07.3.2 — merge static-named fill with the dynamic `slots?:` map
  // intake added in emitPropsInterface.ts + emitTypes.ts. Left-precedence
  // `??` mirrors Svelte D-SV-16 (commit 6060408) $derived merge — static
  // wins (D-02); dynamic catches runtime-only mismatches per D-03 silent
  // no-op invariant. The parenthesised expression keeps operator precedence
  // intact when wrapped in `{...}` / `?.(...)` / `?? fallback` downstream.
  // D-18 empty-string sentinel: default slot keys as `''` in the slots map.
  const dynKey = slot.name === '' ? "''" : `'${slot.name}'`;
  const fieldRef = `(props.${refined.propFieldName} ?? props.slots?.[${dynKey}])`;
  const hasParams = slot.params.length > 0;
  const paramObj = buildParamObj(node.args, ctx.ir);

  // Lift SlotDecl.defaultContent (the slot-decl-side fallback) when present.
  if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
    const fnDecl = liftDefaultFn(slot, refined.defaultFnName, ctx);
    // Avoid pushing duplicates if the slot is invoked multiple times.
    if (!ctx.scriptInjections.some((i) => i.startsWith(`function ${refined.defaultFnName}`))) {
      ctx.scriptInjections.push(fnDecl);
    }
  }

  // Now build the JSX expression per pattern. Precedence:
  //   1. SlotDecl.defaultContent (lifted via decideDefaultLifting) — when present
  //   2. TemplateSlotInvocationIR.fallback (inline <slot> children) — when present
  //   3. Empty fallback (renders `undefined` — no inline content provided)
  if (slotName === '' && !hasParams) {
    // Default, no params.
    //
    // 2026-05-18 — Discriminate on `typeof === 'function'` for the slot value
    // because the merged field is `ReactNode | (() => ReactNode) | undefined`:
    //   - `props.children` is `ReactNode` (the consumer wrote `<X>node</X>`)
    //   - `props.slots?.['']` is `() => ReactNode` (the dynamic-slots intake
    //     shape added in Phase 07.3.2; emitSlotFiller.ts:140 wraps every
    //     emitted fill body in an arrow regardless of slot kind)
    // Without the discriminator, the merged value rendered as a React child
    // would either invoke the function as a render component (React error:
    // "Functions are not valid as a React child") or silently no-op. The
    // surrogate TS2322 under tests/react-typecheck flags the same shape: bare
    // `{ReactNode | (() => ReactNode)}` is not assignable to ReactNode.
    const slotted = `(typeof ${fieldRef} === 'function' ? (${fieldRef} as Function)() : ${fieldRef})`;
    if (refined.defaultLifting === 'inline') {
      const fallback = renderInlineFallback(slot, ctx.ir);
      return `{${slotted} ?? ${fallback}}`;
    }
    if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
      return `{${slotted} ?? ${refined.defaultFnName}({})}`;
    }
    if (hasInvocationFallback) {
      return `{${slotted} ?? ${invocationFallback}}`;
    }
    return `{${slotted}}`;
  }

  if (slotName === '' && hasParams) {
    // Default with params — dual-shape: function (render-prop) OR ReactNode
    // (raw children, consumer opted out of scope). See header comment.
    //
    // 2026-05-18 — Cast the discriminated branch to `Function` then call. TS
    // can't narrow across two separate `(props.children ?? props.slots?.[''])`
    // expressions in a ternary (each is a fresh expression so the typeof guard
    // doesn't apply to the body's re-access), so we cast on the body side. The
    // outer `?? children`/`?? fallback` produces the React node when typeof is
    // not 'function'. Mirrors Solid's optional-call slot fix (commit 536575a).
    if (refined.defaultFnName !== null) {
      return `{typeof ${fieldRef} === 'function' ? (${fieldRef} as Function)(${paramObj}) : (${fieldRef} ?? ${refined.defaultFnName}(${paramObj}))}`;
    }
    if (hasInvocationFallback) {
      // Fallback children may reference slot params (e.g., `item`); they're
      // in scope via the surrounding closure for default-slot inline children
      // because the slot is invoked from the same component body.
      return `{typeof ${fieldRef} === 'function' ? (${fieldRef} as Function)(${paramObj}) : (${fieldRef} ?? ${invocationFallback})}`;
    }
    return `{typeof ${fieldRef} === 'function' ? (${fieldRef} as Function)(${paramObj}) : ${fieldRef}}`;
  }

  // Named slot — no params
  // Phase 07.3.2 fix — INVOKE the function. The consumer ALWAYS wraps the
  // slot body in an arrow function (emitSlotFiller.ts:126:
  // `renderHeader={() => (<>...</>)}`), and refineSlotTypes.ts:108 now
  // declares the field as `() => ReactNode` to match. Before this fix the
  // producer rendered the function reference directly as a React child,
  // triggering React's "Functions are not valid as a React child" error
  // (dev) or silent-no-op (production) — the root cause of WrapperModal
  // #brand/#actions failing to render in dogfood Modal 3. Mirrors the
  // with-params named-slot style at L293-301 below (`?.(...)` becomes
  // `?.()` since this branch has no params). Composes with Plan 01's
  // merged fieldRef: `(props.renderBrand ?? props.slots?.['brand'])?.()`
  // is valid JS (`(a ?? b)?.()`).
  if (!hasParams) {
    // 2026-05-18 — Cast truthy-branch call site to `Function` so the ternary's
    // truthy guard (`(props.renderX ?? props.slots?.['x']) ? …(...)`) narrows
    // through the cast instead of demanding TS narrow across two separate
    // expression-trees.
    if (refined.defaultLifting === 'inline') {
      const fallback = renderInlineFallback(slot, ctx.ir);
      return `{${fieldRef} ? (${fieldRef} as Function)() : ${fallback}}`;
    }
    if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
      return `{${fieldRef} ? (${fieldRef} as Function)() : ${refined.defaultFnName}({})}`;
    }
    if (hasInvocationFallback) {
      return `{${fieldRef} ? (${fieldRef} as Function)() : ${invocationFallback}}`;
    }
    return `{${fieldRef}?.()}`;
  }

  // Named with params — strict render-prop shape (no dual-call; consumers
  // explicitly opt into the function form by writing `renderTrigger={…}`).
  // 2026-05-18 — Cast the truthy-branch call site to `Function` so TS doesn't
  // require narrowing across the two `(props.renderX ?? props.slots?.['x'])`
  // expressions (each is a separate AST node; the truthy guard on the test
  // side doesn't refine the consequent). Same pattern as the default-slot
  // with-params branch above.
  if (refined.defaultFnName !== null) {
    return `{${fieldRef} ? (${fieldRef} as Function)(${paramObj}) : ${refined.defaultFnName}(${paramObj})}`;
  }
  if (hasInvocationFallback) {
    return `{${fieldRef} ? (${fieldRef} as Function)(${paramObj}) : ${invocationFallback}}`;
  }
  return `{${fieldRef}?.(${paramObj})}`;
}
