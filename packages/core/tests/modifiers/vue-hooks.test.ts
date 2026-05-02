// Phase 3 Plan 01-02 — D-40 ModifierImpl.vue?() Vue emission descriptors.
//
// Each builtin modifier exposes a `vue?(args, ctx)` hook returning either:
//   - { kind: 'native', token: string }    — pass-through to Vue native modifier
//   - { kind: 'helper', importFrom: '@rozie/runtime-vue', helperName, args, listenerOnly? }
// per D-40 + RESEARCH.md Pattern 7.
//
// Phase 3 emitter (Plans 02..05) consumes these descriptors. Third-party
// plugins MAY omit the hook (it's optional on the interface); the Vue emitter
// raises ROZ420 in that case.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ModifierRegistry,
  type ModifierContext,
} from '../../src/modifiers/ModifierRegistry.js';
import { registerBuiltins } from '../../src/modifiers/registerBuiltins.js';
import type { ModifierArg } from '../../src/modifier-grammar/parseModifierChain.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ZERO_LOC = { start: 0, end: 0 } as const;
const LISTENER_CTX: ModifierContext = {
  source: 'listeners-block',
  event: 'click',
  sourceLoc: ZERO_LOC,
};

describe('Phase 3 D-40 Vue emission descriptors', () => {
  const registry = new ModifierRegistry();
  registerBuiltins(registry);

  it('every builtin implements vue?', () => {
    for (const name of registry.list()) {
      const impl = registry.get(name);
      expect(impl, `builtin '${name}' should be retrievable`).toBeDefined();
      expect(
        typeof impl?.vue,
        `builtin '${name}' missing vue? hook`,
      ).toBe('function');
    }
  });

  it('.stop returns { kind: "native", token: "stop" }', () => {
    const desc = registry.get('stop')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'stop' });
  });

  it('.prevent returns { kind: "native", token: "prevent" }', () => {
    const desc = registry.get('prevent')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'prevent' });
  });

  it('.self returns { kind: "native", token: "self" }', () => {
    const desc = registry.get('self')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'self' });
  });

  it('.capture returns { kind: "native", token: "capture" }', () => {
    const desc = registry.get('capture')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'capture' });
  });

  it('.passive returns { kind: "native", token: "passive" }', () => {
    const desc = registry.get('passive')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'passive' });
  });

  it('.once returns { kind: "native", token: "once" }', () => {
    const desc = registry.get('once')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'once' });
  });

  it('escape maps to vue token "esc" (Rozie name → Vue name remap per RESEARCH.md line 583)', () => {
    const desc = registry.get('escape')!.vue!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'esc' });
  });

  it('enter/tab/delete/space pass through with same token', () => {
    for (const name of ['enter', 'tab', 'delete', 'space'] as const) {
      const desc = registry.get(name)!.vue!([], LISTENER_CTX);
      expect(desc).toEqual({ kind: 'native', token: name });
    }
  });

  it('arrow keys (up/down/left/right) pass through with same token', () => {
    for (const name of ['up', 'down', 'left', 'right'] as const) {
      const desc = registry.get(name)!.vue!([], LISTENER_CTX);
      expect(desc).toEqual({ kind: 'native', token: name });
    }
  });

  it('home/end/pageUp/pageDown/middle pass through with same token', () => {
    for (const name of ['home', 'end', 'pageUp', 'pageDown', 'middle'] as const) {
      const desc = registry.get(name)!.vue!([], LISTENER_CTX);
      expect(desc).toEqual({ kind: 'native', token: name });
    }
  });

  it('.outside returns helper descriptor with listenerOnly: true (D-40 + D-42)', () => {
    const refArgs: ModifierArg[] = [
      { kind: 'refExpr', ref: 'triggerEl', loc: ZERO_LOC },
      { kind: 'refExpr', ref: 'panelEl', loc: ZERO_LOC },
    ];
    const desc = registry.get('outside')!.vue!(refArgs, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-vue',
      helperName: 'useOutsideClick',
      listenerOnly: true,
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(refArgs);
  });

  it('.debounce returns helper descriptor without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: ZERO_LOC },
    ];
    const desc = registry.get('debounce')!.vue!(args, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-vue',
      helperName: 'debounce',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    // listenerOnly is optional and absent for debounce — works in both <listeners> and template @event.
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('.throttle returns helper descriptor without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 100, loc: ZERO_LOC },
    ];
    const desc = registry.get('throttle')!.vue!(args, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-vue',
      helperName: 'throttle',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('matches snapshot of all builtin vue() outputs (with empty args canonical input)', async () => {
    const out: Record<string, unknown> = {};
    for (const name of registry.list()) {
      const impl = registry.get(name);
      if (!impl) throw new Error(`unreachable: ${name} listed but not retrievable`);
      out[name] = impl.vue ? impl.vue([], LISTENER_CTX) : null;
    }
    await expect(JSON.stringify(out, null, 2)).toMatchFileSnapshot(
      resolve(__dirname, '../../fixtures/modifiers/vue-hooks.snap'),
    );
  });
});
