// Phase 3 Plan 02 Task 3 — Counter script-side behavioral floor.
//
// Per CONTEXT D-51: Phase 3 success criterion 1 anchors on the Counter demo.
// Plan 02 emits the script-side only — full SFC mount + Playwright user-flow
// assertions land in Plan 06's e2e suite. This test exercises the substring-
// completeness alternative documented in plan §Task 3 step 3 "Alternative
// (simpler)": assert via substring matching that the emit contains every
// locked line for the Counter pipeline.
//
// What we verify here:
//   1. emitScript(Counter) produces a NON-EMPTY string (no compile silent-fail)
//   2. The emit contains EVERY required substring from Plan 02 success criteria
//   3. console.log("hello from rozie") appears verbatim (DX-03)
//   4. Identifier rewrites are applied across script body
//
// Full mount via @vue/test-utils + happy-dom is deferred to Plan 06 because
// emitVue still emits placeholder template/style — a real mount would fail
// without the template lower from Plan 03.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from '../../emit/emitScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function compileCounterScript(): string {
  const src = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
  const result = parse(src, { filename: 'Counter.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST for Counter');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR for Counter');
  const { script, diagnostics } = emitScript(lowered.ir);
  // Counter has no collisions → no errors.
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return script;
}

describe('Counter behavioral floor — script-side substring completeness', () => {
  it('emit is non-empty and well-formed (basic compile success)', () => {
    const script = compileCounterScript();
    expect(script.length).toBeGreaterThan(0);
    // Has the import line, defineModel, withDefaults, computed, ref.
    expect(script).toContain("from 'vue'");
  });

  it('contains every Plan 02 success criterion locked substring', () => {
    const script = compileCounterScript();

    // From plan must_haves[].truths:
    expect(script).toContain("defineModel<number>('value', { default: 0 })"); // D-31 model
    expect(script).toContain('withDefaults(');                                  // D-31 non-model
    expect(script).toContain('defineProps<{');                                   // D-31 non-model
    expect(script).toMatch(/step\?:\s*number/);
    expect(script).toMatch(/min\?:\s*number/);
    expect(script).toMatch(/max\?:\s*number/);
    expect(script).toContain('-Infinity');
    expect(script).toContain('Infinity');
    expect(script).toContain('const hovering = ref(false);');                    // D-32 per-decl ref
    expect(script).toMatch(/const canIncrement\s*=\s*computed\(/);               // D-34 computed 1:1
    expect(script).toMatch(/const canDecrement\s*=\s*computed\(/);
  });

  it('identifier rewrites are applied: $props.value (model) → value.value, $props.step → props.step', () => {
    const script = compileCounterScript();
    // canIncrement body: value.value + props.step <= props.max
    expect(script).toMatch(/value\.value\s*\+\s*props\.step\s*<=\s*props\.max/);
    // canDecrement body: value.value - props.step >= props.min
    expect(script).toMatch(/value\.value\s*-\s*props\.step\s*>=\s*props\.min/);
    // increment arrow: if (canIncrement.value) value.value += props.step
    expect(script).toMatch(/canIncrement\.value/);
    expect(script).toMatch(/value\.value\s*\+=\s*props\.step/);
    // decrement arrow: same pattern
    expect(script).toMatch(/canDecrement\.value/);
    expect(script).toMatch(/value\.value\s*-=\s*props\.step/);
  });

  it('NO raw $-prefixed magic accessors leak into emitted output', () => {
    const script = compileCounterScript();
    expect(script).not.toContain('$props.');
    expect(script).not.toContain('$data.');
    expect(script).not.toContain('$refs.');
    expect(script).not.toContain('$computed');
    expect(script).not.toContain('$emit');
    expect(script).not.toContain('$onMount');
    expect(script).not.toContain('$onUnmount');
  });

  it('console.log("hello from rozie") survives byte-identical (DX-03 anchor)', () => {
    const script = compileCounterScript();
    expect(script).toContain('console.log("hello from rozie")');
  });

  it('NO defineEmits emitted (Counter has no $emit calls)', () => {
    const script = compileCounterScript();
    expect(script).not.toContain('defineEmits');
  });

  it('NO defineSlots emitted (Counter has no <slot>s)', () => {
    const script = compileCounterScript();
    expect(script).not.toContain('defineSlots');
  });

  it('NO lifecycle hooks emitted (Counter has no $onMount/$onUnmount/$onUpdate)', () => {
    const script = compileCounterScript();
    expect(script).not.toContain('onMounted(');
    expect(script).not.toContain('onBeforeUnmount(');
    expect(script).not.toContain('onUpdated(');
  });
});
