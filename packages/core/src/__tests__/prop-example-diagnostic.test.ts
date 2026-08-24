// Phase 81 Plan 03 (R3 / SPEC D-04) — compile-level RED-first suite for
// ROZ097, the pre-emit `docs.example` validator.
//
// Local convention matches `prop-docs-inert.test.ts`: builds `.rozie`
// sources inline as template strings (no fixture files on disk), iterates
// all six compile targets per assertion group, and asserts against
// `compile()`'s public surface — `result.diagnostics` and `result.code`.
//
// Four blocks:
//   A. Rejected constructs — each must yield an error-severity ROZ097 on
//      every target AND an empty `result.code` (D-04: hard error, always,
//      because the validator runs once before the per-target switch).
//   B. The sanctioned exception (SPEC D-09) — a model bound to a
//      non-identifier (member) expression compiles clean and renders the
//      ellipsis placeholder on React/Solid.
//   C. Passthrough, no diagnostic — description-only, an arrow-function
//      snippet, and an empty-string example.
//   D. Supported markup end to end — the Plan 01 kitchen-sink example,
//      proving the whole chain (authored string -> validator -> builder ->
//      target emitter) reaches emitted output.
import { describe, it, expect } from 'vitest';
import { compile, type CompileTarget } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { renderDiagnostic } from '../diagnostics/frame.js';

const ALL_TARGETS: CompileTarget[] = ['vue', 'react', 'solid', 'svelte', 'angular', 'lit'];

/**
 * Build a minimal `.rozie` source with one prop (`label`) whose
 * `docs.example` is `example`. `JSON.stringify` produces a valid JS string
 * literal for the `<props>` object-literal parser regardless of what quote
 * characters `example` itself contains.
 */
function makeSource(example: string): string {
  return `<rozie name="Widget">
<props>
{ label: { type: String, default: '', docs: { example: ${JSON.stringify(example)} } } }
</props>
<template>
<div class="widget">{{ $props.label }}</div>
</template>
</rozie>
`;
}

const DESCRIPTION_ONLY_SOURCE = `<rozie name="Widget">
<props>
{ label: { type: String, default: '', docs: { description: 'The visible text label.' } } }
</props>
<template>
<div class="widget">{{ $props.label }}</div>
</template>
</rozie>
`;

function roz097Diagnostics(result: { diagnostics: Array<{ code: string }> }) {
  return result.diagnostics.filter(
    (d) => d.code === RozieErrorCode.PROP_DOCS_EXAMPLE_UNSUPPORTED_CONSTRUCT,
  );
}

// ---------------------------------------------------------------------------
// Block A — rejected constructs. Mirrors the exact fixture strings Plan 01's
// `classifyExampleMarkup` reject suite already proved reject with a reason
// (render-example-markup.test.ts, "rejects and passes through (Block B)") —
// reusing them here is what guarantees the renderer and this diagnostic can
// never disagree about what is supported.
// ---------------------------------------------------------------------------
const REJECTED: Array<{ name: string; example: string }> = [
  {
    name: 'a slot fill written as a template element carrying a hash-prefixed attribute',
    example: '<template #body="x">Body</template>',
  },
  { name: 'mustache interpolation in text position', example: '<Foo>{{ x }}</Foo>' },
  { name: 'mustache interpolation inside an attribute value', example: '<Foo bar="{{ x }}" />' },
  { name: 'an r-if directive', example: '<Foo r-if="x" />' },
  { name: 'an r-for directive', example: '<Foo r-for="item in items" />' },
  { name: 'a bare model directive with no prop name', example: '<Foo r-model="x" />' },
  {
    name: 'a model directive carrying a dotted modifier chain',
    example: '<Foo r-model:bar.trim="x" />',
  },
  {
    name: 'an event attribute carrying a dotted modifier chain',
    example: '<Foo @bar.stop="x" />',
  },
  { name: 'an unterminated tag', example: '<Foo><Bar></Foo>' },
];

