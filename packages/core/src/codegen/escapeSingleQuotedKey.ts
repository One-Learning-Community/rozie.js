/**
 * escapeSingleQuotedKey / renderRecordKey — Phase 79 (WR-05, 79-REVIEW-FIX).
 *
 * The single source of truth for escaping an author-supplied slot/fill name
 * for use as a single-quoted string-literal object key or bracket-lookup
 * key. Backslash is escaped FIRST (so a backslash inserted by the
 * quote-escape step is not itself re-escaped), then single quotes.
 *
 * Prior to this fix, this exact one-line predicate (and its one-line
 * `renderRecordKey` wrapper) was independently reimplemented in `core` and
 * every one of the six target packages — all byte-identical. This phase
 * explicitly established the "one predicate, every consumer imports it"
 * pattern for exactly this kind of shared codegen logic (see
 * `slotNameIdentifier.ts`, `slotParamTypeLowering.ts` — both carry a doc
 * comment stating "a second copy anywhere is a defect") but did not apply it
 * here. `escapeSingleQuotedKey` is the same category of shared,
 * security-relevant logic: it is what prevents a quote/backslash in an
 * author-supplied slot name from breaking out of an emitted string literal —
 * a real, if narrow, code-injection surface if the escaping is ever wrong in
 * one copy and not the others.
 *
 * This is a PURE REFACTOR — every call site's output is byte-identical
 * before and after, proven by dist-parity (see 79-REVIEW-FIX.md).
 *
 * @experimental — shape may change before v1.0
 */

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped),
 * then single quotes.
 */
export function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Render a single-quoted, escaped bracket-lookup / object-literal key for
 * `name`, so a quote/backslash in the author's slot name cannot break out of
 * the emitted string literal.
 */
export function renderRecordKey(name: string): string {
  return `'${escapeSingleQuotedKey(name)}'`;
}
