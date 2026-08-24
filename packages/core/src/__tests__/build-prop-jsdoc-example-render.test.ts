// Phase 81 Plan 02 (R1/R4/P1) — RED-first suite for `buildPropJsdoc`'s new
// required `target` parameter and the escape-after-render seam it wires in.
//
// Split from `build-prop-jsdoc.test.ts` per Plan 02 ruling 2: the construct
// matrix stays in Plan 01's `render-example-markup.test.ts` (the renderer is
// tested at the renderer); this file owns the JSDoc-block assembly and the
// escape-after-render behavior (the block assembly is tested at the
// builder). Local convention matches both siblings: plain inline
// `expect(...).toBe(...)` string equality, no file snapshots.
import { describe, it, expect } from 'vitest';
import { buildPropJsdoc } from '../codegen/buildPropJsdoc.js';
import type { PropDecl, PropDocs } from '../ir/types.js';
import type { CompileTarget } from '../compile.js';

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

const TARGETS: readonly CompileTarget[] = ['vue', 'react', 'solid', 'svelte', 'angular', 'lit'];

// ---------------------------------------------------------------------------
// Block A — the six kitchen-sink JSDoc goldens (SPEC R2 acceptance).
//
// Reuses the SAME kitchen-sink example string Plan 01 blessed
// (`render-example-markup.test.ts`'s KITCHEN_SINK). The six rendered example
// bodies below are taken VERBATIM from the Plan 01 summary so the two test
// files cannot disagree about what the renderer produces.
// ---------------------------------------------------------------------------
const KITCHEN_SINK =
  '<FlowCanvas label="Save" r-model:graph="$data.graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>';

const KITCHEN_SINK_DESCRIPTION = 'Bind a reactive flow graph to the canvas.';

const KITCHEN_SINK_RENDERED: Record<CompileTarget, string> = {
  vue: '<FlowCanvas label="Save" v-model:graph="graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>',
  react:
    '<FlowCanvas label="Save" graph={graph} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
  solid:
    '<FlowCanvas label="Save" graph={graph()} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
  svelte:
    '<FlowCanvas label="Save" bind:graph id="flow" validateTypes={true} onnodemoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
  angular:
    '<rozie-flow-canvas label="Save" [(graph)]="graph" id="flow" [validateTypes]="true" (node-moved)="onMoved" readonly><rozie-port output="num" type="number" /></rozie-flow-canvas>',
  lit:
    '<rozie-flow-canvas label="Save" .graph=${graph} @graph-change=${…} id="flow" .validateTypes=${true} @node-moved=${onMoved} readonly><rozie-port output="num" type="number"></rozie-port></rozie-flow-canvas>',
};

/** Assemble the expected full JSDoc block for a description + example prop at 2-space indent. */
function expectedKitchenSinkBlock(renderedExample: string): string {
  return (
    '  /**\n' +
    '   * ' + KITCHEN_SINK_DESCRIPTION + '\n' +
    '   * @example\n' +
    '   * ' + renderedExample + '\n' +
    '   */\n'
  );
}

describe('buildPropJsdoc — six kitchen-sink JSDoc goldens (Block A)', () => {
  for (const target of TARGETS) {
    it(`renders the ${target}-correct example inside the JSDoc block`, () => {
      const p = prop({ description: KITCHEN_SINK_DESCRIPTION, example: KITCHEN_SINK });
      const out = buildPropJsdoc(p, target, '  ');
      expect(out).toBe(expectedKitchenSinkBlock(KITCHEN_SINK_RENDERED[target]));
    });
  }
});

