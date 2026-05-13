/**
 * emitTemplateNode — per-node helper.
 *
 * emitTemplate is the orchestrator; this module exposes a convenience helper
 * that walks one node in isolation (with synthesized collectors when not
 * supplied). Used by unit tests that target a single node shape.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateNode, IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate, type EmitTemplateOpts } from './emitTemplate.js';
import {
  LitImportCollector,
  LitDecoratorImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';

export function emitTemplateNode(
  node: TemplateNode,
  ir: IRComponent,
  opts?: Partial<EmitTemplateOpts>,
): string {
  const lit = opts?.lit ?? new LitImportCollector();
  const decorators = opts?.decorators ?? new LitDecoratorImportCollector();
  const runtime = opts?.runtime ?? new RuntimeLitImportCollector();
  const wrapped: IRComponent = { ...ir, template: node };
  const result = emitTemplate(wrapped, { lit, decorators, runtime });
  return result.renderBody;
}
