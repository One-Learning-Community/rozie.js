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
   * Quick task 260520-w18 bug class 6(ii) — well-known JS global namespaces
   * (`Math`, `JSON`, …) referenced inside template expressions. Angular's
   * `strictTemplates` resolves bare template identifiers against the
   * component instance, so `{{ Math.round(x) }}` is a TS2339 unless the
   * component exposes `Math` as a member. `emitAngular` adds a
   * `protected readonly Math = Math;` field for each entry here.
   */
  usedGlobals: string[];
  diagnostics: Diagnostic[];
}

/**
 * Well-known JS global namespaces that may legitimately appear in a `.rozie`
 * template expression (`{{ Math.round(f.size / 1024) }}`). When detected, the
 * Angular component must expose them as members so `strictTemplates` resolves
 * the reference. Quick task 260520-w18 bug class 6(ii).
 */
const KNOWN_TEMPLATE_GLOBALS: readonly string[] = [
  'Math',
  'JSON',
  'Number',
  'Object',
  'Array',
  'Date',
  'String',
  'Boolean',
];

/**
 * Scan an emitted Angular template string for `<Global>.` member-access usage
 * (e.g. `Math.round(...)`). Returns the subset of KNOWN_TEMPLATE_GLOBALS that
 * appear as a namespace, de-duplicated. The regex requires a word boundary
 * before the name so `customMath.x` does not falsely match `Math`.
 */
function detectUsedGlobals(template: string): string[] {
  const found: string[] = [];
  for (const g of KNOWN_TEMPLATE_GLOBALS) {
    const re = new RegExp(`(?<![\\w$.])${g}\\s*\\.`);
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

  if (ir.template === null) {
    return {
      template: '',
      scriptInjections,
      hasNgModel: false,
      hasDynamicSlotFiller: false,
      usedGlobals: [],
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
    collisionRenames: opts.collisionRenames,
    loopBindings: new Set(),
    handlerArity: opts.handlerArity,
    classMembers: opts.classMembers,
  };

  const template = emitNode(ir.template, ctx);

  return {
    template,
    scriptInjections,
    hasNgModel: hasNgModel.value,
    hasDynamicSlotFiller: hasDynamicSlotFiller.value,
    usedGlobals: detectUsedGlobals(template),
    diagnostics,
  };
}
