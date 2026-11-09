// A Lit element taken out of the page and put back later (keep-alive caches,
// tab panels, a dialog moved elsewhere) is unmounted and mounted again. The
// deferred teardown (`disconnectedCallback`, one microtask later, only when
// the element stayed disconnected) drains `_disconnectCleanups`: the
// `$onMount` cleanup and every `$watch` effect go. A reconnect re-armed only
// the listeners, so whatever `$onMount` set up (an engine instance, document
// listeners, a registry entry) and every effect-route `$watch` stayed gone.
//
// Now a reconnect after a real teardown runs the whole mount again
// (`firstUpdated()`: listeners, `$watch` effects, `$onMount`), and a lazy
// `$watch` is lazy again (its first-run flag is reset by the teardown), so it
// does not fire on the remount. A plain DOM move (disconnect + reconnect in
// the same task) never tears down, so nothing runs twice.
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

function compile(src: string): string {
  const { ast, diagnostics: parseDiags } = parse(src, { filename: 'Probe.rozie' });
  if (!ast) throw new Error(`parse() null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() null IR');
  const { code, diagnostics } = emitLit(ir, { filename: 'Probe.rozie', source: src, modifierRegistry: registry });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return code;
}

function method(code: string, signature: string): string {
  const start = code.indexOf('\n  ' + signature);
  expect(start, `${signature} not emitted`).toBeGreaterThanOrEqual(0);
  const rest = code.slice(start);
  return rest.slice(0, rest.indexOf('\n  }\n') + 4);
}

const MOUNT_WITH_LISTENERS = `<rozie name="RemountProbe">
<data>{ n: 0 }</data>
<script>
let engine = null
$onMount(() => {
  engine = { destroy() {} }
  return () => { engine.destroy() }
})
$watch(() => $data.n, () => { engine = null })
const bump = () => { $data.n = $data.n + 1 }
</script>
<listeners>
  <listener :target="document" @keydown="bump" />
</listeners>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

const MOUNT_ONLY = `<rozie name="RemountBareProbe">
<data>{ n: 0 }</data>
<script>
let engine = null
$onMount(() => {
  engine = { destroy() {} }
  return () => { engine.destroy() }
})
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

const LISTENERS_ONLY = `<rozie name="ListenersProbe">
<data>{ n: 0 }</data>
<script>
const bump = () => { $data.n = $data.n + 1 }
</script>
<listeners>
  <listener :target="document" @keydown="bump" />
</listeners>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

describe('Lit reconnect after a real teardown mounts again', () => {
  it('runs the whole mount (firstUpdated) again, not only the listeners', () => {
    const code = compile(MOUNT_WITH_LISTENERS);
    const connected = method(code, 'connectedCallback(): void {');
    expect(connected).toContain(
      'if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this.firstUpdated(); }',
    );
    // firstUpdated still arms the listeners and runs $onMount, once each.
    const first = method(code, 'firstUpdated(): void {');
    expect(first.match(/this\._armListeners\(\);/g)?.length).toBe(1);
    expect(first).toContain('this.engine = {');
  });

  it('a component with $onMount but no listeners also mounts again on reconnect', () => {
    const code = compile(MOUNT_ONLY);
    const connected = method(code, 'connectedCallback(): void {');
    expect(connected).toContain('super.connectedCallback();');
    expect(connected).toContain(
      'if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this.firstUpdated(); }',
    );
  });

  it('the teardown makes a lazy $watch lazy again, after draining its effect', () => {
    const code = compile(MOUNT_WITH_LISTENERS);
    const flag = code.match(/private (__rozieWatchInitial_\d+) = true;/)?.[1];
    expect(flag, 'lazy effect-route watcher flag').toBeTruthy();
    const disconnected = method(code, 'disconnectedCallback(): void {');
    const drain = disconnected.indexOf('for (const fn of this._disconnectCleanups) fn();');
    const reset = disconnected.indexOf(`this.${flag} = true;`);
    expect(drain).toBeGreaterThanOrEqual(0);
    expect(reset).toBeGreaterThan(drain);
  });

  it('a component without $onMount keeps re-arming only its listeners', () => {
    const code = compile(LISTENERS_ONLY);
    const connected = method(code, 'connectedCallback(): void {');
    expect(connected).toContain(
      'if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }',
    );
  });
});
