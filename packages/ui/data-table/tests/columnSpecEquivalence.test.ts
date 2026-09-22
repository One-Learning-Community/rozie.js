/**
 * columnSpecEquivalence.test.ts — C-09, quick task 260921-tsu.
 *
 * `<Column>`'s re-register `$watch` keys on `$props.editorOptions`, `$props.aggregationFn` and
 * `$props.validate`, all reference types whose DOCUMENTED wiring is an inline literal
 * (`:editorOptions="[{ value: 'a' }, …]"`, `:validate="(v) => v !== ''"`). An inline literal is
 * a new identity on every consumer render, so the watch fired every render, `registerColumn`
 * whole-object-replaced `$data.colReg`, the parent's re-feed watch keys on `$data.colReg`, the
 * re-feed re-rendered the parent — and the next render produced a new identity again. Not a
 * slow path: a feedback loop.
 *
 * `columnSpecsEquivalent` is the guard `registerColumn` consults before writing. What it has to
 * get right is narrow and specific: an inline arrow re-created each render (different identity,
 * identical source) must compare EQUAL, while a genuinely different validator must not.
 *
 * RED before the fix: the export did not exist.
 */
import { describe, it, expect } from 'vitest';
import { columnSpecsEquivalent } from '../src/helpers/columnDefUtils';

const spec = (over: Record<string, unknown> = {}) => ({
  id: 'status',
  field: 'status',
  header: 'Status',
  sortable: true,
  filterable: false,
  editable: true,
  editor: 'select',
  editorOptions: [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
  validate: null,
  ...over,
});

describe('columnSpecsEquivalent', () => {
  it('treats two structurally identical specs built independently as equivalent', () => {
    // This IS the render-to-render case: same author source, two separate object graphs.
    const a = spec();
    const b = spec();
    expect(a).not.toBe(b);
    expect(a.editorOptions).not.toBe(b.editorOptions);
    expect(columnSpecsEquivalent(a, b)).toBe(true);
  });

  it('treats an inline arrow re-created each render as equivalent', () => {
    const build = () => spec({ validate: (v: unknown) => v !== '' });
    const a = build();
    const b = build();
    expect(a.validate).not.toBe(b.validate);
    expect(columnSpecsEquivalent(a, b)).toBe(true);
  });

  it('does NOT treat a genuinely different validator as equivalent', () => {
    const a = spec({ validate: (v: unknown) => v !== '' });
    const b = spec({ validate: (v: unknown) => v !== null });
    expect(columnSpecsEquivalent(a, b)).toBe(false);
  });

  it('catches a changed option value, label, count and order', () => {
    const base = spec();
    expect(columnSpecsEquivalent(base, spec({ editorOptions: [{ value: 'active', label: 'Live' }, { value: 'archived', label: 'Archived' }] }))).toBe(false);
    expect(columnSpecsEquivalent(base, spec({ editorOptions: [{ value: 'active', label: 'Active' }] }))).toBe(false);
    expect(columnSpecsEquivalent(base, spec({ editorOptions: [{ value: 'archived', label: 'Archived' }, { value: 'active', label: 'Active' }] }))).toBe(false);
  });

  it('catches a changed scalar, an added key and a removed key', () => {
    expect(columnSpecsEquivalent(spec(), spec({ header: 'State' }))).toBe(false);
    expect(columnSpecsEquivalent(spec(), spec({ sortable: false }))).toBe(false);
    const extra = { ...spec(), pinned: 'left' };
    expect(columnSpecsEquivalent(spec(), extra)).toBe(false);
    expect(columnSpecsEquivalent(extra, spec())).toBe(false);
  });

  it('does not confuse null, undefined, 0, "" and false', () => {
    expect(columnSpecsEquivalent({ v: null }, { v: undefined })).toBe(false);
    expect(columnSpecsEquivalent({ v: 0 }, { v: '' })).toBe(false);
    expect(columnSpecsEquivalent({ v: 0 }, { v: false })).toBe(false);
    expect(columnSpecsEquivalent({ v: '' }, { v: false })).toBe(false);
  });

  it('distinguishes an array from an object with the same numeric keys', () => {
    expect(columnSpecsEquivalent({ v: ['a'] }, { v: { 0: 'a' } })).toBe(false);
  });

  it('terminates on a self-referential graph instead of hanging', () => {
    const a: Record<string, unknown> = { id: 'x' };
    const b: Record<string, unknown> = { id: 'x' };
    a.self = a;
    b.self = b;
    // Depth-bounded: the answer is "not provably equivalent", which makes registerColumn
    // fall through to its write — the safe direction.
    expect(columnSpecsEquivalent(a, b)).toBe(false);
  });
});
