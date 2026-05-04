// Phase 3 Plan 03 — emitTemplate behavior + 5 file-snapshot fixtures.
//
// Per CONTEXT D-46 the per-block snapshots live at
// packages/targets/vue/fixtures/{Name}.template.snap and lock the emitter's
// template-side output verbatim.
//
// Behavior tests assert the 11 must-haves from the plan (Pattern 6 r→v 1:1,
// Pattern 7 modifier compilation incl. Vue token remap, Pattern 8 mustache-
// in-attribute D-37 array merge, D-35 native slot + presence wrapper, D-39
// native modifier passthrough, D-40 listenerOnly violation, debounce wrap
// scriptInjection).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  AttributeBinding,
  Listener,
  TemplateNode,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import { emitMergedAttributes } from '../emit/emitTemplateAttribute.js';
import { emitTemplateEvent } from '../emit/emitTemplateEvent.js';
import { buildSlotTypeBlock } from '../emit/refineSlotTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string): IRComponent {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

function emptyIR(): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Test',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    setupBody: { type: 'SetupBody', scriptProgram: t.file(t.program([])), annotations: [] },
    template: null,
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
    sourceLoc: { start: 0, end: 0 },
  };
}

const LOC = { start: 0, end: 0 };

describe('emitTemplate — behavior tests (synthetic IR)', () => {
  const registry = createDefaultRegistry();

  it('Test 1: TemplateInterpolation `{{ $data.hovering }}` emits as `{{ hovering }}` (auto-unwrap)', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'hovering',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const interp: TemplateNode = {
      type: 'TemplateInterpolation',
      expression: parseExpression('$data.hovering'),
      deps: [],
      sourceLoc: LOC,
    };
    ir.template = interp;
    const { template } = emitTemplate(ir, registry);
    expect(template).toContain('{{ hovering }}');
    expect(template).not.toContain('$data');
    expect(template).not.toContain('.value');
  });

  it('Test 2: TemplateLoop with itemAlias=item, iterable=$data.items, key=item.id emits `v-for=... :key=...`', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'items',
      initializer: t.arrayExpression([]),
      sourceLoc: LOC,
    });
    const loop: TemplateNode = {
      type: 'TemplateLoop',
      itemAlias: 'item',
      indexAlias: null,
      iterableExpression: parseExpression('$data.items'),
      iterableDeps: [],
      keyExpression: parseExpression('item.id'),
      body: [
        {
          type: 'TemplateElement',
          tagName: 'li',
          attributes: [],
          events: [],
          children: [],
          sourceLoc: LOC,
        },
      ],
      sourceLoc: LOC,
    };
    ir.template = loop;
    const { template } = emitTemplate(ir, registry);
    expect(template).toContain('v-for="item in items"');
    expect(template).toContain(':key="item.id"');
    expect(template).toContain('<li');
  });

  it('Test 3: TemplateConditional branches emit r-if→v-if, r-else-if→v-else-if, r-else→v-else', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'mode',
      initializer: t.stringLiteral('a'),
      sourceLoc: LOC,
    });
    const cond: TemplateNode = {
      type: 'TemplateConditional',
      branches: [
        {
          test: parseExpression("$data.mode === 'a'"),
          deps: [],
          body: [
            {
              type: 'TemplateElement',
              tagName: 'div',
              attributes: [],
              events: [],
              children: [{ type: 'TemplateStaticText', text: 'A', sourceLoc: LOC }],
              sourceLoc: LOC,
            },
          ],
          sourceLoc: LOC,
        },
        {
          test: parseExpression("$data.mode === 'b'"),
          deps: [],
          body: [
            {
              type: 'TemplateElement',
              tagName: 'div',
              attributes: [],
              events: [],
              children: [{ type: 'TemplateStaticText', text: 'B', sourceLoc: LOC }],
              sourceLoc: LOC,
            },
          ],
          sourceLoc: LOC,
        },
        {
          test: null,
          deps: [],
          body: [
            {
              type: 'TemplateElement',
              tagName: 'div',
              attributes: [],
              events: [],
              children: [{ type: 'TemplateStaticText', text: 'else', sourceLoc: LOC }],
              sourceLoc: LOC,
            },
          ],
          sourceLoc: LOC,
        },
      ],
      sourceLoc: LOC,
    };
    ir.template = cond;
    const { template } = emitTemplate(ir, registry);
    expect(template).toMatch(/v-if="mode === 'a'"/);
    expect(template).toMatch(/v-else-if="mode === 'b'"/);
    expect(template).toMatch(/v-else/);
  });

  it('Test 4: TemplateSlotInvocation named with args → `<slot name="trigger" :open="open" :toggle="toggle">`', () => {
    const ir = emptyIR();
    const slotDecl: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: LOC,
    };
    ir.slots.push(slotDecl);
    ir.props.push({
      type: 'PropDecl',
      name: 'open',
      typeAnnotation: { kind: 'identifier', name: 'Boolean' },
      defaultValue: t.booleanLiteral(false),
      isModel: true,
      sourceLoc: LOC,
    });
    const slot: TemplateNode = {
      type: 'TemplateSlotInvocation',
      slotName: 'trigger',
      args: [
        {
          name: 'open',
          expression: parseExpression('$props.open'),
          deps: [],
        },
        {
          name: 'toggle',
          expression: t.identifier('toggle'),
          deps: [],
        },
      ],
      fallback: [],
      sourceLoc: LOC,
    };
    ir.template = slot;
    const { template } = emitTemplate(ir, registry);
    expect(template).toContain('<slot name="trigger"');
    expect(template).toContain(':open="open"');
    expect(template).toContain(':toggle="toggle"');
  });

  it('Test 5: AttributeBinding kind=static class=counter emits `class="counter"`', () => {
    const attrs: AttributeBinding[] = [
      { kind: 'static', name: 'class', value: 'counter', sourceLoc: LOC },
    ];
    const ir = emptyIR();
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toBe('class="counter"');
  });

  it('Test 6: AttributeBinding kind=binding :class={hovering:$data.hovering} emits with template auto-unwrap (no `.value`)', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'hovering',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      {
        kind: 'binding',
        name: 'class',
        expression: parseExpression('{ hovering: $data.hovering }'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toContain(':class=');
    expect(result).toContain('hovering: hovering');
    expect(result).not.toContain('.value');
    expect(result).not.toContain('$data');
  });

  it('Test 7: AttributeBinding kind=interpolated for `aria-label="Item {{ item.name }}"` emits template literal', () => {
    const ir = emptyIR();
    const attrs: AttributeBinding[] = [
      {
        kind: 'interpolated',
        name: 'aria-label',
        segments: [
          { kind: 'static', text: 'Item ' },
          { kind: 'binding', expression: parseExpression('item.name'), deps: [] },
        ],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    // Must use template-literal form for non-class attrs.
    expect(result).toMatch(/:aria-label="`Item \$\{item\.name\}`"/);
  });

  it('Test 8: static class=counter + binding :class={hovering:hovering} merges to array form (Pitfall 7)', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'hovering',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      { kind: 'static', name: 'class', value: 'counter', sourceLoc: LOC },
      {
        kind: 'binding',
        name: 'class',
        expression: parseExpression('{ hovering: $data.hovering }'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toContain(':class=');
    expect(result).toContain("'counter'");
    expect(result).toContain('hovering: hovering');
    // Array brackets present.
    expect(result).toMatch(/:class="\[/);
  });

  it('Test 9: emitTemplateEvent for native modifier `.stop` emits `@click.stop="handler"` (D-39)', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'click',
      modifierPipeline: [
        { kind: 'filter', modifier: 'stop', args: [], sourceLoc: LOC },
      ],
      when: null,
      handler: t.identifier('increment'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const result = emitTemplateEvent(listener, { ir, registry });
    expect(result.eventAttr).toBe('@click.stop="increment"');
    expect(result.scriptInjection).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 10: emitTemplateEvent for `.escape` on @keydown emits `@keydown.esc="close"` (Vue token remap)', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'keydown',
      modifierPipeline: [
        { kind: 'filter', modifier: 'escape', args: [], sourceLoc: LOC },
      ],
      when: null,
      handler: t.identifier('close'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const result = emitTemplateEvent(listener, { ir, registry });
    expect(result.eventAttr).toBe('@keydown.esc="close"');
  });

  it('Test 11a: combined native modifiers `.stop.prevent` emit verbatim in order', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'click',
      modifierPipeline: [
        { kind: 'filter', modifier: 'stop', args: [], sourceLoc: LOC },
        { kind: 'filter', modifier: 'prevent', args: [], sourceLoc: LOC },
      ],
      when: null,
      handler: t.identifier('onClick'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const result = emitTemplateEvent(listener, { ir, registry });
    expect(result.eventAttr).toBe('@click.stop.prevent="onClick"');
  });

  it('Test 6 (debounce wrap script injection): @input.debounce(300) emits `@input="debouncedOnSearch"` and a scriptInjection record', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'input',
      modifierPipeline: [
        {
          kind: 'wrap',
          modifier: 'debounce',
          args: [{ kind: 'literal', value: 300, loc: LOC }],
          sourceLoc: LOC,
        },
      ],
      when: null,
      handler: t.identifier('onSearch'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const result = emitTemplateEvent(listener, { ir, registry });
    // Wrap-name uses camelCase composition: debounce + onSearch → debouncedOnSearch.
    expect(result.eventAttr).toMatch(/@input="debouncedOnSearch"$/);
    expect(result.scriptInjection).toBeDefined();
    expect(result.scriptInjection!.import.from).toBe('@rozie/runtime-vue');
    expect(result.scriptInjection!.import.name).toBe('debounce');
    expect(result.scriptInjection!.decl).toMatch(/const debouncedOnSearch = debounce\(onSearch, 300\);/);
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 7 (.outside listenerOnly violation): `.outside` on template @event raises ROZ420 diagnostic', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'click',
      modifierPipeline: [
        {
          kind: 'wrap',
          modifier: 'outside',
          args: [],
          sourceLoc: LOC,
        },
      ],
      when: null,
      handler: t.identifier('close'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const result = emitTemplateEvent(listener, { ir, registry });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const diag = result.diagnostics[0]!;
    expect(diag.code).toBe('ROZ420');
    expect(diag.severity).toBe('error');
    expect(diag.message).toMatch(/listenerOnly|outside.*<listeners>/i);
  });
});

describe('buildSlotTypeBlock — slot type signatures (Plan 03 Task 2 unit)', () => {
  it('returns `trigger(props: { open: any; toggle: any }): any;` for SlotDecl with two params', () => {
    const block = buildSlotTypeBlock([
      {
        type: 'SlotDecl',
        name: 'trigger',
        defaultContent: null,
        params: [
          { type: 'ParamDecl', name: 'open', valueExpression: t.identifier('open'), sourceLoc: LOC },
          { type: 'ParamDecl', name: 'toggle', valueExpression: t.identifier('toggle'), sourceLoc: LOC },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(block).toContain('trigger(props: { open: any; toggle: any }): any;');
  });

  it('default slot (name === \'\') maps to key `default`', () => {
    const block = buildSlotTypeBlock([
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [
          { type: 'ParamDecl', name: 'close', valueExpression: t.identifier('close'), sourceLoc: LOC },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(block).toContain('default(props: { close: any }): any;');
  });

  it('slot with no params emits empty object literal', () => {
    const block = buildSlotTypeBlock([
      {
        type: 'SlotDecl',
        name: 'empty',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(block).toContain('empty(props: {  }): any;');
  });
});

describe('emitTemplate — file snapshot fixtures (D-46)', () => {
  const registry = createDefaultRegistry();

  it('Counter.template.snap', async () => {
    const { template } = emitTemplate(lowerExample('Counter'), registry);
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.template.snap'));
  });

  it('SearchInput.template.snap', async () => {
    const { template } = emitTemplate(lowerExample('SearchInput'), registry);
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.template.snap'));
  });

  it('Dropdown.template.snap', async () => {
    const { template } = emitTemplate(lowerExample('Dropdown'), registry);
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'Dropdown.template.snap'));
  });

  it('TodoList.template.snap', async () => {
    const { template } = emitTemplate(lowerExample('TodoList'), registry);
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'TodoList.template.snap'));
  });

  it('Modal.template.snap', async () => {
    const { template } = emitTemplate(lowerExample('Modal'), registry);
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.template.snap'));
  });
});

describe('emitTemplate — example-specific substring assertions', () => {
  const registry = createDefaultRegistry();

  it('Counter: emits :class array merge with `counter` literal + hovering object', () => {
    const { template } = emitTemplate(lowerExample('Counter'), registry);
    expect(template).toContain('@click="increment"');
    expect(template).toContain('@click="decrement"');
    expect(template).toContain('{{ value }}'); // model prop in template auto-unwrap
    expect(template).toMatch(/:class="\[/);
    expect(template).toContain("'counter'");
    expect(template).toContain('hovering: hovering');
  });

  it('SearchInput: @input.debounce(300) lowers to debounced handler reference', () => {
    const { template } = emitTemplate(lowerExample('SearchInput'), registry);
    expect(template).toMatch(/@input="debounced/);
    expect(template).toContain('@keydown.enter="onSearch"');
    expect(template).toContain('@keydown.esc="clear"');
  });

  it('Dropdown: <slot name="trigger" :open="open" :toggle="toggle"> + default <slot :close="close">', () => {
    const { template } = emitTemplate(lowerExample('Dropdown'), registry);
    expect(template).toContain('<slot name="trigger"');
    expect(template).toContain(':open="open"');
    expect(template).toContain(':toggle="toggle"');
    expect(template).toContain(':close="close"');
    expect(template).toContain('v-if="open"'); // r-if="$props.open" → v-if="open" (model-prop auto-unwrap)
  });

  it('TodoList: r-for/v-for with :key, scoped-slot params for default slot row', () => {
    const { template } = emitTemplate(lowerExample('TodoList'), registry);
    expect(template).toContain('v-for="item in items"');
    expect(template).toContain(':key="item.id"');
    // Default slot with item/toggle/remove params.
    expect(template).toContain(':item="item"');
    // Header named slot
    expect(template).toContain('<slot name="header"');
    // Empty fallback slot
    expect(template).toContain('<slot name="empty"');
  });

  it('Modal: conditional containers use $slots refs on the outer element, not on the slot itself', () => {
    const { template } = emitTemplate(lowerExample('Modal'), registry);
    // Modal has @click.self on backdrop.
    expect(template).toContain('@click.self=');
    // r-if="$props.title || $slots.header" on <header> → v-if on outer element.
    // r-if="$slots.footer" on <footer> → v-if on outer element.
    // No extra <template v-if="$slots.X"> wrapper should appear around the <slot> itself.
    expect(template).toMatch(/\$slots\.(header|footer)/);
    expect(template).not.toMatch(/<template v-if="\$slots\.(header|footer)"/);
  });
});

describe('emitVue — script-injection merge for template @event modifier wraps', () => {
  it('SearchInput: full SFC contains runtime-vue import + debouncedOnSearch decl', async () => {
    // Lazy-import emitVue here so it runs through the merge layer.
    const { emitVue } = await import('../emitVue.js');
    const { code } = emitVue(lowerExample('SearchInput'));
    expect(code).toContain("import { debounce } from '@rozie/runtime-vue';");
    expect(code).toMatch(/const debouncedOnSearch = debounce\(onSearch, 300\);/);
    // Template body has the debounced handler reference instead of inline onSearch.
    expect(code).toContain('@input="debouncedOnSearch"');
    // Other native modifiers passed through verbatim.
    expect(code).toContain('@keydown.esc="clear"');
    expect(code).toContain('@keydown.enter="onSearch"');
  });
});
