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
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *
 *   When `node.context === 'fill-body'` (sticky-downward flag set by the
 *   lowerer in Plan 07.2-01 for any <slot> nested inside a SlotFillerDecl.body),
 *   this emitter requires NO branch. The producer-side
 *   `<ng-container *ngTemplateOutlet="<X>Tpl" />` shape IS the correct
 *   re-projection shape because `<X>Tpl` resolves against the wrapper's
 *   OWN `@ContentChild('<X>', { read: TemplateRef }) <X>Tpl?: ...` field —
 *   declared by emitSlotDecl for the wrapper's own `<slot name="X">`. When
 *   a wrapper re-projects its consumer's `title` slot into Inner's `header`
 *   slot via `<Inner><template #header><slot name="title"/></template></Inner>`,
 *   the emitted Angular reads `<ng-container *ngTemplateOutlet="titleTpl" />`
 *   — the wrapper's OWN titleTpl ContentChild reference, which captures the
 *   `<ng-template #title>` the consumer projected into the wrapper.
 *
 *   D-07 wrapper-only-params semantics are honored by construction: the
 *   *ngTemplateOutlet binding references `titleTpl` only, never the
 *   enclosing fill body's let-bindings.
 *
 *   No parent-chain walking is needed (D-SM-01 anti-pattern avoided).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  TemplateNode,
  TemplateSlotInvocationIR,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { slotFieldName } from './refineSlotTypes.js';
import type { AngularScriptInjection } from './emitTemplateEvent.js';

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
  /**
   * Class members from rewriteScript (props, state, computed, refs, emits,
   * AND collision-renamed user methods like `removeItem`, `_close`). Used by
   * `applyThisPrefixing` when generating class-body slot-context helper
   * fields — those run in class scope, not template-implicit-this scope,
   * so any bare identifier that matches a class member needs `this.` prefix.
   * The locally-built ir-only set in `applyThisPrefixing` is the fallback
   * when callers don't plumb this (e.g., the per-block emitTemplate.test.ts
   * harness); production callers in emitAngular.ts must thread the real
   * set so user-method references emit correctly.
   */
  classMembers?: ReadonlySet<string> | undefined;
}

/**
 * Walk an IR Expression and return true iff it (or any descendant) is an
 * ArrowFunctionExpression or FunctionExpression. Angular's template parser
 * rejects both shapes inside `*ngTemplateOutlet` context bindings.
 *
 * Uses a simple recursive node.type check instead of a full @babel/traverse
 * pass — avoids N separate AST traversals for N slot args and removes the
 * @babel/traverse import from this module. Closes IN-04.
 */
function containsFunctionExpression(node: t.Node): boolean {
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) return true;
  for (const key of Object.keys(node)) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && 'type' in (child as object)) {
      if (containsFunctionExpression(child as t.Node)) return true;
    }
    // Also handle arrays of child nodes (e.g. arguments, params, body.body).
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in (item as object)) {
          if (containsFunctionExpression(item as t.Node)) return true;
        }
      }
    }
  }
  return false;
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
  classMembers?: ReadonlySet<string>,
): string {
  // Prefer the rewriteScript-provided classMembers set when available — it's
  // the canonical record of every name lifted to the class (props, state,
  // computed, refs, emits, collision-renamed user methods, slot tplFields).
  // The fallback below mirrors the historic shape so the per-block
  // emitTemplate.test.ts harness (which doesn't plumb classMembers) keeps
  // working for cases without user-method slot args.
  const memberNames = new Set<string>();
  if (classMembers) {
    for (const m of classMembers) memberNames.add(m);
  } else {
    for (const p of ir.props) memberNames.add(p.name);
    for (const s of ir.state) memberNames.add(s.name);
    for (const c of ir.computed) memberNames.add(c.name);
    for (const r of ir.refs) memberNames.add(r.name);
    for (const e of ir.emits) memberNames.add(e);
    if (collisionRenames) {
      for (const renamed of collisionRenames.values()) memberNames.add(renamed);
    }
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
  classMembers?: ReadonlySet<string>,
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
    const exprClass = applyThisPrefixing(exprTemplate, ir, collisionRenames, loopParamSet, classMembers);
    namedFields.push(`${a.name}: ${exprClass}`);
  }
  const implicitFields = node.args
    .map((a) => {
      const exprTemplate = rewriteTemplateExpression(a.expression, ir, {
        collisionRenames,
        loopBindings: loopParamSet,
      });
      const exprClass = applyThisPrefixing(exprTemplate, ir, collisionRenames, loopParamSet, classMembers);
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
  // Portal-slot primitive (Spike 003) — skip template emit. Portal slots are
  // mounted via vcr.createEmbeddedView from script using `$portals.<name>(...)`.
  if (node.isPortal) return '';
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
        ctx.classMembers,
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
  // Phase 07.3.2 — merge @ContentChild static-name ref with the new
  // `templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined)`
  // signal map declared in emitScript.ts Section 6e. Static @ContentChild
  // (`<X>Tpl`) wins LEFT of `??` (D-02 static-wins invariant); dynamic
  // `templates()?.['<X>']` catches consumer-side `<template #[expr]>`
  // projections that ContentChild's static-selector path cannot resolve.
  // @ContentChild populates in `ngAfterContentInit` BEFORE template binding
  // evaluation (Assumption A5), so the static path is already populated by
  // the time the template expression is evaluated — first-render precedence
  // preserved. Default-slot synthetic key `defaultSlot` matches
  // refineSlotTypes.ts:24 ref name (and the consumer-side
  // `<ng-template #defaultSlot>` wrap at emitTemplateNode.ts:484).
  // `templates()` is the signal CALL form per RESEARCH A7 (signal-era
  // `input<T>()` idiom, NOT decorator `@Input()`).
  const dynKey = node.slotName === '' ? 'defaultSlot' : node.slotName;
  const mergedTplRef = `(${tplField} ?? templates()?.['${dynKey}'])`;
  const outletTag = `<ng-container *ngTemplateOutlet="${mergedTplRef}${ctxSuffix}" />`;

  if (!hasFallback && presence === 'always') {
    // Bare *ngTemplateOutlet (TemplateRef may be undefined; Angular renders nothing).
    return outletTag;
  }

  // Phase 07.3.2 Plan 10 — inner @if guard MUST use mergedTplRef (computed
  // at line 326) so the @if evaluates truthy when ONLY dynamic-name templates
  // are present. Without this, Task 1's outer r-if guard rewrite might
  // evaluate truthy via the merge, but the inner @if would still short-circuit
  // on the bare static tplField → *ngTemplateOutlet would never fire.
  // Completes the symmetry: outer r-if guard (rewriter), outlet binding
  // (Plan 03), and inner @if guard (Plan 10) all use the same merged shape.
  if (!hasFallback && presence === 'conditional') {
    return `@if (${mergedTplRef}) {\n${outletTag}\n}`;
  }

  // Has fallback — verbose form.
  const fallbackMarkup = ctx.emitChildren(fallbackChildren);
  return `@if (${mergedTplRef}) {\n${outletTag}\n} @else {\n${fallbackMarkup}\n}`;
}
