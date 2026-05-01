// PARSE-06 — <style> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 03. Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseStyle (PARSE-06)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  it.todo('Dropdown.rozie :root { ... } rule detected as unscoped escape hatch (per scoped-styles default)');
  it.todo('Dropdown.rozie scoped rules parsed with byte-accurate source.start.offset / end.offset on each rule');
  it.todo('multi-part selector ":root, .foo" flagged via ROZ081 per RESEARCH.md Pitfall 6');
  it.todo('emits ROZ080 on PostCSS parse error in <style>');
});
