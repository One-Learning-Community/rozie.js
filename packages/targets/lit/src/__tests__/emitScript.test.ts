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
  // SortableList graduated from examples/ into the @rozie-ui/sortable-list
  // package (Phase 20-01 git-mv). Resolve it from its package path; all other
  // fixtures still live under examples/.
  const path =
    name === 'SortableList'
      ? resolve(ROOT, 'packages/ui/sortable-list/src/SortableList.rozie')
      : resolve(ROOT, `examples/${name}.rozie`);
  const source = readFileSync(path, 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

// Phase 21 Plan 06 (REQ-9, REQ-10) — compile inline .rozie source (no on-disk
// fixture) so each $expose case is self-contained.
function emitFromSource(source: string): string {
  const { ast } = parse(source, { filename: 'ExposeProbe.rozie' });
  if (!ast) throw new Error('parse() returned null AST for inline source');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null IR for inline source');
  return emitLit(ir, { filename: 'ExposeProbe.rozie', source, modifierRegistry: registry }).code;
}

const EXPOSE_PROBE_SRC = `<rozie name="ExposeProbe">
<template>
  <input :ref="inputEl" :value="text" @input="onInput" />
</template>
<data>
{ text: "" }
</data>
<script>
function reset() { $data.text = ""; }
function focus() { $refs.inputEl.focus(); }
function onInput(e) { $data.text = e.target.value; }
$expose({ reset, focus });
</script>
</rozie>`;

// Exposed-ONLY: `unusedReset` is referenced nowhere except $expose.
const EXPOSE_ONLY_SRC = `<rozie name="ExposeOnly">
<template>
  <input :value="text" @input="onInput" />
</template>
<data>
{ text: "" }
</data>
<script>
function unusedReset() { $data.text = ""; }
function onInput(e) { $data.text = e.target.value; }
$expose({ unusedReset });
</script>
</rozie>`;

describe('emitScript — $expose public element methods (REQ-9)', () => {
  it('exposed functions emit as PUBLIC element members (no private/#-private)', () => {
    const code = emitFromSource(EXPOSE_PROBE_SRC);
    // Both exposed names appear as element methods …
    expect(code).toMatch(/\breset\s*\(/);
    expect(code).toMatch(/\bfocus\s*\(/);
    // … and are NOT private/#-private.
    expect(code).not.toMatch(/private\s+reset\b/);
    expect(code).not.toMatch(/private\s+focus\b/);
    expect(code).not.toContain('#reset');
    expect(code).not.toContain('#focus');
  });

  it('strips the top-level $expose(...) call — no bare `$expose(` leaks', () => {
    const code = emitFromSource(EXPOSE_PROBE_SRC);
    expect(code).not.toContain('$expose(');
  });

  it('retains an exposed-ONLY function (not referenced by template)', () => {
    const code = emitFromSource(EXPOSE_ONLY_SRC);
    expect(code).toMatch(/\bunusedReset\s*\(/);
    expect(code).not.toContain('$expose(');
  });

  it('byte-identical when ir.expose is empty (Counter unchanged)', () => {
    const a = compile('Counter');
    const b = compile('Counter');
    expect(a).toBe(b);
    expect(a).not.toContain('$expose(');
  });
});

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
    // The public PROPERTY setter routes through `notifyPropertyWrite` — the
    // external-parent controlled-mode entry point. A Lit `.value=${…}`
    // property binding lands here and must establish controlled mode; routing
    // it through `write` left a property-bound two-way parent permanently
    // uncontrolled (dual-copy desync).
    expect(code).toContain('set value(v: number) { this._valueControllable.notifyPropertyWrite(v); }');
  });

  it('rewrites $props.X (model) compound write → controllable.write functional updater', () => {
    const code = compile('Counter');
    // Counter's `if (canIncrement) $props.value += $props.step` becomes a
    // direct controllable write (NOT `this.value += …`, which would hit the
    // public setter / notifyPropertyWrite and flip a standalone producer into
    // controlled mode). The compound op desugars to a functional updater.
    expect(code).toContain('this._valueControllable.write(prev => prev + this.step)');
    expect(code).not.toContain('this.value += this.step');
  });

  it('SortableList: producer-internal r-model write routes through controllable.write, setter through notifyPropertyWrite', () => {
    // Part A regression — the Lit controlled/uncontrolled mismatch on the
    // property-bound two-way `r-model:items`. SortableList's onUpdate handler
    // does `$props.items = next` (a plain `=` model write); this must lower to
    // a direct `_itemsControllable.write(next)` so a STANDALONE (uncontrolled)
    // SortableList still mutates its own local copy. The public PROPERTY
    // setter — the entry point for a parent's `.items=${…}` binding — must
    // route through `notifyPropertyWrite` so a property-bound two-way parent
    // establishes controlled mode (single source of truth, no dual copy).
    const code = compile('SortableList');
    expect(code).toContain('this._itemsControllable.write(next)');
    expect(code).toContain(
      'set items(v: any[]) { this._itemsControllable.notifyPropertyWrite(v); }',
    );
    // The producer's own write must NOT go through the public setter.
    expect(code).not.toContain('this.items = next');
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

  it('lifecycle concise-arrow body: `$onMount(() => method())` splices the call as a statement (no double-call)', () => {
    // Regression for 2026-05-18 SortableListDemo bug: extractCleanupReturn strips
    // the arrow wrapper from `$onMount(() => reset())`, leaving the bare `reset()`
    // CallExpression as `hook.setup`. Previously emitScript wrapped that in another
    // CallExpression — emitting `this.reset()();` (double-call). Fix splices the
    // expression as a statement when it's not a callable reference.
    const src = `<rozie name="MountConcise">
<data>{ items: [] }</data>
<script>
const reset = () => { $data.items = [1, 2, 3] }
$onMount(() => reset())
</script>
<template><div /></template>
</rozie>`;
    const { ast } = parse(src, { filename: 'MountConcise.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const code = emitLit(ir!, { filename: 'MountConcise.rozie', source: src, modifierRegistry: registry }).code;
    expect(code).toMatch(/firstUpdated\(\):\s*void\s*\{\s*this\.reset\(\);\s*\}/);
    expect(code).not.toContain('this.reset()()');
  });

  it('lifecycle identifier-form: `$onMount(reset)` invokes the function reference (no double-call regression)', () => {
    // Sibling assertion to the concise-body test — verifies the fix does NOT
    // break the identifier path. An Identifier callback (`$onMount(reset)`) is
    // a function reference; the emitter must wrap it in a CallExpression so
    // the firstUpdated body actually invokes it.
    const src = `<rozie name="MountIdentifier">
<data>{ items: [] }</data>
<script>
const reset = () => { $data.items = [1, 2, 3] }
$onMount(reset)
</script>
<template><div /></template>
</rozie>`;
    const { ast } = parse(src, { filename: 'MountIdentifier.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const code = emitLit(ir!, { filename: 'MountIdentifier.rozie', source: src, modifierRegistry: registry }).code;
    expect(code).toMatch(/firstUpdated\(\):\s*void\s*\{\s*this\.reset\(\);\s*\}/);
  });

  it('fullcalendar-lit-watch-property fix (2026-05-19) — $watch on $props.X routes through updated(changedProperties), NOT effect()', () => {
    // Hybrid IR-classification fix (option #3 per memory
    // project_fullcalendar_react_lit_gaps.md). Pre-fix, ALL $watch hooks
    // lowered to `this._disconnectCleanups.push(effect(() => { ... }))`,
    // which silently never re-fired for $props-only getters because
    // @lit-labs/preact-signals `effect()` doesn't subscribe to Lit @property
    // reads (@property accessors are NOT preact-signals). Post-fix,
    // $props-only watchers lower to an `if (changedProperties.has('X'))`
    // branch inside `updated()` — Lit's idiomatic prop-change observer.
    //
    // Surfaced by FullCalendar's `$watch(() => $props.events, …)` never
    // reflecting consumer event updates into `instance.addEvent(...)`.
    const source = `<rozie name="WatchPropsOnly">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.open) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const { ast } = parse(source, { filename: 'WatchPropsOnly.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const code = emitLit(ir!, {
      filename: 'WatchPropsOnly.rozie',
      source,
      modifierRegistry: registry,
    }).code;
    // updated() override with the prop-name branch.
    expect(code).toMatch(/updated\(changedProperties:[\s\S]+?\):\s*void\s*\{[\s\S]*?changedProperties\.has\('open'\)/);
    // No effect()-based watcher push for a $props-only getter.
    expect(code).not.toMatch(/this\._disconnectCleanups\.push\(effect\(/);
    // And `effect` is NOT imported from preact-signals when no $data
    // watcher requires it.
    expect(code).not.toMatch(/import \{[^}]*\beffect\b[^}]*\} from '@lit-labs\/preact-signals'/);
  });

  it('fullcalendar-lit-watch-property fix (2026-05-19) — $watch on $data.X keeps the effect() route', () => {
    // The effect() route remains correct when the getter reads $data (which
    // IS a preact-signal in target-lit). This guards against accidentally
    // collapsing every $watch through updated() — $data-only changes don't
    // flow through @property setters, so updated()'s `changedProperties`
    // branch would never fire on them.
    const source = `<rozie name="WatchDataOnly">
<data>{ count: 0 }</data>
<script>
const onChange = (v) => { console.log('change', v) }
$watch(() => $data.count, (v) => { onChange(v) })
</script>
<template><div /></template>
</rozie>`;
    const { ast } = parse(source, { filename: 'WatchDataOnly.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const code = emitLit(ir!, {
      filename: 'WatchDataOnly.rozie',
      source,
      modifierRegistry: registry,
    }).code;
    // effect imported from preact-signals.
    expect(code).toMatch(/import \{[^}]*\beffect\b[^}]*\} from '@lit-labs\/preact-signals'/);
    // Cleanup-push registration via effect().
    expect(code).toMatch(/this\._disconnectCleanups\.push\(effect\(\(\) => \{[\s\S]+?\}\)\);/);
    // Bug B fix (260519 linechart-watch-recreate) — the effect-route callback
    // runs inside `untracked(...)` so its reads (and transitive helper reads)
    // DON'T join the effect's dependency set; only the getter defines re-runs.
    // `untracked` is re-exported by @lit-labs/preact-signals.
    //
    // 260602-9lw — the effect route is now LAZY by default: a class-field
    // first-run flag (`this.__rozieWatchInitial_N`) is read/written INSIDE
    // `untracked(...)` and the callback is skipped on the first run.
    expect(code).toMatch(/private __rozieWatchInitial_0 = true;/);
    expect(code).toMatch(/effect\(\(\) => \{ const __watchVal = \([\s\S]+?\)\(\); untracked\(\(\) => \{ if \(this\.__rozieWatchInitial_0\) \{ this\.__rozieWatchInitial_0 = false; return; \} \([\s\S]+?\)\([\s\S]*?\); \}\); \}\)/);
    expect(code).toMatch(/import \{[^}]*\buntracked\b[^}]*\} from '@lit-labs\/preact-signals'/);
  });
});
