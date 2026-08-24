// Phase 81 Plan 01 (SPEC R2) — RED-first suite for the per-target example
// markup renderer. Covers the shared `classifyExampleMarkup` accept/reject
// oracle and `renderExampleMarkup`'s six-column mapping table.
//
// Local convention matches `build-prop-jsdoc.test.ts`: plain inline
// `expect(...).toBe(...)` string equality, no `toMatchFileSnapshot`, no
// shared golden files on disk.
import { describe, it, expect } from 'vitest';
import { classifyExampleMarkup, renderExampleMarkup } from '../codegen/renderExampleMarkup.js';
import type { CompileTarget } from '../compile.js';

const ALL_TARGETS: CompileTarget[] = ['vue', 'react', 'solid', 'svelte', 'angular', 'lit'];

describe('classifyExampleMarkup — accepts (Block A)', () => {
  it('a component tag', () => {
    expect(classifyExampleMarkup('<Foo />').kind).toBe('markup');
  });

  it('a model directive with a colon prop name', () => {
    expect(classifyExampleMarkup('<Foo r-model:bar="baz" />').kind).toBe('markup');
  });

  it('a colon-prefixed binding', () => {
    expect(classifyExampleMarkup('<Foo :bar="baz" />').kind).toBe('markup');
  });

  it('a static attribute', () => {
    expect(classifyExampleMarkup('<Foo bar="baz" />').kind).toBe('markup');
  });

  it('a hyphenated binding name', () => {
    expect(classifyExampleMarkup('<Foo :bar-baz="qux" />').kind).toBe('markup');
  });

  it('an at-prefixed event handler', () => {
    expect(classifyExampleMarkup('<Foo @bar="baz" />').kind).toBe('markup');
  });

  it('a value-less boolean shorthand attribute', () => {
    expect(classifyExampleMarkup('<Foo bar />').kind).toBe('markup');
  });

  it('a component tag with a nested component child', () => {
    expect(classifyExampleMarkup('<Foo><Bar /></Foo>').kind).toBe('markup');
  });

  it('a model directive with a hyphenated prop name', () => {
    expect(classifyExampleMarkup('<Foo r-model:foo-bar="x" />').kind).toBe('markup');
  });
});

