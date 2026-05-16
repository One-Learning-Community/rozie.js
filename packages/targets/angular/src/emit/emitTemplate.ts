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
  diagnostics: Diagnostic[];
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
  };

  const template = emitNode(ir.template, ctx);

  return {
    template,
    scriptInjections,
    hasNgModel: hasNgModel.value,
    hasDynamicSlotFiller: hasDynamicSlotFiller.value,
    diagnostics,
  };
}
