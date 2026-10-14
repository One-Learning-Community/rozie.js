/**
 * $watch re-runs that some targets missed.
 *
 *  - Lit: a getter reading a plain prop AND `$data` went through a signal
 *    effect only, which a prop change does not re-run. It now also gets an
 *    `updated()` branch for those props, deduped by value against the effect.
 *  - Svelte, Solid: `onMount` is an effect, and effects first run in creation
 *    order. Watchers were created after it, so a `$data` write in the mount
 *    body landed before the watcher's first (skipped) run and never fired it.
 *    Watchers are now created before the lifecycle hooks.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';

const SRC = `<rozie name="W">
<props>{ hide: { type: Boolean, default: false } }</props>
<data>{ open: false, coarse: false }</data>
<script>
$onMount(() => { $data.coarse = true })
$watch(() => ($props.hide ? 'h' : 's') + ($data.open ? 1 : 0), () => { console.log('mixed') })
$watch(() => $data.coarse, () => { console.log('coarse') })
</script>
<template><div>{{ $data.open }}</div></template>
</rozie>`;

const code = (target: 'lit' | 'svelte' | 'solid') => compile(SRC, { target, filename: 'W.rozie' }).code;

describe('Lit mixed props + $data getter', () => {
  it('re-runs on a prop change through updated(), deduped by value', () => {
    const c = code('lit');
    expect(c).toContain(
      "if (this.__rozieFirstUpdateDone && (changedProperties.has('hide'))) { const __watchVal = untracked(() => (this.hide ? 'h' : 's') + (this._open.value ? 1 : 0)); if (!Object.is(__watchVal, this.__rozieWatchPrev_0)) {",
    );
    // The effect records what it saw, so the two paths do not both fire for one value.
    expect(c).toContain('untracked(() => { this.__rozieWatchPrev_0 = __watchVal; if (this.__rozieWatchInitial_0)');
  });

  it('a $data-only getter keeps the plain effect route', () => {
    expect(code('lit')).not.toContain('__rozieWatchPrev_1');
  });
});

describe('watchers are created before onMount', () => {
  it('svelte', () => {
    const c = code('svelte');
    expect(c.indexOf('$effect(() => { (() => coarse)()')).toBeGreaterThan(-1);
    expect(c.indexOf('$effect(() => { (() => coarse)()')).toBeLessThan(c.indexOf('onMount('));
  });

  it('solid', () => {
    const c = code('solid');
    expect(c.indexOf('createEffect(on(() => (() => coarse())()')).toBeGreaterThan(-1);
    expect(c.indexOf('createEffect(on(() => (() => coarse())()')).toBeLessThan(c.indexOf('onMount('));
  });
});
