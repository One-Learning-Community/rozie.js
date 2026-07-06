/**
 * Emitter-hardening backlog item #7 — Angular template can't hold non-pure
 * expressions / global builtins. Red-first AOT investigation (Plan 73-05)
 * empirically checked all THREE documented sub-shapes against the current
 * emitter (via a real `vite build` + Playwright render through
 * `tests/integration/angular-analogjs`, see 73-05-SUMMARY.md for the full
 * transcripts) and found:
 *
 *   (i)   modifier `valueTransform` containing a block-body arrow/IIFE —
 *         CONFIRMED RED pre-fix ("JIT compiler unavailable" at runtime,
 *         whole app fails to render). FIXED here via
 *         `hoistValueTransformIfImpure` (emitTemplateAttribute.ts).
 *   (ii)  inline `{{ }}` arrow (e.g. `items.find((x) => x > 1)`) —
 *         CONFIRMED RED pre-fix (same "JIT compiler unavailable" symptom).
 *         FIXED here via `hoistNonPureTemplateExpression`
 *         (rewriteTemplateExpression.ts) wired into `emitInterpolation`
 *         (emitTemplateNode.ts).
 *   (iii) `String()`/`Number()`/`JSON.stringify()` global-builtin CALLS —
 *         CONFIRMED GREEN already (renders correctly, no errors). The
 *         premise was FALSIFIED — `KNOWN_TEMPLATE_GLOBALS` +
 *         `detectUsedGlobals`'s `[.(]` call-form regex already cover this
 *         (quick task 260520-w18). This suite locks it as a regression
 *         guard, not a fix.
 *
 * All three fixes/guards are additive: an expression with NO function
 * literal (the overwhelming majority — every reference example) is
 * byte-identical to pre-fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseExpression } from '@babel/parser';
import { compile, createDefaultRegistry, registerModifier } from '../../../../core/src/index.js';
import type { IRComponent, PropDecl } from '../../../../core/src/ir/types.js';
import { emitAngular } from '../emitAngular.js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { hoistNonPureTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function makeIR(props: Array<{ name: string }> = []): IRComponent {
  return {
    name: 'TestComp',
    props: props.map((p) => ({ name: p.name, isModel: false }) as unknown as PropDecl),
    state: [],
    refs: [],
    computed: [],
    methods: [],
    lifecycle: {},
    slots: [],
    events: [],
    template: { type: 'TemplateFragment', children: [] },
    styles: [],
    components: [],
    listenersBlock: { listeners: [] },
    emits: [],
  } as unknown as IRComponent;
}

/** Slice the `template: \`...\`,` block out of an emitted Angular component. */
function templateOf(code: string): string {
  const m = code.match(/template:\s*`([\s\S]*?)`,/);
  if (!m) throw new Error('no template block in emitted Angular output');
  return m[1]!;
}

const ARROW_SOURCE = `<rozie name="ArrowProbe">

<props>
{
  items: { type: Array, default: () => [1, 2, 3] },
}
</props>

<template>
<div class="arrow-probe">
  <span class="result">{{ $props.items.find((x) => x > 1) }}</span>
</div>
</template>

</rozie>
`;

describe('item #7 sub-shape (ii) — inline template arrow, unit-level hoist helper', () => {
  it('hoistNonPureTemplateExpression returns null for an arrow-free expression', () => {
    const ir = makeIR([{ name: 'value' }]);
    const expr = parseExpression('$props.value');
    expect(hoistNonPureTemplateExpression(expr, ir, 'interp_0', new Set())).toBeNull();
  });

  it('hoistNonPureTemplateExpression hoists an expression containing an arrow', () => {
    const ir = makeIR([{ name: 'items' }]);
    const expr = parseExpression('$props.items.find((x) => x > 1)');
    const hoist = hoistNonPureTemplateExpression(expr, ir, 'interp_0', new Set());
    expect(hoist).not.toBeNull();
    expect(hoist!.memberName).toBe('__interp_0');
    expect(hoist!.decl).toContain('protected get __interp_0()');
    expect(hoist!.decl).toContain('return this.items().find(x => x > 1);');
  });

  it('hoistNonPureTemplateExpression bails when the expression touches a loop binding', () => {
    const ir = makeIR([]);
    const expr = parseExpression('items.find((x) => x > item.id)');
    const hoist = hoistNonPureTemplateExpression(expr, ir, 'interp_0', new Set(), {
      loopBindings: new Set(['item']),
    });
    expect(hoist).toBeNull();
  });

  it('hoistNonPureTemplateExpression disambiguates against taken names', () => {
    const ir = makeIR([{ name: 'items' }]);
    const expr = parseExpression('$props.items.find((x) => x > 1)');
    const hoist = hoistNonPureTemplateExpression(
      expr,
      ir,
      'interp_0',
      new Set(['__interp_0']),
    );
    expect(hoist!.memberName).toBe('__interp_0_2');
  });
});