describe('Block A — rejected constructs: error ROZ097 + empty result.code on all six targets', () => {
  for (const { name, example } of REJECTED) {
    for (const target of ALL_TARGETS) {
      it(`${target}: ${name}`, () => {
        const source = makeSource(example);
        const result = compile(source, { target, filename: 'Widget.rozie' });
        const roz097 = roz097Diagnostics(result);
        expect(
          roz097.length,
          `expected a ROZ097 diagnostic on ${target} for: ${name} — got diagnostics ${JSON.stringify(result.diagnostics)}`,
        ).toBeGreaterThan(0);
        expect(roz097.every((d) => d.severity === 'error')).toBe(true);
        expect(result.code).toBe('');
      });
    }
  }

  it('the diagnostic location is non-degenerate and renders a non-empty code frame (R3 acceptance)', () => {
    const source = makeSource(REJECTED[0]!.example);
    const result = compile(source, { target: 'react', filename: 'Widget.rozie' });
    const diag = roz097Diagnostics(result)[0];
    expect(diag).toBeDefined();
    expect(diag!.loc.end).toBeGreaterThan(diag!.loc.start);
    const frame = renderDiagnostic(diag!, source);
    expect(frame.length).toBeGreaterThan(0);
    expect(frame).toContain(RozieErrorCode.PROP_DOCS_EXAMPLE_UNSUPPORTED_CONSTRUCT);
  });
});

// ---------------------------------------------------------------------------
// Block B — the sanctioned exception (SPEC D-09): a model bound to a member
// expression rather than a bare identifier.
// ---------------------------------------------------------------------------
const MODEL_MEMBER_EXPRESSION_EXAMPLE = '<Foo r-model:bar="$data.obj.prop" />';

describe('Block B — model bound to a non-identifier expression (SPEC D-09): clean compile', () => {
  for (const target of ALL_TARGETS) {
    it(`${target}: zero ROZ097 diagnostics, non-empty result.code`, () => {
      const source = makeSource(MODEL_MEMBER_EXPRESSION_EXAMPLE);
      const result = compile(source, { target, filename: 'Widget.rozie' });
      expect(roz097Diagnostics(result)).toEqual([]);
      expect(result.code).not.toBe('');
    });
  }

  it('react: renders the ellipsis-placeholder callback form', () => {
    const source = makeSource(MODEL_MEMBER_EXPRESSION_EXAMPLE);
    const result = compile(source, { target: 'react', filename: 'Widget.rozie' });
    expect(result.code).toContain('…');
  });

  it('solid: renders the ellipsis-placeholder callback form', () => {
    const source = makeSource(MODEL_MEMBER_EXPRESSION_EXAMPLE);
    const result = compile(source, { target: 'solid', filename: 'Widget.rozie' });
    expect(result.code).toContain('…');
  });
});

// ---------------------------------------------------------------------------
// Block C — passthrough, no diagnostic.
// ---------------------------------------------------------------------------
describe('Block C — passthrough: description-only, arrow-function snippet, empty example', () => {
  const cases: Array<{ name: string; source: string }> = [
    { name: 'description-only prop (no example key)', source: DESCRIPTION_ONLY_SOURCE },
    {
      name: 'arrow-function snippet example (non-markup)',
      source: makeSource('validate: (v) => v.length > 0'),
    },
    { name: 'empty-string example', source: makeSource('') },
  ];

  for (const { name, source } of cases) {
    for (const target of ALL_TARGETS) {
      it(`${target}: ${name} — zero ROZ097, non-empty result.code`, () => {
        const result = compile(source, { target, filename: 'Widget.rozie' });
        expect(roz097Diagnostics(result)).toEqual([]);
        expect(result.code).not.toBe('');
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Block D — supported markup end to end (the Plan 01 kitchen-sink example).
// The six rendered lines come verbatim from
// render-example-markup.test.ts's "six kitchen-sink goldens (Block C)".
// ---------------------------------------------------------------------------
const KITCHEN_SINK =
  '<FlowCanvas label="Save" r-model:graph="$data.graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>';

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
  lit: '<rozie-flow-canvas label="Save" .graph=${graph} @graph-change=${…} id="flow" .validateTypes=${true} @node-moved=${onMoved} readonly><rozie-port output="num" type="number"></rozie-port></rozie-flow-canvas>',
};

describe('Block D — supported markup end to end (kitchen-sink example)', () => {
  const source = makeSource(KITCHEN_SINK);
  for (const target of ALL_TARGETS) {
    it(`${target}: zero ROZ097, the rendered example line appears in emitted output`, () => {
      const result = compile(source, { target, filename: 'Widget.rozie' });
      expect(roz097Diagnostics(result)).toEqual([]);
      expect(result.code).toContain(KITCHEN_SINK_RENDERED[target]);
    });
  }
});
