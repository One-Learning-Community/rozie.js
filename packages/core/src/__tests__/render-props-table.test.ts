// Phase 59 Plan 01 (SC-1/SC-4) — unit test for the shared renderPropDescription
// core module: the single anti-drift source for the per-prop Description CELL
// (consumed by every family README props table AND the docs-site API props
// table) PLUS the family-agnostic `renderPropsTable` generator.
//
// Covers:
//   - escapeTableCell: newline collapse, pipe escaping, the WR-03 non-fatal
//     unmatched-backtick warning (D-07)
//   - renderPropDescription: the inert path (no docs → ''), the deprecated /
//     description part-join
//   - renderPropsTable: a well-formed header + separator + one row per prop,
//     sourcing the Description cell from renderPropDescription — proven against
//     SLIDER-shaped IR so the generator carries zero data-table assumptions
//     (Req 4 / D-06).
import { describe, it, expect, vi } from 'vitest';
import {
  renderPropsTable,
  renderPropDescription,
  escapeTableCell,
} from '../codegen/renderPropDescription.js';
import type { IRComponent, PropDecl, PropDocs } from '../ir/types.js';

/**
 * Build a minimal slider-shaped PropDecl. Slider docs are NOT shipped — this
 * fixture exists ONLY to prove `renderPropsTable` is family-agnostic.
 */
function prop(name: string, docs?: PropDocs): PropDecl {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'identifier', name: 'Number' },
    defaultValue: null,
    isModel: false,
    required: false,
    ...(docs ? { docs } : {}),
    sourceLoc: { start: 0, end: 0, line: 1, column: 0 },
  } as unknown as PropDecl;
}

/** Build a minimal IRComponent carrying just the props under test. */
function ir(props: PropDecl[]): IRComponent {
  return { type: 'IRComponent', name: 'Slider', props } as unknown as IRComponent;
}

describe('escapeTableCell [Phase 59] — table-cell safety (T-59-01)', () => {
  it('collapses a newline to a single space', () => {
    expect(escapeTableCell('a\nb')).toBe('a b');
  });

  it('escapes a pipe so it cannot break the Markdown row', () => {
    expect(escapeTableCell('x | y')).toBe('x \\| y');
  });

  it('warns on an odd backtick count but still returns the escaped string (D-07)', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const out = escapeTableCell('an `unclosed code span');
      expect(out).toBe('an `unclosed code span');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain(
        'readme.mjs: WARNING: unmatched backtick',
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('renderPropDescription [Phase 59] — Description cell', () => {
  it('returns "" when the prop has no docs (inert path)', () => {
    expect(renderPropDescription(prop('value'))).toBe('');
  });

  it('prepends **(deprecated)** for deprecated: true', () => {
    expect(renderPropDescription(prop('value', { deprecated: true }))).toBe(
      '**(deprecated)**',
    );
  });

  it('appends the escaped message for a string deprecation', () => {
    expect(
      renderPropDescription(prop('value', { deprecated: 'Use modelValue.' })),
    ).toBe('**(deprecated)** Use modelValue.');
  });

  it('renders the escaped description', () => {
    expect(
      renderPropDescription(prop('value', { description: 'The current value.' })),
    ).toBe('The current value.');
  });

  it('joins deprecated + description with a single space', () => {
    expect(
      renderPropDescription(
        prop('value', { deprecated: true, description: 'The current value.' }),
      ),
    ).toBe('**(deprecated)** The current value.');
  });
});

describe('renderPropsTable [Phase 59] — family-agnostic generator (SC-4 / D-06)', () => {
  const fixture = ir([
    prop('value', { description: 'The current slider value.' }),
    prop('min', { description: 'The minimum allowed value.' }),
    prop('max', { description: 'The maximum allowed value.' }),
    prop('step', { description: 'The increment between selectable values.' }),
    // A docless prop still gets a row, with an empty Description cell.
    prop('disabled'),
  ]);

  it('emits the header row and the separator row', () => {
    const out = renderPropsTable(fixture);
    expect(out).toContain(
      '| Name | Type | Default | Two-way (model) | Required | Description |',
    );
    expect(out).toContain('| --- | --- | --- | :---: | :---: | --- |');
  });

  it('emits one row per prop, each carrying the prop name', () => {
    const out = renderPropsTable(fixture);
    for (const name of ['value', 'min', 'max', 'step', 'disabled']) {
      expect(out).toContain(`| \`${name}\` |`);
    }
  });

  it('sources the Description cell from renderPropDescription', () => {
    const out = renderPropsTable(fixture);
    for (const desc of [
      'The current slider value.',
      'The minimum allowed value.',
      'The maximum allowed value.',
      'The increment between selectable values.',
    ]) {
      expect(out).toContain(desc);
    }
  });

  it('leaves the Description cell empty for a docless prop', () => {
    const out = renderPropsTable(ir([prop('disabled')]));
    const row = out.split('\n').find((l) => l.includes('`disabled`'))!;
    // Last cell (Description) is empty: row ends with `| |`.
    expect(row.trimEnd().endsWith('|  |')).toBe(true);
  });
});
