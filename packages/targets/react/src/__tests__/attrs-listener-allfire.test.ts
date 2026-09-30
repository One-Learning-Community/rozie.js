/**
 * React R6 all-fire for a root with auto attr+listener fallthrough AND its own
 * `@event` (typed-surface phase 3 review finding #2; React port of the Solid
 * pickListeners fix 0cff671ed).
 *
 * Pre-fix emit: `<button {...attrs} className={…} onClick={($event) => { fire(); }}>`
 * — JSX last-wins, so a consumer's `onClick` (in `attrs`) never fired, while
 * phase 3 type-ACCEPTS it. Post-fix: the local handler and the consumer's
 * listener keys merge through `mergeListeners(…, pickListeners(attrs))`, placed
 * after the className merge so no non-listener key is re-applied.
 * Runtime behaviour is proven in @rozie/runtime-react
 * mergeListenersAttrsAllFire.test.tsx; this pins the emitted shape.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function react(src: string, filename: string): string {
  const { code, diagnostics } = compile(src, { target: 'react', filename, sourceMap: false });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return code;
}

describe('React — auto fallthrough + local @event all-fires the consumer listener', () => {
  it('AttrsButton: local @click and consumer onClick merge via pickListeners(attrs)', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'), 'utf8');
    const code = react(src, 'AttrsButton.rozie');
    expect(code).toContain(
      "{...mergeListeners({ onClick: ($event) => { fire(); } } satisfies import('react').ComponentPropsWithoutRef<'button'> & Record<string, unknown>, pickListeners(attrs))}",
    );
    // The local handler is no longer a bare last-wins JSX prop.
    expect(code).not.toMatch(/ onClick=\{/);
    expect(code).toMatch(/import \{[^}]*\bpickListeners\b[^}]*\} from '@rozie\/runtime-react';/);
    // className merge still precedes the listener spread (no clobber).
    expect(code.indexOf('className={clsx(')).toBeLessThan(code.indexOf('{...mergeListeners('));
  });

  it('no local @event: the root keeps the plain {...attrs} spread (byte-identical)', () => {
    const src = '<rozie name="NoLocal">\n<template>\n<button class="b">x</button>\n</template>\n</rozie>\n';
    const code = react(src, 'NoLocal.rozie');
    expect(code).not.toContain('pickListeners');
    expect(code).not.toContain('mergeListeners');
  });

  it('inherit-listeners="false" (no listener spread): local @click stays a plain JSX prop', () => {
    const src =
      '<rozie name="ListenersOff" inherit-listeners="false">\n<template>\n<button @click="$emit(\'go\')">x</button>\n</template>\n</rozie>\n';
    const code = react(src, 'ListenersOff.rozie');
    expect(code).not.toContain('pickListeners');
    expect(code).toMatch(/ onClick=\{/);
  });
});
