// Phase 4 Plan 04-01 — D-65 ModifierImpl.react?() React emission descriptors.
//
// Each builtin modifier exposes a `react?(args, ctx)` hook returning either:
//   - { kind: 'native', token: 'capture'|'passive'|'once' }
//       — addEventListener option flag (NOT a React JSX modifier; React JSX has
//         no native modifier syntax). Used by emitter to switch to raw
//         addEventListener call style.
//   - { kind: 'helper', importFrom: '@rozie/runtime-react', helperName, args, listenerOnly? }
//       — emit an import + hook call in the generated .tsx.
//   - { kind: 'inlineGuard', code: string }
//       — emit a verbatim JS code-fragment guard before the user handler runs.
//         Used for stop/prevent/self and key-filters (escape/enter/tab/etc.) —
//         all of which have no native React equivalent.
//
// Phase 4 emitter (Plans 04-02..04-05) consumes these descriptors. Third-party
// plugins MAY omit the hook (it's optional on the interface); the React
// emitter falls back to ROZ520-class diagnostic in that case.
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

describe('Phase 4 D-65 React emission descriptors', () => {
  const registry = new ModifierRegistry();
  registerBuiltins(registry);

  it('every builtin implements react?', () => {
    for (const name of registry.list()) {
      const impl = registry.get(name);
      expect(impl, `builtin '${name}' should be retrievable`).toBeDefined();
      expect(
        typeof impl?.react,
        `builtin '${name}' missing react? hook`,
      ).toBe('function');
    }
  });

  it('.stop returns inlineGuard with e.stopPropagation()', () => {
    const desc = registry.get('stop')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'inlineGuard', code: 'e.stopPropagation();' });
  });

  it('.prevent returns inlineGuard with e.preventDefault()', () => {
    const desc = registry.get('prevent')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'inlineGuard', code: 'e.preventDefault();' });
  });

  it('.self returns inlineGuard checking e.target !== e.currentTarget (D-65 exemplar)', () => {
    const desc = registry.get('self')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({
      kind: 'inlineGuard',
      code: 'if (e.target !== e.currentTarget) return;',
    });
  });

  it('.capture returns native addEventListener option flag', () => {
    const desc = registry.get('capture')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'capture' });
  });

  it('.passive returns native addEventListener option flag', () => {
    const desc = registry.get('passive')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'passive' });
  });

  it('.once returns native addEventListener option flag', () => {
    const desc = registry.get('once')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({ kind: 'native', token: 'once' });
  });

  it('escape maps to inlineGuard checking e.key === "Escape" (React idiom, NOT Vue "esc")', () => {
    const desc = registry.get('escape')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'Escape') return;",
    });
  });

  it('enter maps to inlineGuard checking e.key === "Enter"', () => {
    const desc = registry.get('enter')!.react!([], LISTENER_CTX);
    expect(desc).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'Enter') return;",
    });
  });

  it('tab/delete map to inlineGuard with their full React key names', () => {
    expect(registry.get('tab')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'Tab') return;",
    });
    expect(registry.get('delete')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'Delete') return;",
    });
  });

  it('space maps to inlineGuard checking e.key === " " (literal space char)', () => {
    expect(registry.get('space')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== ' ') return;",
    });
  });

  it('arrow keys (up/down/left/right) map to ArrowUp/ArrowDown/ArrowLeft/ArrowRight', () => {
    expect(registry.get('up')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'ArrowUp') return;",
    });
    expect(registry.get('down')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'ArrowDown') return;",
    });
    expect(registry.get('left')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'ArrowLeft') return;",
    });
    expect(registry.get('right')!.react!([], LISTENER_CTX)).toEqual({
      kind: 'inlineGuard',
      code: "if (e.key !== 'ArrowRight') return;",
    });
  });

  it('.outside returns helper descriptor with listenerOnly: true (D-65 marquee exemplar)', () => {
    const refArgs: ModifierArg[] = [
      { kind: 'refExpr', ref: 'triggerEl', loc: ZERO_LOC },
      { kind: 'refExpr', ref: 'panelEl', loc: ZERO_LOC },
    ];
    const desc = registry.get('outside')!.react!(refArgs, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-react',
      helperName: 'useOutsideClick',
      listenerOnly: true,
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(refArgs);
  });

  it('.debounce returns helper descriptor named useDebouncedCallback (callback-shape, NOT bare debounce)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: ZERO_LOC },
    ];
    const desc = registry.get('debounce')!.react!(args, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-react',
      helperName: 'useDebouncedCallback',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    // No listenerOnly — debounce is valid in BOTH <listeners> and template @event.
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('.throttle returns helper descriptor named useThrottledCallback', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 100, loc: ZERO_LOC },
    ];
    const desc = registry.get('throttle')!.react!(args, LISTENER_CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-react',
      helperName: 'useThrottledCallback',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('matches snapshot of all builtin react() outputs (with empty args canonical input)', async () => {
    const out: Record<string, unknown> = {};
    for (const name of registry.list()) {
      const impl = registry.get(name);
      if (!impl) throw new Error(`unreachable: ${name} listed but not retrievable`);
      out[name] = impl.react ? impl.react([], LISTENER_CTX) : null;
    }
    await expect(JSON.stringify(out, null, 2)).toMatchFileSnapshot(
      resolve(__dirname, '../../fixtures/modifiers/react-hooks.snap'),
    );
  });
});
