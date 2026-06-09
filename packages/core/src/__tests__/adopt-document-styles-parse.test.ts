// Item 3 (engine-CSS shadow bridge) — `<rozie adopt-document-styles>` parse +
// per-target lowering.
//
// `adopt-document-styles` is the boolean attribute on the `<rozie>` envelope tag
// that opts a component into cloning the document's same-origin stylesheets into
// its shadow root (Lit) so a consumer-imported engine stylesheet reaches the
// engine DOM that lives inside the shadow boundary. `splitBlocks` extracts it
// onto `BlockMap.rozie.adoptDocumentStyles`:
//   - `adopt-document-styles`              → adoptDocumentStyles === true
//   - `adopt-document-styles="false"`      → adoptDocumentStyles === false
//   - attribute absent                     → key omitted (undefined) → false in IR
//
// On the Lit target the emit gains `adoptDocumentStyles(this);` in firstUpdated()
// plus the runtime import; the other 5 targets are no-ops (byte-unchanged).
import { describe, it, expect } from 'vitest';
import { splitBlocks } from '../splitter/splitBlocks.js';
import { compile } from '../index.js';

function withRozieTag(openTag: string): string {
  return `${openTag}
<template><div ref="el"></div></template>
</rozie>
`;
}

describe('<rozie adopt-document-styles> parse', () => {
  it('present-without-value → adoptDocumentStyles === true', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" adopt-document-styles>'),
    );
    expect(result.rozie, 'rozie envelope should be present').toBeDefined();
    expect(result.rozie!.adoptDocumentStyles).toBe(true);
  });

  it('adopt-document-styles="false" → adoptDocumentStyles === false', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" adopt-document-styles="false">'),
    );
    expect(result.rozie!.adoptDocumentStyles).toBe(false);
  });

  it('no attribute → adoptDocumentStyles key omitted (undefined)', () => {
    const result = splitBlocks(withRozieTag('<rozie name="X">'));
    expect(result.rozie!.adoptDocumentStyles).toBeUndefined();
  });

  it('adopt-document-styles="False" → false (WR-05 case-insensitive)', () => {
    const result = splitBlocks(
      withRozieTag('<rozie name="X" adopt-document-styles="False">'),
    );
    expect(result.rozie!.adoptDocumentStyles).toBe(false);
  });
});

describe('<rozie adopt-document-styles> per-target emit', () => {
  const src = withRozieTag('<rozie name="X" adopt-document-styles>');

  it('Lit: emits adoptDocumentStyles(this) in firstUpdated + the runtime import', async () => {
    const out = await compile(src, { target: 'lit', filename: 'X.rozie' });
    expect(out.diagnostics.some((d) => d.severity === 'error')).toBe(false);
    expect(out.code).toContain('adoptDocumentStyles(this);');
    expect(out.code).toMatch(
      /import\s*\{[^}]*adoptDocumentStyles[^}]*\}\s*from\s*'@rozie\/runtime-lit'/,
    );
  });

  it.each(['react', 'vue', 'svelte', 'angular', 'solid'] as const)(
    '%s: no-op (no adoptDocumentStyles reference)',
    async (target) => {
      const out = await compile(src, { target, filename: 'X.rozie' });
      expect(out.diagnostics.some((d) => d.severity === 'error')).toBe(false);
      expect(out.code).not.toContain('adoptDocumentStyles');
    },
  );
});