describe('item #7 sub-shape (ii) — full compile() round trip', () => {
  it('an inline arrow inside {{ }} hoists to a getter, template holds a bare identifier', () => {
    const result = compile(ARROW_SOURCE, { target: 'angular', filename: 'ArrowProbe.rozie' });
    const template = templateOf(result.code);
    // The template must NOT contain the arrow token `=>` anywhere — Angular's
    // restricted template grammar forbids it (the original RED symptom).
    expect(template).not.toContain('=>');
    expect(template).toContain('__interp_');
    // The arrow now lives in a real class-body getter.
    expect(result.code).toContain('protected get __interp_');
    expect(result.code).toContain('.find(x => x > 1)');
  });

  it('the same source compiles cleanly (no fatal diagnostics) on all 5 other targets', () => {
    for (const target of ['react', 'vue', 'svelte', 'solid', 'lit'] as const) {
      const result = compile(ARROW_SOURCE, { target, filename: 'ArrowProbe.rozie' });
      expect(result.code.length).toBeGreaterThan(0);
      const fatal = result.diagnostics.filter((d) => d.severity === 'error');
      expect(fatal).toEqual([]);
    }
  });

  it('an arrow-free reference example (Counter) synthesises no interpolation getter', () => {
    const src = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const parsed = parse(src, { filename: 'Counter.rozie' });
    const lowered = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() });
    const { code } = emitAngular(lowered.ir!, { filename: 'Counter.rozie', source: src });
    expect(code).not.toContain('protected get __interp_');
  });
});

describe('item #7 sub-shape (i) — impure r-model valueTransform', () => {
  const IMPURE_SOURCE = `<rozie name="VtProbe">
<props>
{
  value: { type: String, default: '', model: true },
}
</props>
<template>
<input r-model.badTransform="$props.value" />
</template>
</rozie>
`;

  function registryWithImpureModifier() {
    const registry = createDefaultRegistry();
    registerModifier(registry, 'badTransform', {
      kind: 'model',
      arity: 'none',
      resolve() {
        return {
          descriptor: {
            valueTransform:
              '((__v) => { const __n = __v.trim(); return __n.toUpperCase(); })($v)',
          },
          diagnostics: [],
        };
      },
    });
    return registry;
  }

  it('an impure valueTransform hoists to a generated method; template calls it bare', () => {
    const result = compile(IMPURE_SOURCE, {
      target: 'angular',
      filename: 'VtProbe.rozie',
      modifierRegistry: registryWithImpureModifier(),
    });
    const template = templateOf(result.code);
    expect(template).toContain('_rModelTransform_0($event)');
    // The impure IIFE body must NOT be spliced into the template string.
    expect(template).not.toContain('const __n');
    expect(result.code).toContain('private _rModelTransform_0 = (__v: unknown): unknown =>');
    expect(result.code).toContain('__n.toUpperCase()');
  });

  it('a PURE valueTransform (the shipped .number/.trim builtins) is byte-identical to pre-fix (zero-drift)', () => {
    const source = `<rozie name="NumProbe">
<props>
{
  value: { type: Number, default: 0, model: true },
}
</props>
<template>
<input r-model.number="$props.value" />
</template>
</rozie>
`;
    const result = compile(source, { target: 'angular', filename: 'NumProbe.rozie' });
    const template = templateOf(result.code);
    // Pure fragments are NEVER hoisted — inlined exactly as before.
    expect(template).not.toContain('_rModelTransform_');
    expect(result.code).not.toContain('_rModelTransform_');
    expect(template).toContain('Number.isNaN(Number.parseFloat(($event)))');
  });
});

describe('item #7 sub-shape (iii) — String/Number/JSON global-builtin CALLS (falsified premise — already fixed)', () => {
  it('String()/Number()/JSON.stringify() calls in a template resolve via usedGlobals (no e.String(...) shape)', () => {
    const source = `<rozie name="GlobalProbe">
<props>
{
  count: { type: Number, default: 42 },
}
</props>
<template>
<div class="global-probe">
  <span class="result">{{ String($props.count) }}</span>
  <span class="result2">{{ Number('7') }}</span>
  <span class="result3">{{ JSON.stringify($props.count) }}</span>
</div>
</template>
</rozie>
`;
    const result = compile(source, { target: 'angular', filename: 'GlobalProbe.rozie' });
    expect(result.code).toContain('protected readonly String = String;');
    expect(result.code).toContain('protected readonly Number = Number;');
    expect(result.code).toContain('protected readonly JSON = JSON;');
  });
});