// ---------------------------------------------------------------------------
// Block B — prohibition P1, escape after render.
// ---------------------------------------------------------------------------
describe('buildPropJsdoc — prohibition P1, escape runs AFTER the render (Block B)', () => {
  // Fixture 1: a static-position terminator — a component tag whose `label`
  // attribute value embeds a comment terminator. No binding/model/event
  // attribute is present, so this fixture renders IDENTICALLY on all six
  // targets (no per-target restructuring); it proves the baseline case.
  const STATIC_TERMINATOR_EXAMPLE = '<div label="Close */ early" />';

  for (const target of TARGETS) {
    it(`neutralizes a static-position terminator after render on ${target}`, () => {
      const p = prop({ example: STATIC_TERMINATOR_EXAMPLE });
      const out = buildPropJsdoc(p, target, '  ');

      // The neutralized form of the terminator is present.
      expect(out).toContain('Close *\\/ early');
      // Scanning for a bare, un-neutralized terminator finds EXACTLY one
      // occurrence — the block's own closing marker.
      const closers = out.match(/\*\//g) ?? [];
      expect(closers.length).toBe(1);
      // The block did not terminate early — opening marker, @example tag,
      // rendered example line, closing marker (plus the trailing split-empty).
      expect(out.split('\n').length).toBe(5);
    });
  }

  // Fixture 2: a restructured-position terminator — a two-way model
  // attribute whose bound expression embeds a comment terminator. Because
  // `a */ b` is not a bare identifier, React and Solid render the ellipsis
  // placeholder as the callback and the single authored attribute becomes
  // two emitted attributes — this is the fixture that fails if the escape
  // stayed on the raw input, since the emitted string is no longer the
  // authored one.
  const MODEL_TERMINATOR_EXAMPLE = '<div r-model:bar="a */ b" />';

  for (const target of TARGETS) {
    it(`neutralizes a restructured-position terminator after render on ${target}`, () => {
      const p = prop({ example: MODEL_TERMINATOR_EXAMPLE });
      const out = buildPropJsdoc(p, target, '  ');

      expect(out).toContain('*\\/');
      const closers = out.match(/\*\//g) ?? [];
      expect(closers.length).toBe(1);
      expect(out.split('\n').length).toBe(5);

      // React/Solid restructure the single authored model attribute into two
      // emitted attributes (value + change callback) — confirm the
      // restructuring actually happened, so this fixture cannot silently
      // degrade into the bare-identifier (non-restructured) shape.
      if (target === 'react' || target === 'solid') {
        expect(out).toContain('onBarChange');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Block C — R4 byte-identity across all six targets.
// ---------------------------------------------------------------------------
describe('buildPropJsdoc — R4 byte-identity across all six targets (Block C)', () => {
  it('docless: returns the empty string on all six targets', () => {
    const p = prop();
    const outputs = TARGETS.map((target) => buildPropJsdoc(p, target, '  '));
    for (const out of outputs) expect(out).toBe('');
  });

  it('prose-only: a description mentioning two-way binding notation is verbatim and identical on all six targets', () => {
    const description = 'Use r-model:x to enable two-way binding.';
    const expected = '  /**\n   * Use r-model:x to enable two-way binding.\n   */\n';
    const p = prop({ description });
    for (const target of TARGETS) {
      const out = buildPropJsdoc(p, target, '  ');
      // Hand-written literal baseline — not derived from the builder, so
      // this is a real assertion, not a tautology.
      expect(out).toBe(expected);
    }
  });

  it('non-markup example: the arrow-function snippet is verbatim and identical on all six targets', () => {
    const example = 'validate: (v) => v.length > 0';
    const expected = '  /**\n   * @example\n   * validate: (v) => v.length > 0\n   */\n';
    const p = prop({ example });
    for (const target of TARGETS) {
      const out = buildPropJsdoc(p, target, '  ');
      expect(out).toBe(expected);
      expect(out).toContain(example);
    }
  });

  it('empty example: an empty-string example produces no example tag and is byte-identical on all six targets', () => {
    const p = prop({ example: '' });
    for (const target of TARGETS) {
      const out = buildPropJsdoc(p, target, '  ');
      expect(out).not.toContain('@example');
      expect(out).toBe('');
    }
  });

  it('empty example: a whitespace-only example produces no example tag and is byte-identical on all six targets', () => {
    const p = prop({ example: '   ' });
    for (const target of TARGETS) {
      const out = buildPropJsdoc(p, target, '  ');
      expect(out).not.toContain('@example');
      expect(out).toBe('');
    }
  });

  it('each of the four non-goal fixtures reduces to exactly one distinct value across all six targets', () => {
    const fixtures: Array<{ name: string; p: PropDecl }> = [
      { name: 'docless', p: prop() },
      {
        name: 'prose-only',
        p: prop({ description: 'Use r-model:x to enable two-way binding.' }),
      },
      { name: 'non-markup example', p: prop({ example: 'validate: (v) => v.length > 0' }) },
      { name: 'empty-string example', p: prop({ example: '' }) },
      { name: 'whitespace-only example', p: prop({ example: '   ' }) },
    ];
    for (const { name, p } of fixtures) {
      const outputs = new Set(TARGETS.map((target) => buildPropJsdoc(p, target, '  ')));
      expect(outputs.size, `fixture "${name}" diverged across targets`).toBe(1);
    }
  });
});
