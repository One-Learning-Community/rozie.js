/**
 * README event-table payload cells (typed-surface P1, final fix wave M1): a
 * payload type printed into a Markdown table cell must stay ONE line and must
 * escape `|` (a union) so it cannot split the row. Rendered through the
 * shared packages/ui/readme-type-cell.mjs helper.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry, lowerToIR, parse, parseAuthoredType } from '@rozie/core';
// @ts-expect-error — untyped .mjs codegen helper
import { renderReadme } from '../scripts/readme.mjs';
// @ts-expect-error — untyped .mjs codegen helper
import { handleManifest } from '../scripts/handle-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, '../src/Popover.rozie'), 'utf8');

describe('README payload cells', () => {
  it('collapse whitespace and escape | in a printed payload type', () => {
    const { ast } = parse(source, { filename: 'Popover.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry(), filename: resolve(HERE, '../src/Popover.rozie') });
    const parsed = parseAuthoredType("{ kind: 'a' | 'b'; nested: { deep: number; other: string } }");
    if ('error' in parsed) throw new Error(parsed.error);
    // Popover declares no events of its own (release-0.8.0 audit B6 removed
    // `change`), so inject a synthetic declaration to exercise the cell.
    const decl = { name: 'probe', payload: parsed.type, docs: null, sourceLoc: { start: 0, end: 0 } };
    ir!.emitDecls!.push(decl);
    const md: string = renderReadme('react', ir, '@rozie-ui/popover-react', handleManifest);
    const row = md.split('\n').find((l) => l.startsWith(`| \`${decl.name}\` |`));
    expect(row).toBeDefined();
    expect(row).toContain("'a' \\| 'b'");
    expect(row).not.toMatch(/[^\\]\| 'b'/);
    expect(row).toMatch(/\{ kind: 'a' \\\| 'b'; nested: \{ deep: number; other: string; \}; \}/);
  });
});
