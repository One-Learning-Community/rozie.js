/**
 * Phase 85 Plan 06 (D5 / REQ-V12) — marker scanning for the twoslash-style
 * expected-answer harness.
 *
 * Everything here scans RAW SOURCE TEXT, never the AST. Verified empirically
 * (RESEARCH.md, `@rozie/core`'s own `parse()` executed against a fixture
 * carrying both marker forms): a `<script>`-block comment survives into the
 * block's own source span verbatim, because the block is re-parsed by Babel,
 * which preserves comments by default. A `<template>`-block HTML comment
 * parses cleanly (0 diagnostics) but is NOT retained as a node — the
 * surrounding text nodes show a byte gap where it was. So the AST can
 * confirm a marker did not break parsing, and it can never be used to
 * LOCATE one; only the raw string can.
 *
 * Two recognized spellings, matching the asymmetry between the two block
 * kinds:
 *
 *   - SCRIPT   `// ^?` — the `SCRIPT_MARKER_RE` below is copied VERBATIM
 *     from the upstream `twoslash` package's own `reAnnonateMarkers` regex
 *     (`npm pack twoslash@0.3.9`, `dist/shared/twoslash.5JIl3nlJ.mjs`), so
 *     the convention inside a `<script>` block is exactly the one every
 *     twoslash-aware editor and docs tool already recognizes. Upstream's
 *     regex also recognizes `^|` (completions) and `^^^` (range highlight);
 *     this harness only ACTS on the `?` (quick-info) group — the other two
 *     forms are matched (so they don't silently fall through as ordinary
 *     text) but never resolved to an assertion, which is out of scope for
 *     D5's expected-ANSWER markers.
 *   - TEMPLATE `<!-- ^? -->` — Rozie-specific. There is no HTML-comment
 *     variant in upstream twoslash and no extension point to add one
 *     (`reAnnonateMarkers` is hardcoded to `//`), so `<template>` needs its
 *     own spelling using its own native comment syntax.
 *
 * TARGET-LINE RULE — stated here explicitly, not left for a future reader
 * to infer (RESEARCH.md flagged this as open): a marker asserts against the
 * NEAREST PRECEDING LINE that is (a) not itself a marker line and (b) not
 * blank (whitespace-only). This single rule, with no special-casing, is
 * also the answer to the multi-line-attribute-value case: a marker placed
 * directly below the LAST physical line of a multi-line attribute value (or
 * below the tag's closing `>` that follows one) resolves to exactly that
 * physical line — whatever text happens to be on it — because that line is
 * neither blank nor a marker. There is nothing "attribute-aware" about the
 * rule; it does not need to be, and adding special-casing here would only
 * create a second, harder-to-verify rule to keep in sync with the first.
 *
 * A marker on the first line of a file — no preceding line exists at all —
 * is reported as an explicit error result. It never resolves to a negative
 * offset.
 */

export type MarkerKind = 'script' | 'template';

export interface MarkerHit {
  kind: MarkerKind;
  /** 1-indexed line number the marker comment itself occupies. */
  markerLine: number;
  /** 1-indexed line number the marker asserts against. Absent on error. */
  targetLine?: number;
  /**
   * `[start, end)` byte offsets spanning the target line's text, excluding
   * its trailing newline. Absent on error.
   */
  targetLineRange?: [number, number];
  /** Set when no valid target line could be resolved for this marker. */
  error?: string;
}

/**
 * Verbatim from twoslash's `reAnnonateMarkers`
 * (`/^\s*\/\/\s*\^(\?|\||\^+)( .*)?$/gm`, read without the global flag since
 * this module tests one line at a time). Group 1 distinguishes `?` (quick
 * info — the only form this harness resolves) from `|` (completions) and
 * `^+` (range highlight, one or more carets).
 */
const SCRIPT_MARKER_RE = /^\s*\/\/\s*\^(\?|\||\^+)( .*)?$/;

/** Rozie-specific `<template>` equivalent — `?` (quick-info) form only. */
const TEMPLATE_MARKER_RE = /^\s*<!--\s*\^\?\s*-->\s*$/;

function scriptMarkerGroup(line: string): string | undefined {
  return SCRIPT_MARKER_RE.exec(line)?.[1];
}

function isScriptQuickInfoMarker(line: string): boolean {
  return scriptMarkerGroup(line) === '?';
}

function isTemplateQuickInfoMarker(line: string): boolean {
  return TEMPLATE_MARKER_RE.test(line);
}

/** Any recognized marker line — quick-info form or otherwise (`^|`/`^^^` included, per the comment above). */
function isAnyMarkerLine(line: string): boolean {
  return scriptMarkerGroup(line) !== undefined || TEMPLATE_MARKER_RE.test(line);
}

/**
 * Find every `?`-form marker in `source`, resolving each one's target line
 * per the rule documented at the top of this file. Never throws.
 */
export function findMarkers(source: string): MarkerHit[] {
  const lines = source.split('\n');

  // 1-indexed-by-position line -> [startOffset, endOffsetExclusiveOfNewline).
  const lineRanges: Array<[number, number]> = [];
  {
    let offset = 0;
    for (const line of lines) {
      lineRanges.push([offset, offset + line.length]);
      offset += line.length + 1; // account for the '\n' the split() consumed
    }
  }

  const hits: MarkerHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const isScript = isScriptQuickInfoMarker(line);
    const isTemplate = isTemplateQuickInfoMarker(line);
    if (!isScript && !isTemplate) continue;

    const markerLine = i + 1;
    let j = i - 1;
    while (j >= 0 && ((lines[j] as string).trim() === '' || isAnyMarkerLine(lines[j] as string))) j--;

    if (j < 0) {
      hits.push({
        kind: isScript ? 'script' : 'template',
        markerLine,
        error: `marker on line ${markerLine} has no preceding non-blank, non-marker line to assert against`,
      });
      continue;
    }

    hits.push({
      kind: isScript ? 'script' : 'template',
      markerLine,
      targetLine: j + 1,
      targetLineRange: lineRanges[j] as [number, number],
    });
  }
  return hits;
}
