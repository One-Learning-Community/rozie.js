/**
 * emitSlotInvocation — Phase 5 Plan 05-04a Task 2.
 *
 * Lowers a `TemplateSlotInvocationIR` into Angular markup per RESEARCH
 * Pattern 8 + OQ A5 RESOLVED:
 *
 *   - presence='always' AND no defaultContent (and no fallback inline)
 *       → `<ng-container *ngTemplateOutlet="fooTpl; context: {...}" />`
 *   - presence='conditional' AND no defaultContent
 *       → `@if (fooTpl) { <ng-container *ngTemplateOutlet="..." /> }`
 *   - defaultContent OR inline fallback present
 *       → `@if (fooTpl) { <ng-container *ngTemplateOutlet="..." /> } @else { <fallback /> }`
 *
 * Default slot (slotName === '') uses tplField `defaultTpl` and synthetic
 * ref name `#defaultSlot` (OQ A5 RESOLVED).
 *
 * Plan 05-04b deferred follow-up — arrow-function context bug fix:
 *   Angular's template expression parser is a deliberately restricted subset
 *   of JS that does NOT accept arrow-function expressions (only identifier
 *   references, member accesses, method calls, and a handful of operators).
 *   When slot args contain arrow functions (e.g.,
 *   `:toggle="() => toggle(item.id)"`), inlining them verbatim into the
 *   *ngTemplateOutlet `context: { ... }` binding causes NgCompiler to fall
 *   back to JIT decoration. With AOT-only runtime (`bootstrapApplication`),
 *   JIT-decorated components crash with "JIT compiler unavailable".
 *
 *   Fix: when any slot arg expression contains an arrow function, emit a
 *   parameterized class-body helper field that takes the in-scope loop
 *   bindings as parameters and returns the full context object. Template
 *   then references `helperName(loopVarA, loopVarB, ...)` — a plain
 *   method-call expression that Angular's parser accepts.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { Expression as BabelExpression } from '@babel/types';
import type {
  IRComponent,
  TemplateNode,
  TemplateSlotInvocationIR,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { slotFieldName } from './refineSlotTypes.js';
import type { AngularScriptInjection } from './emitTemplateEvent.js';

// CJS interop normalization for @babel/traverse default export.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

export interface EmitSlotInvocationCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fallback children. */
  emitChildren: (children: TemplateNode[]) => string;
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  loopBindings?: ReadonlySet<string> | undefined;
  /**
   * Class-body field declarations to inject (parameterized slot-context
   * helpers when arrow functions are present in slot args). Same channel
   * used by emitEvents for guarded-handler / debounce / throttle wrappers.
   */
  scriptInjections?: AngularScriptInjection[] | undefined;
  /** Per-component counter shared across emit passes for stable suffixes. */
  injectionCounter?: { next: number } | undefined;
}

/**
 * Walk an IR Expression and return true iff it (or any descendant) is an
 * ArrowFunctionExpression or FunctionExpression. Angular's template parser
 * rejects both shapes inside `*ngTemplateOutlet` context bindings.
 */
function containsFunctionExpression(expr: BabelExpression): boolean {
  // Fast path: top-level node is itself an arrow / fn expression.
  if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
    return true;
  }
  let found = false;
  // Wrap in an ExpressionStatement so traverse() has a Program-level entry.
  const wrapper = t.file(
    t.program([t.expressionStatement(t.cloneNode(expr, true, false))]),
  );
  traverse(wrapper, {
    ArrowFunctionExpression() {
      found = true;
    },
    FunctionExpression() {
      found = true;
    },
  });
  return found;
}

/**
 * Render the args object for `*ngTemplateOutlet="...; context: {...}"`. Each
 * arg `name="expr"` becomes `name: expr` in the context literal. The first
 * arg also doubles as $implicit (Angular convention).
 */
