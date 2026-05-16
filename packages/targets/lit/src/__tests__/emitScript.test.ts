/**
 * emitScript unit tests — Plan 06.4-02 Task 1.
 *
 * Covers:
 *   - @property class-field emission per <props> entry (Lit @property decorator)
 *   - signal-backed @data field shape via @lit-labs/preact-signals
 *   - Lifecycle method dispatch: $onMount → firstUpdated(), $onUnmount → disconnectedCallback,
 *     $onUpdate → updated() — in source order across multiple hooks (D-LIT-09, REACT-04 parity)
 *   - Model-prop synthesis: createLitControllableProperty + getter/setter + change-event
 *   - $props/$data/$refs/$emit/$el rewrite in <script> AST
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('emitScript — Lit class-body assembly', () => {
  it('emits @property() class fields in declaration order', () => {
    const code = compile('Counter');
    // Counter declares value (model), step, min, max — in that order.
    expect(code).toMatch(/_value_attr.*\n.*step.*\n.*min.*\n.*max/s);
  });

  it('emits signal field initializers via @lit-labs/preact-signals', () => {
    const code = compile('Counter');
    expect(code).toContain("from '@lit-labs/preact-signals'");
    expect(code).toContain('signal');
    expect(code).toContain('signal(false)'); // Counter's hovering: false state
  });

  it('emits firstUpdated() body with $onMount calls preserved in source order', () => {
    const code = compile('Dropdown');
    // Dropdown has two $onMount calls; reposition() should appear first.
    expect(code).toContain('firstUpdated()');
    const firstUpdatedIdx = code.indexOf('firstUpdated()');
    const repositionIdx = code.indexOf('this.reposition()');
    expect(firstUpdatedIdx).toBeGreaterThan(0);
    expect(repositionIdx).toBeGreaterThan(firstUpdatedIdx);
  });

  it('emits disconnectedCallback() that drains _disconnectCleanups', () => {
    const code = compile('Modal');
    expect(code).toContain('disconnectedCallback()');
    expect(code).toContain('for (const fn of this._disconnectCleanups) fn();');
  });

  it('synthesizes model-prop accessor with createLitControllableProperty', () => {
    const code = compile('Counter');
    expect(code).toContain('createLitControllableProperty<number>');
    expect(code).toContain("eventName: 'value-change'");
    expect(code).toContain('get value(): number { return this._valueControllable.read(); }');
    expect(code).toContain('set value(v: number) { this._valueControllable.write(v); }');
  });

  it('rewrites $props.X → this.X in <script> AST', () => {
    const code = compile('Counter');
    // Counter's `if (canIncrement) $props.value += $props.step` becomes
    // `if (this.canIncrement) this.value += this.step`
    expect(code).toContain('this.value += this.step');
  });

  it('rewrites $data.X → this._X.value (signal access)', () => {
    const code = compile('SearchInput');
    // SearchInput's `$data.query.length >= $props.minLength` (in computed) → `this._query.value.length >= this.minLength`
    expect(code).toContain('this._query.value');
  });

  it('rewrites $emit("name", x) → this.dispatchEvent(new CustomEvent(...))', () => {
    const code = compile('SearchInput');
    expect(code).toContain('this.dispatchEvent(new CustomEvent(');
    expect(code).toContain('bubbles: true');
    expect(code).toContain('composed: true');
  });

  it('emits attributeChangedCallback for model-prop attribute-change wiring', () => {
    const code = compile('Counter');
    expect(code).toContain('attributeChangedCallback(name: string');
    expect(code).toContain("if (name === 'value')");
    expect(code).toContain('notifyAttributeChange');
  });

  it('paired $onMount/$onUnmount: cleanup pushed to _disconnectCleanups', () => {
    const code = compile('Modal');
    // Modal pairs $onMount(lockScroll) + $onUnmount(unlockScroll) via D-19.
    expect(code).toContain('this._disconnectCleanups.push(');
    expect(code).toContain('this.unlockScroll');
  });

  it('Quick 260515-u2b — $watch emits `this._disconnectCleanups.push(effect(() => { ... }))` AND adds effect to @lit-labs/preact-signals imports', () => {
    // Synthesize a minimal source with $watch so we hit only the watcher path.
    const source = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.open) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const { ast } = parse(source, { filename: 'WatchSynth.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const code = emitLit(ir!, {
      filename: 'WatchSynth.rozie',
      source,
      modifierRegistry: registry,
    }).code;
    // effect symbol pulled in from @lit-labs/preact-signals.
    expect(code).toMatch(/import \{[^}]*\beffect\b[^}]*\} from '@lit-labs\/preact-signals'/);
    // Cleanup-push registration via effect().
    expect(code).toMatch(/this\._disconnectCleanups\.push\(effect\(\(\) => \{[\s\S]+?\}\)\);/);
  });
});