describe('classifyExampleMarkup — rejects and passes through (Block B)', () => {
  it('a template element carrying a hash-prefixed attribute (slot-fill shape)', () => {
    const result = classifyExampleMarkup('<template #body="x">Body</template>');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a mustache pair in text position', () => {
    const result = classifyExampleMarkup('<Foo>{{ x }}</Foo>');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a mustache pair inside an attribute value', () => {
    const result = classifyExampleMarkup('<Foo bar="{{ x }}" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('an r-if directive', () => {
    const result = classifyExampleMarkup('<Foo r-if="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('an r-for directive', () => {
    const result = classifyExampleMarkup('<Foo r-for="item in items" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a model directive with no colon prop name', () => {
    const result = classifyExampleMarkup('<Foo r-model="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a model directive carrying a dotted modifier chain', () => {
    const result = classifyExampleMarkup('<Foo r-model:bar.trim="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('an event attribute carrying a dotted modifier chain', () => {
    const result = classifyExampleMarkup('<Foo @bar.stop="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('an unterminated tag that still yields an element node', () => {
    const result = classifyExampleMarkup('<Foo><Bar></Foo>');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('non-markup: a plain prose sentence', () => {
    expect(classifyExampleMarkup('Use this component to render a save button.').kind).toBe(
      'non-markup',
    );
  });

  it('non-markup: an arrow-function snippet', () => {
    expect(classifyExampleMarkup('validate: (v) => v.length > 0').kind).toBe('non-markup');
  });

  it('non-markup: a less-than comparison is NOT mistaken for malformed markup', () => {
    // Regression guard — a prose string containing a stray `<` must stay on
    // the verbatim path, not be classified as malformed markup.
    expect(classifyExampleMarkup('count < 5 && ok').kind).toBe('non-markup');
  });

  it('a model directive with an empty prop name after the colon', () => {
    const result = classifyExampleMarkup('<Foo r-model:="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a model directive with a multi-segment colon prop name', () => {
    const result = classifyExampleMarkup('<Foo r-model:a:b="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it('a binding attribute whose name contains a dot', () => {
    const result = classifyExampleMarkup('<Foo :bar.baz="x" />');
    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toBeTruthy();
  });
});

// The six kitchen-sink goldens (Block C). Deliberately places a static
// attribute (`id="flow"`) AFTER the model attribute so an implementation
// that appends model-expansion parts at the end of the attribute list
// fails here (RESEARCH Pitfall 4). Derived from the hand-authored
// packages/ui/rete/scripts/readme.mjs USAGE snippets.
const KITCHEN_SINK =
  '<FlowCanvas label="Save" r-model:graph="$data.graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>';

describe('renderExampleMarkup — six kitchen-sink goldens (Block C)', () => {
  it('vue', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'vue')).toBe(
      '<FlowCanvas label="Save" v-model:graph="graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>',
    );
  });

  it('react', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'react')).toBe(
      '<FlowCanvas label="Save" graph={graph} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
    );
  });

  it('solid', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'solid')).toBe(
      '<FlowCanvas label="Save" graph={graph()} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
    );
  });

  it('svelte', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'svelte')).toBe(
      '<FlowCanvas label="Save" bind:graph id="flow" validateTypes={true} onnodemoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>',
    );
  });

  it('angular', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'angular')).toBe(
      '<rozie-flow-canvas label="Save" [(graph)]="graph" id="flow" [validateTypes]="true" (node-moved)="onMoved" readonly><rozie-port output="num" type="number" /></rozie-flow-canvas>',
    );
  });

  it('lit', () => {
    expect(renderExampleMarkup(KITCHEN_SINK, 'lit')).toBe(
      '<rozie-flow-canvas label="Save" .graph=${graph} @graph-change=${…} id="flow" .validateTypes=${true} @node-moved=${onMoved} readonly><rozie-port output="num" type="number"></rozie-port></rozie-flow-canvas>',
    );
  });
});

