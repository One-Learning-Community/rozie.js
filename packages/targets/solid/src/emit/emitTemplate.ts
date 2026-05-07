/**
 * emitTemplate — Solid target (P1 minimal).
 *
 * Top-level template-side emitter. Walks the IR's TemplateNode tree and
 * produces a JSX string for the Solid component's return statement.
 *
 * P1 minimum: emit a valid JSX tree that is syntactically parseable.
 * P2 fills directive-accurate emission (<Show>, <For>, etc.).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import { emitSlotDecl } from './emitSlotDecl.js';

export interface EmitTemplateResult {
  jsx: string;
  diagnostics: Diagnostic[];
  ctxInterfaces: string[];
}

export function emitTemplate(
  ir: IRComponent,
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  registry: ModifierRegistry,
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const slotResult = emitSlotDecl(ir);

  if (ir.template === null) {
    return {
      jsx: 'null',
      diagnostics: [],
      ctxInterfaces: slotResult.ctxInterfaces,
    };
  }

  const ctx: EmitNodeCtx = {
    ir,
    collectors,
    registry,
    diagnostics,
  };

  const jsx = emitNode(ir.template, ctx);

  return {
    jsx,
    diagnostics,
    ctxInterfaces: slotResult.ctxInterfaces,
  };
}
