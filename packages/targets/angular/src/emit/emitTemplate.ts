/**
 * emitTemplate — Phase 5 Plan 05-04a Task 2.
 *
 * Top-level template emitter. Walks the IR's TemplateNode tree and produces
 * an Angular 17+ template body string for inclusion inside `template:`
 * backticks of the @Component decorator.
 *
 * Returns:
 *   - `template`         — the template body string
 *   - `scriptInjections` — class-body field declarations (debounce/throttle
 *                           wrappers, guarded event method wrappers)
 *   - `hasNgModel`       — true when [(ngModel)] was emitted; drives FormsModule
 *                           conditional import in emitDecorator
 *   - `diagnostics`      — collected diagnostics (ROZ720, ROZ721, ROZ722)
 *
 * Empty template (ir.template === null) returns the empty string.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import type { AngularScriptInjection } from './emitTemplateEvent.js';

export interface EmitTemplateOpts {
  /** Collision-renames from rewriteScript (e.g., `close` → `_close`). */
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  /** Bug 5: handler-name → param-count map for guarded-wrapper arity. */
  handlerArity?: ReadonlyMap<string, number> | undefined;
  /**
   * Class members from rewriteScript — includes props, state, computed,
   * refs, emits, AND collision-renamed user methods (e.g., `removeItem`,
   * `_close`). emitSlotInvocation / emitTemplateEvent use this when emitting
   * class-body field initializers from template expressions: those
   * initializers run in class scope (no template-implicit-this), so any
   * bare identifier that matches a class member must be `this.`-prefixed.
   * Without user-method names included, a TodoList slot arg like
   * `:remove="() => removeItem(item.id)"` lifts to `() => removeItem(item.id)`
   * inside a class field, which tsc flags TS2663.
   */
  classMembers?: ReadonlySet<string> | undefined;
  /**
   * Phase 23 (angular-cva-forms-integration) — the resolved single CVA model
   * prop name (or null). emitAngular computes the gate ONCE and threads it here;
   * emitTemplate puts it on the EmitNodeCtx so every `rewriteTemplateExpression`
   * call injects `__rozieCvaOnChange(...)` at a CVA-prop write (Task 1) and
   * OR-merges `this.__rozieCvaDisabled()` at a `disabled` read (Task 2).
   */
  cvaModelProp?: string | null | undefined;
  /** Phase 23 — true when CVA-receiving AND a `disabled` prop is declared. */
  cvaMergeDisabled?: boolean | undefined;
}