describe('renderExampleMarkup — targeted construct behaviours (Block D)', () => {
  it('strips $data. sigils from a binding value on all six targets', () => {
    for (const target of ALL_TARGETS) {
      const out = renderExampleMarkup('<Foo :items="$data.todos" />', target);
      expect(out.includes('$data.')).toBe(false);
      expect(out.includes('todos')).toBe(true);
    }
  });

  it('strips $props. sigils from a binding value on all six targets', () => {
    for (const target of ALL_TARGETS) {
      const out = renderExampleMarkup('<Foo :items="$props.todos" />', target);
      expect(out.includes('$props.')).toBe(false);
      expect(out.includes('todos')).toBe(true);
    }
  });

  it('strips $refs. sigils from a binding value on all six targets', () => {
    for (const target of ALL_TARGETS) {
      const out = renderExampleMarkup('<Foo :items="$refs.todos" />', target);
      expect(out.includes('$refs.')).toBe(false);
      expect(out.includes('todos')).toBe(true);
    }
  });

  it('does NOT strip sigil-shaped text from a static attribute value', () => {
    for (const target of ALL_TARGETS) {
      const out = renderExampleMarkup('<Foo bar="$data.foo" />', target);
      expect(out.includes('$data.foo')).toBe(true);
    }
  });

  it('re-rendering an already-prefixed tag is idempotent on Angular and Lit', () => {
    expect(renderExampleMarkup('<rozie-flow-canvas />', 'angular')).toBe(
      '<rozie-flow-canvas />',
    );
    expect(renderExampleMarkup('<rozie-flow-canvas />', 'lit')).toBe('<rozie-flow-canvas />');
  });

  it('kebabs an adjacent-uppercase component name correctly (does NOT copy Angular\'s weaker regex)', () => {
    expect(renderExampleMarkup('<ROnProbe />', 'angular')).toBe('<rozie-r-on-probe />');
    // Lit forces an explicit open/close pair on a rewritten tag (planner
    // ruling 2) — the tag-name assertion is the same kebab form either way.
    expect(renderExampleMarkup('<ROnProbe />', 'lit')).toBe(
      '<rozie-r-on-probe></rozie-r-on-probe>',
    );
  });

  it('never rewrites a lowercase HTML tag while still rewriting a nested component tag', () => {
    const input = '<div class="wrap"><Port output="num" /></div>';
    for (const target of ALL_TARGETS) {
      const out = renderExampleMarkup(input, target);
      expect(out.startsWith('<div')).toBe(true);
    }
    expect(renderExampleMarkup(input, 'angular')).toBe(
      '<div class="wrap"><rozie-port output="num" /></div>',
    );
    expect(renderExampleMarkup(input, 'lit')).toBe(
      '<div class="wrap"><rozie-port output="num"></rozie-port></div>',
    );
  });

  it('a non-identifier model expression yields the ellipsis callback on React and Solid, no diagnostic', () => {
    const input = '<Foo r-model:graph="state.graph" />';
    expect(renderExampleMarkup(input, 'react')).toBe(
      '<Foo graph={state.graph} onGraphChange={…} />',
    );
  });

  it('Solid does NOT append a call to a non-identifier model value', () => {
    const input = '<Foo r-model:graph="state.graph" />';
    expect(renderExampleMarkup(input, 'solid')).toBe(
      '<Foo graph={state.graph} onGraphChange={…} />',
    );
  });

  it('Svelte emits the long bind: form when the model expression differs from the prop name', () => {
    const input = '<Foo r-model:graph="state.graph" />';
    expect(renderExampleMarkup(input, 'svelte')).toBe('<Foo bind:graph={state.graph} />');
  });

  it("Solid's () suffix is a model-value rule, not a binding rule — a plain `:` binding never gets ()", () => {
    const out = renderExampleMarkup('<Foo :count="n" />', 'solid');
    expect(out).toBe('<Foo count={n} />');
  });

  it('camelCases a hyphenated static attribute name on the five non-Vue targets, keeps it verbatim on Vue', () => {
    // Lowercase `div` tag — never rewritten on any target — isolates the
    // static-attribute-name behaviour from tag rewriting.
    const input = '<div custom-attr="x" />';
    expect(renderExampleMarkup(input, 'vue')).toBe('<div custom-attr="x" />');
    for (const target of ALL_TARGETS.filter((t) => t !== 'vue')) {
      expect(renderExampleMarkup(input, target)).toBe('<div customAttr="x" />');
    }
  });

  it('leaves data-* and aria-* static attribute names verbatim on all six targets', () => {
    const input = '<div data-test-id="x" aria-label="y" />';
    for (const target of ALL_TARGETS) {
      expect(renderExampleMarkup(input, target)).toBe(
        '<div data-test-id="x" aria-label="y" />',
      );
    }
  });

  it('returns unsupported input verbatim on all six targets and never throws', () => {
    const input = '<Foo r-if="x" />';
    for (const target of ALL_TARGETS) {
      expect(() => renderExampleMarkup(input, target)).not.toThrow();
      expect(renderExampleMarkup(input, target)).toBe(input);
    }
  });

  it('returns non-markup input verbatim on all six targets and never throws', () => {
    const input = 'validate: (v) => v.length > 0';
    for (const target of ALL_TARGETS) {
      expect(() => renderExampleMarkup(input, target)).not.toThrow();
      expect(renderExampleMarkup(input, target)).toBe(input);
    }
  });

  it('round-trips a non-ASCII static attribute value unchanged on all six targets', () => {
    const input = '<div label="héllo wörld 日本語" />';
    for (const target of ALL_TARGETS) {
      expect(renderExampleMarkup(input, target)).toBe(input);
    }
  });
});
