// D-12 / Success Criterion 5 — off-by-one regression guard scaffold (Plan 01 / Wave 0)
// Implementation lands in Plans 02-04. Anchors paths per RESEARCH.md Pitfall 8.
//
// Per D-12, source locations are threaded from day one — never retroactively.
// This file is the regression guard: pick a known token in each example and
// assert ast.loc.start === source.indexOf(token) exactly. Catches
// off-by-one drift early (RESEARCH.md Pitfall 1).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');

describe('source-locations (D-12 / Success Criterion 5)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  // D-12: off-by-one regression — assert per-example, per-block byte offsets match source.indexOf(token)
  it.todo('off-by-one regression: Counter.rozie — `value` token in <props> block has node.loc.start === source.indexOf("value")');
  it.todo('off-by-one regression: SearchInput.rozie — `r-model` attribute on <input> has node.loc.start === source.indexOf("r-model")');
  it.todo('off-by-one regression: Dropdown.rozie — `document:click.outside` listener key has node.loc.start === source.indexOf("document:click.outside")');
  it.todo('off-by-one regression: TodoList.rozie — `r-for` directive has node.loc.start === source.indexOf("r-for")');
  it.todo('off-by-one regression: Modal.rozie — first `$onMount` call has node.loc.start === source.indexOf("$onMount")');
  it.todo('off-by-one regression: empty <props></props> contentLoc.start === contentLoc.end (Pitfall 1)');
});
