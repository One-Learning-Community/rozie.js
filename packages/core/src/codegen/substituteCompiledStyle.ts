/**
 * substituteCompiledStyle — Phase 10 Plan 04 (Pattern 2, SPEC-REQ-2).
 *
 * The single highest-risk plumbing item in the SCSS phase.
 *
 * All six `emitStyle.ts` files reconstruct CSS by slicing rule bodies out of
 * `opts.source` — the original `.rozie` string — at absolute byte offsets
 * (`source.slice(rule.loc.start, rule.loc.end)`). For a `<style lang="scss">`
 * block, `parseStyle` (Plan 10-03) compiled the SCSS body to plain CSS and
 * built every `StyleRule.loc` against that COMPILED CSS — a string that exists
 * nowhere in the raw `.rozie`. SPEC-REQ-2's "the six emitStyle.ts files require
 * no modification" therefore holds ONLY if the compiled CSS is spliced into the
 * style-block region of the source string the emitters receive.
 *
 * This helper performs that splice. It is the one shared implementation —
 * `compile.ts` (covering CLI + babel-plugin, which both call `compile()`) and
 * every per-target pipeline in `@rozie/unplugin`'s `transform.ts` call it
 * after `parse()` and before constructing the emit options object.
 *
 * CRITICAL — the splice target is `ast.style.loc`, the body-only content span.
 * `StyleAST` exposes exactly ONE location field, `loc`, and `parseStyle.ts`
 * assigns it the `contentLoc` (the body span between `<style ...>` and
 * `</style>`, NOT the full block span). `parseStyle` anchors every
 * `StyleRule.loc` at `contentLoc.start + <relative offset>`. So splicing
 * `cssText` into `[ast.style.loc.start, ast.style.loc.end)` lands the compiled
 * CSS at exactly the offset base the emitters slice against. Splicing into a
 * full-`<style>`-block span instead would shift every emitter CSS slice by the
 * opening-tag byte length, producing garbage CSS in all six targets.
 *
 * For a plain-CSS component (no `<style>` block, or `lang` absent / `'css'` /
 * any non-`scss` value) the helper returns `source` unchanged byte-for-byte —
 * so the eleven pre-existing plain-CSS dist-parity baselines are unaffected
 * (SPEC-REQ-8). The helper is pure (mutates neither argument) and synchronous.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';

/**
 * Splice the compiled SCSS-to-CSS output into the style-block body byte range
 * of `source` when the component's `<style>` block is `lang="scss"`.
 *
 * @param source - The original `.rozie` source string.
 * @param ast    - The parsed RozieAST. `ast.style.cssText` holds the compiled
 *                 plain CSS for `lang="scss"` blocks (Plan 10-03); `ast.style.loc`
 *                 is the body-only content span.
 * @returns `source` with the `[ast.style.loc.start, ast.style.loc.end)` byte
 *          range replaced by `ast.style.cssText` for a `lang="scss"` block;
 *          `source` unchanged for any other case.
 */
export function substituteCompiledStyle(source: string, ast: RozieAST): string {
  const style = ast.style;
  if (!style) return source;

  // Mirror parseStyle's `normalizedLang` resolution (D-01) — case-insensitive
  // and trimmed. Only `'scss'` triggers the splice; `'css'`, absent, or any
  // other value is the plain-CSS path (byte-identical, SPEC-REQ-8).
  const normalizedLang = style.lang?.trim().toLowerCase();
  if (normalizedLang !== 'scss') return source;

  // Splice the compiled CSS into the body-only content span. `ast.style.loc`
  // IS that span (see file-level comment) — the exact offset base every
  // `StyleRule.loc` was anchored against by parseStyle.
  return (
    source.slice(0, style.loc.start) +
    style.cssText +
    source.slice(style.loc.end)
  );
}
