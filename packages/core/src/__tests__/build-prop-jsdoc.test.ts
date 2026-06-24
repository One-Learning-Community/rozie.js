// Phase 58 Plan 03 (SC-2/SC-3) — unit test for the shared buildPropJsdoc()
// JSDoc-block builder. This is the load-bearing anti-drift helper consumed by
// renderPropsInterface (the .d.ts surface ×6) and the five trivial in-source
// targets (React/Solid/Svelte/Angular/Lit).
//
// Covers:
//   - the inert path (no docs / all-empty docs → '') that preserves SC-5
//   - description → leading line
//   - deprecated: true → bare @deprecated ; deprecated: '<msg>' → @deprecated <msg>
//   - example → @example then verbatim string (no fence)
//   - T-58-04 (Tampering): a docs string containing `*/` must NOT prematurely
//     close the emitted comment block (comment-injection mitigation)
//   - determinism / 2-space indent (byte-identity across the 4 entrypoints)
import { describe, it, expect } from 'vitest';
import { buildPropJsdoc } from '../codegen/buildPropJsdoc.js';
import type { PropDecl, PropDocs } from '../ir/types.js';

/** Build a minimal PropDecl carrying the given docs (or none). */
function prop(docs?: PropDocs): PropDecl {
  return {
    type: 'PropDecl',
    name: 'label',
    typeAnnotation: { kind: 'identifier', name: 'String' },
    defaultValue: null,
    isModel: false,
    required: false,
    ...(docs ? { docs } : {}),
    sourceLoc: { start: 0, end: 0, line: 1, column: 0 },
  } as unknown as PropDecl;
}

describe('buildPropJsdoc [Phase 58] — SC-2/SC-3 shared JSDoc builder', () => {
  it('returns "" for a docless prop (inert path — SC-5)', () => {
    expect(buildPropJsdoc(prop())).toBe('');
  });

  it('returns "" for an all-empty docs object (inert path — SC-5)', () => {
    expect(buildPropJsdoc(prop({}))).toBe('');
  });

  it('renders a description-only block (2-space indent, trailing newline)', () => {
    const out = buildPropJsdoc(prop({ description: 'The visible label.' }));
    expect(out).toBe('  /**\n   * The visible label.\n   */\n');
  });

  it('renders deprecated: true as a bare @deprecated tag', () => {
    const out = buildPropJsdoc(prop({ deprecated: true }));
    expect(out).toBe('  /**\n   * @deprecated\n   */\n');
  });

  it('renders deprecated: "<msg>" as @deprecated <msg>', () => {
    const out = buildPropJsdoc(prop({ deprecated: 'Use text instead.' }));
    expect(out).toBe('  /**\n   * @deprecated Use text instead.\n   */\n');
  });

  it('renders example as @example then the verbatim string (no fence)', () => {
    const out = buildPropJsdoc(prop({ example: '<Foo label="Save" />' }));
    expect(out).toBe('  /**\n   * @example\n   * <Foo label="Save" />\n   */\n');
  });

  it('renders the full description + deprecated-string + example block in order', () => {
    const out = buildPropJsdoc(
      prop({
        description: 'The visible label.',
        deprecated: 'Use text instead.',
        example: '<Foo label="Save" />',
      }),
    );
    expect(out).toBe(
      '  /**\n' +
        '   * The visible label.\n' +
        '   * @deprecated Use text instead.\n' +
        '   * @example\n' +
        '   * <Foo label="Save" />\n' +
        '   */\n',
    );
  });

  it('honors a custom indent', () => {
    const out = buildPropJsdoc(prop({ description: 'X' }), '    ');
    expect(out).toBe('    /**\n     * X\n     */\n');
  });

  it('handles a multi-line description by prefixing every line', () => {
    const out = buildPropJsdoc(prop({ description: 'Line one.\nLine two.' }));
    expect(out).toBe('  /**\n   * Line one.\n   * Line two.\n   */\n');
  });

  it('T-58-04: a `*/`-bearing string does NOT prematurely close the comment', () => {
    const out = buildPropJsdoc(prop({ description: 'Close */ early' }));
    // The literal `*/` must be neutralized so the comment block stays
    // well-formed — only ONE closing `*/` (the real terminator) may appear.
    const closers = out.match(/\*\//g) ?? [];
    expect(closers.length).toBe(1);
    // and the surviving text still carries the intent (escaped form).
    expect(out).toContain('Close *');
    expect(out).not.toContain('Close */ early');
  });

  it('T-58-04: escapes `*/` in deprecated and example strings too', () => {
    const out = buildPropJsdoc(
      prop({ deprecated: 'gone */ now', example: 'a */ b' }),
    );
    const closers = out.match(/\*\//g) ?? [];
    expect(closers.length).toBe(1);
  });
});
