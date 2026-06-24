/**
 * buildPropJsdoc — Phase 58 Plan 03 (SC-2/SC-3).
 *
 * The framework-AGNOSTIC, single-source JSDoc-block builder for a documented
 * prop. This is the load-bearing ANTI-DRIFT precedent set by
 * `renderPropsInterface`: ONE deterministic string builder, consumed by every
 * surface that emits per-prop JSDoc — the shared `.d.ts`/`.d.rozie.ts` renderer
 * (`renderPropsInterface`, which feeds all six published type surfaces) AND the
 * five trivial in-source targets (React / Solid interface members, Svelte's
 * `buildPropsInterfaceFields`, Angular's `input()`/`model()` class fields, Lit's
 * `@property` fields). A copy-paste of the description-to-JSDoc mapping into six
 * files would guarantee eventual drift; one builder guarantees cross-framework
 * JSDoc parity.
 *
 * Mapping (from `PropDecl.docs`, lowered in Plan 02):
 *   - `description`           → the JSDoc summary leading line(s)
 *   - `deprecated: true`      → a bare `@deprecated` tag
 *   - `deprecated: '<msg>'`   → an `@deprecated <msg>` tag
 *   - `example: '<text>'`     → an `@example` tag followed by the verbatim
 *                               string on the next line (NO language fence —
 *                               Open Question 2 resolution)
 *
 * GATING (SC-5 byte-identity): returns `''` for a docless prop AND for an
 * all-empty docs object — the inert path. Callers push the result ONLY when it
 * is non-empty, so a prop without docs takes the exact existing code path and
 * stays byte-identical to today's output.
 *
 * DETERMINISM (T-58-05): a pure string builder — no prettier, no locale-aware
 * formatting. The 2-space-by-default indent and `' * '` continuation are fixed
 * so the four entrypoints (compile / CLI / babel / unplugin) stay byte-equal.
 *
 * COMMENT-INJECTION (T-58-04): author-controlled docs strings are interpolated
 * INSIDE a JSDoc block, so a string containing the comment terminator (a star
 * followed by a slash) could otherwise close the block early and escape into
 * code. Every docs string is neutralized via `escapeCommentClose` first.
 *
 * @experimental — shape may change before v1.0
 */
import type { PropDecl } from '../ir/types.js';

/**
 * Neutralize the JSDoc comment terminator inside an author-controlled string so
 * it cannot prematurely close the emitted comment block (T-58-04). Replaces each
 * `star + slash` terminator with `star + backslash + slash` — the backslash
 * breaks the terminator token while keeping the text legible; the escaped form
 * never re-introduces a bare terminator.
 */
function escapeCommentClose(s: string): string {
  return s.replace(/\*\//g, '*\\/');
}

/**
 * Render a leading JSDoc block (including its trailing newline) for a prop, or
 * `''` when the prop carries no docs (or only an empty docs object).
 *
 * @param prop   the lowered prop whose `docs` field drives the block
 * @param indent leading indent matching the consuming site's prop indent
 *               (default `'  '` — the 2-space interface-member indent shared by
 *               every target)
 * @returns the `${indent}/**\n … \n${indent} *​/\n` block, or `''` (inert).
 *
 * @public — consumed by `renderPropsInterface` and the five in-source targets.
 */
export function buildPropJsdoc(prop: PropDecl, indent = '  '): string {
  const d = prop.docs;
  if (!d || (!d.description && d.deprecated === undefined && !d.example)) {
    return '';
  }

  const body: string[] = [];
  if (d.description) body.push(escapeCommentClose(d.description));
  if (d.deprecated !== undefined) {
    body.push(
      typeof d.deprecated === 'string'
        ? `@deprecated ${escapeCommentClose(d.deprecated)}`
        : '@deprecated',
    );
  }
  if (d.example) body.push(`@example\n${escapeCommentClose(d.example)}`);

  const lines = body.join('\n').split('\n');
  const rendered = lines.map((l) => `${indent} * ${l}`.trimEnd()).join('\n');
  return `${indent}/**\n${rendered}\n${indent} */\n`;
}