function renderContextLiteral(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  collisionRenames?: ReadonlyMap<string, string>,
  loopBindings?: ReadonlySet<string>,
): string {
  if (node.args.length === 0) return '';
  const namedFields: string[] = [];
  for (const a of node.args) {
    const expr = rewriteTemplateExpression(a.expression, ir, {
      collisionRenames,
      loopBindings,
    });
    namedFields.push(`${a.name}: ${expr}`);
  }
  // Aggregate $implicit as object of all named args.
  const implicitObj = `{ ${node.args
    .map((a) => {
      const expr = rewriteTemplateExpression(a.expression, ir, {
        collisionRenames,
        loopBindings,
      });
      return `${a.name}: ${expr}`;
    })
    .join(', ')} }`;
  const fields = [`$implicit: ${implicitObj}`, ...namedFields];
  return `{ ${fields.join(', ')} }`;
}

/**
 * Compose a stable helper-method name for a parameterized slot-context
 * factory. Uses the same `_<slotName>_ctx_<N>` suffixing pattern as
 * `_guarded<Handler>` / `_merged_<event>_<N>` synthesized methods elsewhere.
 */
function makeSlotCtxHelperName(
  slotName: string,
  counter: { next: number },
): string {
  const base = slotName === '' ? 'defaultSlot' : slotName;
  const N = counter.next++;
  return `_${base}_ctx${N === 0 ? '' : `_${N}`}`;
}

/**
 * Apply `this.` prefix to bare references to class members in a string of
 * template-rewritten code. Mirrors the same pass used for guarded-handler
 * field initializers in emitTemplateEvent. Used here when emitting the body
 * of a parameterized slot-context helper field — class field initializers
 * run in class scope, not template-implicit-this scope.
 *
 * Loop-binding parameter names are excluded: they shadow class members.
 */
function applyThisPrefixing(
  code: string,
  ir: IRComponent,
  collisionRenames?: ReadonlyMap<string, string>,
  loopParams?: ReadonlySet<string>,
): string {
  const memberNames = new Set<string>();
  for (const p of ir.props) memberNames.add(p.name);
  for (const s of ir.state) memberNames.add(s.name);
  for (const c of ir.computed) memberNames.add(c.name);
  for (const r of ir.refs) memberNames.add(r.name);
  for (const e of ir.emits) memberNames.add(e);
  if (collisionRenames) {
    for (const renamed of collisionRenames.values()) memberNames.add(renamed);
  }
  // Loop-binding params shadow members.
  if (loopParams) {
    for (const p of loopParams) memberNames.delete(p);
  }
  if (memberNames.size === 0) return code;

  const pattern = new RegExp(
    `(?<![\\w$.])(${Array.from(memberNames)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\b`,
    'g',
  );
  return code.replace(pattern, 'this.$1');
}

/**
 * Build a parameterized class-body helper field that returns the slot context
 * object. Returns the field declaration text + the call expression to splice
 * into the template's `context:` binding.
 *
 *   _defaultSlot_ctx = (item: any) => ({
 *     $implicit: { item: item, toggle: () => this._toggle(item.id), ... },
 *     item: item,
 *     toggle: () => this._toggle(item.id),
 *     ...
 *   });
 *
 * Template-side: `*ngTemplateOutlet="...; context: _defaultSlot_ctx(item)"`
 */
