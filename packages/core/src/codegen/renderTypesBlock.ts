/**
 * renderTypesBlock — typed public surface P1 (spec §4.2).
 *
 * Renders a component's validated `<types>` block (`IRComponent.types`) back to
 * TypeScript source: each statement generated in SOURCE order, joined by `\n`.
 * The single printer every target's sidecar / module placement consumes, so the
 * authored type prelude cannot drift between targets.
 *
 * Returns `''` when the component declares no `<types>` block.
 *
 * @experimental — added in typed-surface P1
 */
import _generate from '@babel/generator';
import type { IRComponent } from '../ir/types.js';

// Default-export interop (see synthesizeHandleType.ts / collectScriptDecls.ts).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

/** @experimental — added in typed-surface P1 */
export function renderTypesBlock(ir: IRComponent): string {
  if (ir.types === null) return '';
  const stmts = ir.types.statements;
  return stmts
    .map((stmt, i) => {
      // Babel attaches a comment BETWEEN two statements to both — the previous
      // statement's `trailingComments` and the next one's `leadingComments`.
      // Each statement is generated on its own here, so drop the trailing copy
      // the next statement will print as its leading comment (else it doubles).
      const nextLeading = stmts[i + 1]?.leadingComments ?? [];
      const trailing = stmt.trailingComments ?? [];
      const sameComment = (a: { start?: number | null }, b: { start?: number | null }): boolean =>
        a === b || (a.start != null && a.start === b.start);
      const kept = trailing.filter((c) => !nextLeading.some((n) => sameComment(c, n)));
      if (kept.length === trailing.length) return generate(stmt).code;
      return generate({ ...stmt, trailingComments: kept.length > 0 ? kept : null } as typeof stmt).code;
    })
    .join('\n');
}

/**
 * The names the `<types>` block exports (to be re-exported from each leaf
 * entry). `[]` when there is no `<types>` block.
 *
 * @experimental — added in typed-surface P1
 */
export function typesExportedNames(ir: IRComponent): string[] {
  return ir.types === null ? [] : [...ir.types.exportedNames];
}
