/**
 * renderTypesBlock — typed public surface P1 (spec §4.2).
 *
 * Renders a component's validated `<types>` block (`IRComponent.types`) back to
 * TypeScript source in SOURCE order (one generate() over the statements).
 * The single printer every target's sidecar / module placement consumes, so the
 * authored type prelude cannot drift between targets.
 *
 * Returns `''` when the component declares no `<types>` block.
 *
 * @experimental — added in typed-surface P1
 */
import _generate from '@babel/generator';
import * as t from '@babel/types';
import type { IRComponent } from '../ir/types.js';
import { typesStatementsForModule } from './typesScriptImports.js';

// Default-export interop (see synthesizeHandleType.ts / collectScriptDecls.ts).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

/** @experimental — added in typed-surface P1 */
export interface RenderTypesBlockOptions {
  /**
   * `true` for the placement INSIDE the component module (every target's
   * emitted component): `<types>` import specifiers that duplicate a `<script>`
   * import are dropped (R16, see typesScriptImports.ts). Omit for sidecar /
   * manifest renders, which have no script imports.
   */
  module?: boolean;
}

/** @experimental — added in typed-surface P1 */
export function renderTypesBlock(ir: IRComponent, opts: RenderTypesBlockOptions = {}): string {
  if (ir.types == null) return '';
  const stmts =
    opts.module === true
      ? typesStatementsForModule(ir.types.statements, ir.setupBody?.scriptProgram?.program.body)
      : ir.types.statements;
  if (stmts.length === 0) return '';
  // ONE generate() over a synthetic program: @babel/generator tracks printed
  // comments, so a comment Babel attached both as one statement's trailing and
  // the next one's leading comment prints exactly once, in place.
  return generate(t.program([...stmts])).code;
}

/**
 * The names the `<types>` block exports (to be re-exported from each leaf
 * entry). `[]` when there is no `<types>` block.
 *
 * @experimental — added in typed-surface P1
 */
export function typesExportedNames(ir: IRComponent): string[] {
  return ir.types == null ? [] : [...ir.types.exportedNames];
}
