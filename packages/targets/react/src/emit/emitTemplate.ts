/**
 * emitTemplate — Plan 04-03 Task 3 (React target).
 *
 * Top-level template-side emitter. Walks the IR's TemplateNode tree and
 * produces:
 *
 *   - jsx — the JSX body string (what goes inside `return ( ... );`)
 *   - scriptInjections — top-of-component-body lines (lifted default-content
 *     functions, modifier-helper wraps like useDebouncedCallback consts)
 *   - slotPropFields — interface FooProps lines (e.g., 'children?: ReactNode;')
 *   - slotCtxInterfaces — standalone interface declarations
 *     (e.g., 'interface TriggerCtx { open: any; toggle: any; }')
 *   - diagnostics — collected diagnostics (D-08 collected-not-thrown)
 *
 * Empty template (ir.template === null) returns 'null' for the jsx field so
 * the function body's `return ( null );` still type-checks under JSX.Element.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import { emitSlotDecl } from './emitSlotDecl.js';

export interface EmitTemplateResult {
  jsx: string;
  scriptInjections: string[];
  slotPropFields: string[];
  slotCtxInterfaces: string[];
  diagnostics: Diagnostic[];
}

export function emitTemplate(
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
  registry: ModifierRegistry,
): EmitTemplateResult {
  const slotResult = emitSlotDecl(ir);
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: string[] = [];

  if (ir.template === null) {
    return {
      jsx: 'null',
      scriptInjections: [],
      slotPropFields: slotResult.slotPropFields,
      slotCtxInterfaces: slotResult.slotCtxInterfaces,
      diagnostics: [],
    };
  }

  const ctx: EmitNodeCtx = {
    ir,
    collectors,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
  };

  const jsx = emitNode(ir.template, ctx);

  return {
    jsx,
    scriptInjections,
    slotPropFields: slotResult.slotPropFields,
    slotCtxInterfaces: slotResult.slotCtxInterfaces,
    diagnostics,
  };
}
