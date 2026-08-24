/**
 * buildPropJsdoc — Phase 58 Plan 03 (SC-2/SC-3); target-parameterised in
 * Phase 81 Plan 02 (R1/R4/P1).
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
 *   - `example: '<text>'`     → an `@example` tag followed by the string,
 *                               PARSED and RE-RENDERED as target-correct
 *                               consumer markup (Phase 81 Plan 02, via
 *                               `renderExampleMarkup`) on the next line (NO
 *                               language fence — Open Question 2 resolution).
 *                               An example whose content is not renderable
 *                               element markup (prose, a code snippet) falls
 *                               through unchanged — `renderExampleMarkup` is
 *                               classify-first, identity-passthrough.
 *
 * GATING (SC-5 byte-identity): returns `''` for a docless prop AND for an
 * all-empty docs object — the inert path. Callers push the result ONLY when it
 * is non-empty, so a prop without docs takes the exact existing code path and
 * stays byte-identical to today's output. An example that is empty or
 * whitespace-only is likewise treated as absent (Phase 81 Plan 02, R4) — a
 * docs object whose ONLY populated key is a whitespace-only example produces
 * the same `''` inert output as a fully docless prop.
 *
 * DETERMINISM (T-58-05): a pure string builder — no prettier, no locale-aware
 * formatting. The 2-space-by-default indent and `' * '` continuation are fixed
 * so the four entrypoints (compile / CLI / babel / unplugin) stay byte-equal.
 *
 * COMMENT-INJECTION (T-58-04, amended Phase 81 Plan 02 / prohibition P1):
 * author-controlled docs strings are interpolated INSIDE a JSDoc block, so a
 * string containing the comment terminator (a star followed by a slash) could
 * otherwise close the block early and escape into code. Every docs string is
 * neutralized via `escapeCommentClose` first — EXCEPT the example, whose
 * neutralization now runs AFTER the per-target render. The rendered example
 * is a DIFFERENT string from the authored one (attribute reordering, model
 * expansion into two attributes, tag rewriting), so a terminator neutralized
 * on the raw input could land somewhere the render moved it, or the render
 * could introduce fresh text — escaping the input alone does not guarantee
 * the emitted text is safe. `description` and `deprecated` are never routed
 * through a renderer, so they keep neutralizing their own raw strings.
 *
 * The `target` parameter is REQUIRED, not defaulted (SPEC decision D-06): an
 * optional target would silently become the wrong-output path for any caller
 * that forgot to pass one, and a two-argument call is a compile-time error by
 * design. `hasPropJsdoc` stays target-free — it is a pure presence predicate,
 * decoupled from the builder's per-target output format (WR-02).
 *
 * @experimental — shape may change before v1.0
 */
import type { PropDecl } from '../ir/types.js';
import type { CompileTarget } from '../compile.js';
import { renderExampleMarkup } from './renderExampleMarkup.js';

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
 * Whether a prop would produce a non-empty JSDoc block — true iff it carries a
 * `docs` object with at least one usable sub-key. This is the single source of
 * truth for the SC-5 "is this prop documented?" gate: `buildPropJsdoc` returns
 * `''` exactly when this returns `false`, so callers that need only the
 * empty/non-empty decision (e.g. Vue's multi-line-vs-compact `renderPropsTypeBody`
 * gate) MUST consult this predicate rather than calling `buildPropJsdoc` with a
 * throwaway indent — that keeps the gate decoupled from the builder's output
 * format and immune to any future indent-dependent change to the block (WR-02).
 *
 * @public — consumed by `buildPropJsdoc` itself and by per-target emit gates.
 */
export function hasPropJsdoc(prop: PropDecl): boolean {
  const d = prop.docs;
  return !!d && (!!d.description || d.deprecated !== undefined || !!d.example?.trim());
}

/**
 * Render a leading JSDoc block (including its trailing newline) for a prop, or
 * `''` when the prop carries no docs (or only an empty/whitespace-only docs
 * object).
 *
 * @param prop   the lowered prop whose `docs` field drives the block
 * @param target the compile target whose notation the `example` key (if any)
 *               is rendered into — REQUIRED, not defaulted (SPEC decision
 *               D-06); see the module header's COMMENT-INJECTION note for why
 *               an optional target is unsafe.
 * @param indent leading indent matching the consuming site's prop indent
 *               (default `'  '` — the 2-space interface-member indent shared by
 *               every target)
 * @returns the `${indent}/**\n … \n${indent} *​/\n` block, or `''` (inert).
 *
 * @public — consumed by `renderPropsInterface` and the five in-source targets.
 */
export function buildPropJsdoc(prop: PropDecl, target: CompileTarget, indent = '  '): string {
  if (!hasPropJsdoc(prop)) {
    return '';
  }
  const d = prop.docs!;

  const body: string[] = [];
  if (d.description) body.push(escapeCommentClose(d.description));
  if (d.deprecated !== undefined) {
    body.push(
      typeof d.deprecated === 'string'
        ? `@deprecated ${escapeCommentClose(d.deprecated)}`
        : '@deprecated',
    );
  }
  if (d.example && d.example.trim() !== '') {
    // Render FIRST, then neutralize the comment terminator on what is
    // actually emitted (prohibition P1) — the rendered string can differ
    // from the authored one (attribute reordering, model expansion, tag
    // rewriting), so escaping the raw input would not protect the emitted
    // text.
    const renderedExample = renderExampleMarkup(d.example, target);
    body.push(`@example\n${escapeCommentClose(renderedExample)}`);
  }

  const lines = body.join('\n').split('\n');
  const rendered = lines.map((l) => `${indent} * ${l}`.trimEnd()).join('\n');
  return `${indent}/**\n${rendered}\n${indent} */\n`;
}
