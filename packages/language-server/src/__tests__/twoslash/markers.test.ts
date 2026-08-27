/**
 * Phase 85 Plan 06 Task 1 — the marker harness's own behavior contract.
 *
 * `findMarkers` is tested on plain strings (line-resolution logic only, no
 * need for a valid `.rozie` envelope or a real language service).
 * `resolveMarkersForFile` is tested against real, valid `.rozie` fixtures
 * through `createTwoslashHarness`, because behaviors (6) and (7) are only
 * meaningful against the production generator + a real `ts.LanguageService`.
 */
import { describe, expect, it } from 'vitest';
import { createTwoslashHarness, resolveMarkersForFile } from './assertQuickInfo.js';
import { findMarkers } from './markers.js';

describe('findMarkers — line resolution', () => {
  it('a script marker resolves to the line above it', () => {
    const source = ['const canIncrement = 1', '// ^?', 'const other = 2'].join('\n');
    const hits = findMarkers(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.kind).toBe('script');
    expect(hits[0]?.markerLine).toBe(2);
    expect(hits[0]?.targetLine).toBe(1);
    expect(source.slice(...(hits[0]?.targetLineRange as [number, number]))).toBe('const canIncrement = 1');
  });

  it('a template HTML-comment marker resolves to the line above it', () => {
    const source = ['<div>{{ $props.label }}</div>', '<!-- ^? -->', '<div>next</div>'].join('\n');
    const hits = findMarkers(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.kind).toBe('template');
    expect(hits[0]?.markerLine).toBe(2);
    expect(hits[0]?.targetLine).toBe(1);
  });

  it('two markers on consecutive lines both resolve to the same target line — the nearest preceding non-marker line', () => {
    const source = ['const x = 1', '// ^?', '// ^?', 'const y = 2'].join('\n');
    const hits = findMarkers(source);
    expect(hits).toHaveLength(2);
    expect(hits[0]?.targetLine).toBe(1);
    expect(hits[1]?.targetLine).toBe(1);
    expect(hits[0]?.targetLineRange).toEqual(hits[1]?.targetLineRange);
  });

  it('a marker on the first line of the file is reported as an error, never a negative offset', () => {
    const source = ['// ^?', 'const x = 1'].join('\n');
    const hits = findMarkers(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.targetLine).toBeUndefined();
    expect(hits[0]?.error).toMatch(/no preceding/);
  });

  it('a marker below a multi-line attribute value resolves to the physical line directly above it (no special-casing)', () => {
    const source = [
      '<template>',
      '<button',
      '  :disabled="',
      '    $props.disabled',
      '  "',
      '>Click</button>',
      '<!-- ^? -->',
      '</template>',
    ].join('\n');
    const hits = findMarkers(source);
    expect(hits).toHaveLength(1);
    // The marker is on line 7; the physical line directly above it (line 6)
    // is the tag's own closing line, NOT some deeper "start of the
    // attribute" line — the rule has no attribute-awareness at all.
    expect(hits[0]?.targetLine).toBe(6);
    expect(source.slice(...(hits[0]?.targetLineRange as [number, number]))).toBe('>Click</button>');
  });

  it('recognizes but does not resolve the `^|` and `^^^` marker forms (out of scope for D5 expected-answer assertions)', () => {
    const source = ['const x = 1', '// ^|', 'const y = 2'].join('\n');
    expect(findMarkers(source)).toHaveLength(0);
  });
});

describe('resolveMarkersForFile — against the production generator + a real ts.LanguageService', () => {
  const REAL_QUICKINFO = '/virtual/twoslash/RealQuickInfoProbe.rozie';
  const realQuickInfoSource = [
    '<rozie name="RealQuickInfoProbe">',
    '<props>',
    '{',
    "  label: { type: String, default: '' },",
    '}',
    '</props>',
    '<template>',
    // No inner whitespace around the expression: `generateVirtualTs` maps
    // `rawExpr` VERBATIM starting at `loc.start + 2`, so a leading space
    // inside `{{ }}` would put the FIRST mapped offset on the space itself
    // rather than on `$props` — this fixture asserts a real identifier.
    '<div>{{$props.label}}</div>',
    '<!-- ^? -->',
    '</template>',
    '</rozie>',
    '',
  ].join('\n');

  const UNMAPPED = '/virtual/twoslash/UnmappedProbe.rozie';
  const unmappedSource = [
    '<rozie name="UnmappedProbe">',
    '<props>',
    '{',
    "  label: { type: String, default: '' },",
    '}',
    '</props>',
    '<template>',
    '<div class="static-wrapper">Just text, no bindings here</div>',
    '<!-- ^? -->',
    '</template>',
    '</rozie>',
    '',
  ].join('\n');

  const files = new Map<string, string>([
    [REAL_QUICKINFO, realQuickInfoSource],
    [UNMAPPED, unmappedSource],
  ]);
  const harness = createTwoslashHarness(files);

  it('(6) an unmapped marker (a target line with no source-mapped expression) produces an explicit unmapped result, never a silent skip', () => {
    const resolved = resolveMarkersForFile(harness, UNMAPPED, unmappedSource);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.unmapped).toBe(true);
    expect(resolved[0]?.answer).toBe('(unmapped)');
  });

  it('(7) the harness returns the real quick-info string the production generator + a real language service actually produce', () => {
    const resolved = resolveMarkersForFile(harness, REAL_QUICKINFO, realQuickInfoSource);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.unmapped).toBeUndefined();
    expect(resolved[0]?.error).toBeUndefined();
    // Asserted at the start of `$props.label` inside `{{ }}` — a real
    // ts.LanguageService answer about the `$props` value, not a stubbed one.
    expect(resolved[0]?.answer).toMatch(/\$props|__RozieProps/);
  });
});