function buildSlotCtxHelper(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  helperName: string,
  loopBindingsList: string[],
  collisionRenames?: ReadonlyMap<string, string>,
): { fieldDecl: string; templateCallExpr: string } {
  const loopParamSet = new Set(loopBindingsList);
  // Render each arg expression in template style (signal calls etc.), then
  // post-process to add `this.` prefix for class members. Loop-param names
  // are excluded from the prefix pass — they're now method parameters.
  const namedFields: string[] = [];
  for (const a of node.args) {
    const exprTemplate = rewriteTemplateExpression(a.expression, ir, {
      collisionRenames,
      loopBindings: loopParamSet,
    });
    const exprClass = applyThisPrefixing(exprTemplate, ir, collisionRenames, loopParamSet);
    namedFields.push(`${a.name}: ${exprClass}`);
  }
  const implicitFields = node.args
    .map((a) => {
      const exprTemplate = rewriteTemplateExpression(a.expression, ir, {
        collisionRenames,
        loopBindings: loopParamSet,
      });
      const exprClass = applyThisPrefixing(exprTemplate, ir, collisionRenames, loopParamSet);
      return `${a.name}: ${exprClass}`;
    })
    .join(', ');
  const ctxLiteral = `{ $implicit: { ${implicitFields} }, ${namedFields.join(', ')} }`;

  // Field signature. Each loop-binding parameter is `: any` for v1 (TYPES-01
  // refinement is a Phase 6 concern). The body is a single expression — the
  // context object literal — so we wrap in parens for arrow-returns-object
  // syntax (`(item) => ({ ... })`).
  const paramList = loopBindingsList.map((p) => `${p}: any`).join(', ');
  const fieldDecl = `private ${helperName} = (${paramList}) => (${ctxLiteral});`;

  const templateCallExpr = `${helperName}(${loopBindingsList.join(', ')})`;
  return { fieldDecl, templateCallExpr };
}

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitSlotInvocationCtx,
): string {
  const tplField = slotFieldName(node.slotName);

  // Find matching SlotDecl to determine presence + defaultContent.
  const decl: SlotDecl | undefined = ctx.ir.slots.find(
    (s) => (s.name === '' ? '' : s.name) === node.slotName,
  );

  // Determine the fallback content.
  const fallbackChildren: TemplateNode[] =
    decl?.defaultContent !== null && decl?.defaultContent !== undefined
      ? [decl.defaultContent]
      : node.fallback;

  const hasFallback = fallbackChildren.length > 0;
  const presence: 'always' | 'conditional' = decl?.presence ?? 'always';

  // Build the *ngTemplateOutlet binding fragment.
  let ctxSuffix = '';
  if (node.args.length > 0) {
    // Arrow-function detection — Angular template parser rejects arrow / fn
    // expressions in `context: {...}` bindings. When ANY arg expression
    // contains one, emit a parameterized class-body helper field and
    // reference it via plain method call from the template.
    const hasArrowInArgs = node.args.some((a) =>
      containsFunctionExpression(a.expression),
    );

    if (hasArrowInArgs && ctx.scriptInjections && ctx.injectionCounter) {
      const loopBindingsList = Array.from(ctx.loopBindings ?? []);
      const helperName = makeSlotCtxHelperName(node.slotName, ctx.injectionCounter);
      const { fieldDecl, templateCallExpr } = buildSlotCtxHelper(
        node,
        ctx.ir,
        helperName,
        loopBindingsList,
        ctx.collisionRenames,
      );
      ctx.scriptInjections.push({ name: helperName, decl: fieldDecl });
      ctxSuffix = `; context: ${templateCallExpr}`;
    } else {
      // No arrows present (or no inject channel available — defensive
      // fallback for callers that don't plumb scriptInjections, e.g., the
      // per-block emitTemplate.test.ts harness): inline literal context.
      const ctxLiteral = renderContextLiteral(
        node,
        ctx.ir,
        ctx.collisionRenames,
        ctx.loopBindings,
      );
      ctxSuffix = ctxLiteral ? `; context: ${ctxLiteral}` : '';
    }
  }
  const outletTag = `<ng-container *ngTemplateOutlet="${tplField}${ctxSuffix}" />`;

  if (!hasFallback && presence === 'always') {
    // Bare *ngTemplateOutlet (TemplateRef may be undefined; Angular renders nothing).
    return outletTag;
  }

  if (!hasFallback && presence === 'conditional') {
    return `@if (${tplField}) {\n${outletTag}\n}`;
  }

  // Has fallback — verbose form.
  const fallbackMarkup = ctx.emitChildren(fallbackChildren);
  return `@if (${tplField}) {\n${outletTag}\n} @else {\n${fallbackMarkup}\n}`;
}
