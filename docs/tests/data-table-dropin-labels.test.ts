// Every documented data-table drop-in usage must hand the drop-in its column's header label.
//
// The `#filter` / `#editor` slot scope carries `columnLabel` (the column's header text), and all
// eight drop-ins accept it as their accessible name. Without it they fall back to the raw column
// id, so a screen reader announces "name" / "level min" instead of "Name" / "Level min". The
// spread forms (`{...scope}`, `v-bind="scope"`) forward it for free; the Angular and Lit examples
// list their inputs one by one and the demo page lists props explicitly — those had dropped it,
// and consumers copy these snippets verbatim.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
const FILES = [
  ...TARGETS.map((t) => `packages/ui/data-table/packages/${t}/README.md`),
  'docs/components/data-table-usage.md',
  'docs/components/data-table-demo.md',
];

// One drop-in element as authored: PascalCase (`<FilterText …/>`) or custom-element
// (`<rozie-filter-text …>`), up to the end of its opening tag. `[^>]` spans newlines, and no
// attribute value in these snippets contains `>`.
const DROPIN = /<(?:(?:Filter|Editor)(?:Text|Select|NumberRange|Number|Date|Checkbox)|rozie-(?:filter|editor)-[a-z-]+)\b[^>]*>/g;
// Forwards the whole scope, and so `columnLabel` with it.
const SPREADS = /\{\s*\.\.\.\s*scope\s*\}|v-bind="scope"/;

describe('documented data-table drop-in usages', () => {
  it('pass the column header label (or spread the scope that carries it)', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const rel of FILES) {
      const src = readFileSync(ROOT + rel, 'utf8');
      for (const m of src.matchAll(DROPIN)) {
        const tag = m[0];
        // Prose mentions like `<EditorSelect>` in a sentence carry no props — not a usage.
        if (!/[\s\n]/.test(tag.slice(1, -1))) continue;
        seen++;
        if (SPREADS.test(tag) || /columnLabel/.test(tag)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${rel}:${line}  ${tag.split(/\s/)[0]}`);
      }
    }
    // Guard against the regex silently matching nothing (a vacuous pass).
    expect(seen).toBeGreaterThan(40);
    expect(offenders).toEqual([]);
  });
});