export interface EmitTemplateResult {
  template: string;
  scriptInjections: AngularScriptInjection[];
  hasNgModel: boolean;
  /**
   * Phase 07.2 Plan 04 (R5): true when the consumer emitted at least one
   * dynamic slot-name dispatch (`<template #[expr]>`). Drives the
   * `ViewChild`, `TemplateRef`, and `NgTemplateOutlet` imports needed for
   * the synthetic `__dynSlot_<N>` template-ref capture + outlet dispatch.
   */
  hasDynamicSlotFiller: boolean;
  /**
   * Plan 14-05 — true when the template emitted at least one `spreadBinding`
   * (`r-bind="<expr>"` or synthesized `$attrs` auto-fallthrough). emitAngular
   * adds `inject`, `Renderer2`, `ElementRef`, `effect`, `viewChild` to the
   * `@angular/core` import line based on this flag. Same plumbing pattern as
   * `hasDynamicSlotFiller`.
   */
  hasSpreadBinding: boolean;
  /**
   * Plan 15-05 / D-13 — true when the template emitted at least one dynamic
   * `ListenerSpreadIR` lowered through the per-element `effect()` +
   * `Renderer2.listen()` body. emitAngular adds the same `inject` / `Renderer2`
   * / `ElementRef` / `effect` / `viewChild` / `DestroyRef` import surface
   * (overlap with `hasSpreadBinding` deduped by the collector Set semantics).
   */
  hasListenerSpread: boolean;
  /**
   * Plan 15-05 — true when the dynamic-listener-spread effect() emitted the
   * one-time `__rozieDestroyRef.onDestroy(...)` registration. emitScript
   * reads this and unions it into `lifecycleNeedsDestroyRefField` so the
   * `private __rozieDestroyRef = inject(DestroyRef);` field is hoisted
   * EXACTLY ONCE per component (Phase 13 coordination — memory
   * `project_rozie_angular_onmount_emit_bug`).
   */
  needsDestroyRefField: boolean;
  /**
   * Phase 26 (SPEC-1/SPEC-4, D-06/D-07) — true when at least one text /
   * attribute-binding / class-interpolation position emitted the
   * `rozieDisplay(...)` wrap. emitAngular reads this to gate BOTH the inlined
   * module-scope `function __rozieDisplay(v)` AND the synthesized delegating
   * class method `rozieDisplay(v) { return __rozieDisplay(v); }`. When false,
   * neither is emitted (non-wrapping components byte-identical to pre-phase,
   * SPEC-3). Same boxed-flag plumbing as `hasSpreadBinding`.
   *
   * 260608-sya — a wrapped WHOLE-VALUE attribute binding also sets this flag,
   * and emitAngular additionally inlines `function __rozieAttr(v)` (drop-on-
   * nullish, delegating to `__rozieDisplay`) + the `rozieAttr` class method on
   * the same flag.
   */
  hasDisplayWrap: boolean;
  /**
   * Quick task 260520-w18 bug class 6(ii) — well-known JS global namespaces
   * (`Math`, `JSON`, …) referenced inside template expressions. Angular's
   * `strictTemplates` resolves bare template identifiers against the
   * component instance, so `{{ Math.round(x) }}` is a TS2339 unless the
   * component exposes `Math` as a member. `emitAngular` adds a
   * `protected readonly Math = Math;` field for each entry here.
   */
  usedGlobals: string[];
  /**
   * Debug fix(33-04) (tiptap-nodeview) — true when the emitted template
   * contains an `[ngClass]="..."` binding. `[ngClass]` is NOT an Angular
   * built-in (unlike `[class]`); it requires the `NgClass` directive from
   * `@angular/common` to be in the standalone component's `imports: [...]`.
   * Without it the binding is an inert DOM property assignment and the merged
   * class is silently never applied. `emitAngular` reads this to add `NgClass`
   * to both the `@angular/common` import line AND the decorator `imports: [...]`
   * array. Same emitted-template scan plumbing as `usedGlobals`.
   */
  usesNgClass: boolean;
  /**
   * Debug fix(33-04) — true when the emitted template contains an
   * `[ngStyle]="..."` binding. Symmetric with `usesNgClass`: `[ngStyle]`
   * requires the `NgStyle` directive from `@angular/common`. The emitter's
   * multi-source style merge path emits `[ngStyle]`, so this guards the
   * directive import the same way.
   */
  usesNgStyle: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Debug fix(33-04) — detect whether the emitted Angular template references the
 * `[ngClass]` / `[ngStyle]` structural directives, which must be present in the
 * component's `imports: [...]` to function. Plain substring scan of the emitted
 * template — the emitter only ever writes those exact tokens for the
 * multi-source merge path (`[ngClass]="..."`, `[ngStyle]="..."`); a literal
 * `ngClass`/`ngStyle` cannot appear elsewhere in well-formed emitted markup.
 */
function detectNgDirectives(template: string): {
  usesNgClass: boolean;
  usesNgStyle: boolean;
} {
  return {
    usesNgClass: template.includes('[ngClass]'),
    usesNgStyle: template.includes('[ngStyle]'),
  };
}

/**
 * Well-known JS global namespaces that may legitimately appear in a `.rozie`
 * template expression (`{{ Math.round(f.size / 1024) }}`). When detected, the
 * Angular component must expose them as members so `strictTemplates` resolves
 * the reference. Quick task 260520-w18 bug class 6(ii).
 */
const KNOWN_TEMPLATE_GLOBALS: readonly string[] = [
  // Namespace globals — used as `Math.round(...)`, `JSON.stringify(...)`.
  'Math',
  'JSON',
  // Globals usable as a namespace AND as a callable/constructor —
  // `Number.isInteger(x)` / `Number(x)`, `Array.from(x)` / `Array(3)`,
  // `Object.keys(x)` / `Object(x)`, `Date.now()` / `new Date()`.
  'Number',
  'Object',
  'Array',
  'Date',
  'String',
  'Boolean',
  // Bare callable globals — used as `parseInt(x)`, `isNaN(x)`, etc. (call form
  // only; no namespace member access). These were the residual gap: the call
  // form `Global(...)` was previously undetected (see detectUsedGlobals).
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURIComponent',
  'decodeURIComponent',
];

/**
 * Scan an emitted Angular template string for a `<Global>` reference used as a
 * NAMESPACE (`Math.round(...)`) OR as a CALL / constructor (`Number(x)`,
 * `new Date()`, `parseInt(s)`). Returns the subset of KNOWN_TEMPLATE_GLOBALS
 * present, de-duplicated. Angular template expressions implicitly bind every
 * bare identifier to the component instance (`ctx.Number`), so a global is
 * unreachable unless the component exposes it as a member — emitAngular emits a
 * `protected readonly <g> = <g>;` field per detected global.
 *
 * The lookbehind `(?<![\w$.])` requires a non-identifier, non-`.` char before
 * the name so `customMath.x` / `e.Number` do not falsely match. The trailing
 * `[.(]` matches BOTH member access (`Math.`) and call/construct (`Number(`) —
 * the call form was the SortableListShowcase-angular bug (`Number($data.x)` →
 * `ctx.Number(...)` → undefined → render abort).
 */
function detectUsedGlobals(template: string): string[] {
  const found: string[] = [];
  for (const g of KNOWN_TEMPLATE_GLOBALS) {
    const re = new RegExp(`(?<![\\w$.])${g}\\s*[.(]`);
    if (re.test(template)) found.push(g);
  }
  return found;
}

export function emitTemplate(
  ir: IRComponent,
  registry: ModifierRegistry,
  opts: EmitTemplateOpts = {},
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: AngularScriptInjection[] = [];
  const hasNgModel = { value: false };
  const hasDynamicSlotFiller = { value: false };
  const hasSpreadBinding = { value: false };
  const hasListenerSpread = { value: false };
  const needsDestroyRefField = { value: false };
  const hasDisplayWrap = { value: false };

  if (ir.template === null) {
    return {
      template: '',
      scriptInjections,
      hasNgModel: false,
      hasDynamicSlotFiller: false,
      hasSpreadBinding: false,
      hasListenerSpread: false,
      needsDestroyRefField: false,
      hasDisplayWrap: false,
      usedGlobals: [],
      usesNgClass: false,
      usesNgStyle: false,
      diagnostics,
    };
  }

  const ctx: EmitNodeCtx = {
    ir,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
    hasNgModel,
    hasDynamicSlotFiller,
    hasSpreadBinding,
    hasListenerSpread,
    needsDestroyRefField,
    hasDisplayWrap,
    collisionRenames: opts.collisionRenames,
    loopBindings: new Set(),
    handlerArity: opts.handlerArity,
    classMembers: opts.classMembers,
    cvaModelProp: opts.cvaModelProp ?? null,
    cvaMergeDisabled: opts.cvaMergeDisabled ?? false,
  };

  const template = emitNode(ir.template, ctx);

  return {
    template,
    scriptInjections,
    hasNgModel: hasNgModel.value,
    hasDynamicSlotFiller: hasDynamicSlotFiller.value,
    hasSpreadBinding: hasSpreadBinding.value,
    hasListenerSpread: hasListenerSpread.value,
    needsDestroyRefField: needsDestroyRefField.value,
    hasDisplayWrap: hasDisplayWrap.value,
    usedGlobals: detectUsedGlobals(template),
    ...detectNgDirectives(template),
    diagnostics,
  };
}
