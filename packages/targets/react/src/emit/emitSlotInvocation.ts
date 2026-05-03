/**
 * emitSlotInvocation — Plan 04-03 Task 2 (React target).
 *
 * Lowers a TemplateSlotInvocationIR to a JSX expression following the
 * 5-pattern table from RESEARCH Pattern 8 lines 758-783:
 *
 * | Pattern                 | JSX form                                                      |
 * |-------------------------|---------------------------------------------------------------|
 * | Default, no params      | `{props.children}` (or `{props.children ?? <fallback>}`)      |
 * | Default with params     | `{props.children ? props.children(ctx) : __defaultChildren(ctx)}` |
 * | Named, no params        | `{props.renderHeader ?? <fallback>}`                          |
 * | Named with params       | `{props.renderTrigger?.(ctx)}` or with-fallback variant       |
 * | Conditional presence    | Wrap by TemplateConditional outside this fn                   |
 *
 * paramObj is `{ key: rewriteTemplateExpression(arg.expression), ... }` per
 * the slot invocation's :paramName="expr" attribute set.
 *
 * Side effects:
 *   - May push a `function __defaultX(ctx) { return ...; }` into ctx.scriptInjections
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

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitNodeCtx,
): string {
  const slotName = node.slotName;
  const slot = findSlotDecl(slotName, ctx.ir);
  // If no SlotDecl, fall back to a default-children lookup as best-effort.
  if (!slot) {
    if (slotName === '') return '{props.children}';
    const fieldName = 'render' + slotName.charAt(0).toUpperCase() + slotName.slice(1);
    return `{props.${fieldName}}`;
  }

  const refined = refineSlotTypes(slot);
  const fieldRef = `props.${refined.propFieldName}`;
  const hasParams = slot.params.length > 0;
  const paramObj = buildParamObj(node.args, ctx.ir);

  // Lift default content if needed
  if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
    const fnDecl = liftDefaultFn(slot, refined.defaultFnName, ctx);
    // Avoid pushing duplicates if the slot is invoked multiple times.
    if (!ctx.scriptInjections.some((i) => i.startsWith(`function ${refined.defaultFnName}`))) {
      ctx.scriptInjections.push(fnDecl);
    }
  }

  // Now build the JSX expression per pattern.
  if (slotName === '' && !hasParams) {
    // Default, no params
    if (refined.defaultLifting === 'inline') {
      const fallback = renderInlineFallback(slot, ctx.ir);
      return `{${fieldRef} ?? ${fallback}}`;
    }
    if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
      return `{${fieldRef} ?? ${refined.defaultFnName}({})}`;
    }
    return `{${fieldRef}}`;
  }

  if (slotName === '' && hasParams) {
    // Default with params
    if (refined.defaultFnName !== null) {
      return `{${fieldRef} ? ${fieldRef}(${paramObj}) : ${refined.defaultFnName}(${paramObj})}`;
    }
    return `{${fieldRef}?.(${paramObj})}`;
  }

  // Named slot
  if (!hasParams) {
    if (refined.defaultLifting === 'inline') {
      const fallback = renderInlineFallback(slot, ctx.ir);
      return `{${fieldRef} ?? ${fallback}}`;
    }
    if (refined.defaultLifting === 'function-const' && refined.defaultFnName !== null) {
      return `{${fieldRef} ?? ${refined.defaultFnName}({})}`;
    }
    return `{${fieldRef}}`;
  }

  // Named with params
  if (refined.defaultFnName !== null) {
    return `{${fieldRef} ? ${fieldRef}(${paramObj}) : ${refined.defaultFnName}(${paramObj})}`;
  }
  return `{${fieldRef}?.(${paramObj})}`;
}
