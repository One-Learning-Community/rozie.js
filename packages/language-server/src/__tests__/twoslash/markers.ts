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
 * THREE recognized marker forms:
 *
 *   - SCRIPT (own line, resolves to the line above) — `// ^?`, copied
 *     VERBATIM from the upstream `twoslash` package's own
 *     `reAnnonateMarkers` regex (`npm pack twoslash@0.3.9`,
 *     `dist/shared/twoslash.5JIl3nlJ.mjs`), so the convention inside a
 *     `<script>` block is exactly the one every twoslash-aware editor and
 *     docs tool already recognizes. Upstream's regex also recognizes `^|`
 *     (completions) and `^^^` (range highlight); this harness only ACTS on
 *     the `?` (quick-info) group.
 *
 *   - TEMPLATE STANDALONE (own line, resolves to the line above) —
 *     `<!-- ^? -->` alone on its own line. The direct `<template>` analog of
 *     the script form, and the form Task 1's own behavior contract
 *     describes: "a marker written as an HTML comment inside a template is
 *     found and resolves to the line above it."
 *
 *   - TEMPLATE TRAILING (same line, resolves to itself) — `<!-- ^? -->`
 *     appended to the END of a line that already carries real content, e.g.
 *     `<span>{{ $props.label }}</span><!-- ^? -->`. This form was added
 *     during Task 2's inertness work (T-85-20) after empirically discovering
 *     that inserting a STANDALONE marker as a brand-new line — even a
 *     comment-only one that is dropped from the AST — is NOT inert on five
 *     of the six compile targets: those emitters preserve `<template>`
 *     whitespace close to verbatim, so removing the comment still leaves an
 *     extra blank line where its surrounding newlines were (Vue's own
 *     comment-stripping pass drops the comment TEXT but not the whitespace
 *     around it). The one placement proven byte-inert on all six targets in
 *     every case tried (`inertness.test.ts`) is a comment that adds NO new
 *     line at all — i.e. appended to an existing line's end. Every marker
 *     actually placed in the shipped `examples/*.rozie` corpus (Task 2) uses
 *     this trailing form for exactly that reason; the standalone form
 *     remains supported (and tested) because Task 1's own contract requires
 *     it, and because it is the form used adjacent to a `r-if`/`r-if`+`r-else`
 *     element, which collapses its own surrounding whitespace on every
 *     target and so tolerates a standalone marker too (see
 *     `inertness.test.ts` for the empirical record).
 *
 * TARGET-LINE RULE for the two "own line, resolves to the line above" forms
 * — stated here explicitly, not left for a future reader to infer
 * (RESEARCH.md flagged this as open): a marker asserts against the NEAREST
 * PRECEDING LINE that is (a) not itself a standalone marker line and (b)
 * not blank (whitespace-only). This single rule, with no special-casing, is
 * also the answer to the multi-line-attribute-value case: a marker placed
 * directly below the LAST physical line of a multi-line attribute value (or
 * below the tag's closing `>` that follows one) resolves to exactly that
 * physical line — whatever text happens to be on it — because that line is
 * neither blank nor a marker. A line carrying a TRAILING marker is real
 * content for this purpose and is never skipped during the walk-back.
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
   * `[start, end)` byte offsets spanning the target content, excluding a
   * trailing marker on the same line (for the TEMPLATE TRAILING form) and
   * excluding the line's own trailing newline. Absent on error.
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

/** TEMPLATE STANDALONE — the whole line is the marker, `?` (quick-info) form only. */
const TEMPLATE_STANDALONE_RE = /^\s*<!--\s*\^\?\s*-->\s*$/;

/** TEMPLATE TRAILING — the marker anchored to the END of a line that also carries other content. */
const TEMPLATE_TRAILING_RE = /<!--\s*\^\?\s*-->\s*$/;

function scriptMarkerGroup(line: string): string | undefined {
  return SCRIPT_MARKER_RE.exec(line)?.[1];
}

function isScriptQuickInfoMarker(line: string): boolean {
  return scriptMarkerGroup(line) === '?';
}

function isTemplateStandaloneMarker(line: string): boolean {
  return TEMPLATE_STANDALONE_RE.test(line);
}

/** A "marker occupies its whole line" predicate — script OR standalone-template, used by the walk-back skip rule. */
function isStandaloneMarkerLine(line: string): boolean {
  return scriptMarkerGroup(line) !== undefined || isTemplateStandaloneMarker(line);
}

/** Index (within `line`) of a valid TRAILING template marker's match, or -1 if this line does not carry one. */
function trailingTemplateMarkerIndex(line: string): number {
  if (isTemplateStandaloneMarker(line)) return -1; // standalone takes precedence over trailing
  const m = TEMPLATE_TRAILING_RE.exec(line);
  if (!m) return -1;
  const before = line.slice(0, m.index);
  return before.trim().length > 0 ? m.index : -1; // require REAL content before the marker
}

/**
 * Remove every recognized marker from `source`. Whole-line (script or
 * standalone-template) markers are removed line-and-newline entirely;
 * trailing-template markers have just their marker suffix stripped, leaving
 * the rest of their line untouched. Reproduces exactly what the file looked
 * like before any marker was added — the inertness guard
 * (`inertness.test.ts`) compiles this against the marked source and asserts
 * byte-identical output, as a STANDING regression check rather than a
 * one-time git-history diff.
 */
export function stripMarkerLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !isStandaloneMarkerLine(line))
    .map((line) => {
      const idx = trailingTemplateMarkerIndex(line);
      return idx === -1 ? line : line.slice(0, idx).replace(/\s+$/, '');
    })
    .join('\n');
}

/**
 * Find every `?`-form marker in `source`, resolving each one's target line
 * per the rules documented at the top of this file. Never throws.
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
    const isTemplateStandalone = !isScript && isTemplateStandaloneMarker(line);
    if (isScript || isTemplateStandalone) {
      const markerLine = i + 1;
      let j = i - 1;
      while (j >= 0 && ((lines[j] as string).trim() === '' || isStandaloneMarkerLine(lines[j] as string))) j--;

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
      continue;
    }

    const trailingIdx = trailingTemplateMarkerIndex(line);
    if (trailingIdx !== -1) {
      const [lineStart] = lineRanges[i] as [number, number];
      hits.push({
        kind: 'template',
        markerLine: i + 1,
        targetLine: i + 1,
        targetLineRange: [lineStart, lineStart + trailingIdx],
      });
    }
  }
  return hits;
}
