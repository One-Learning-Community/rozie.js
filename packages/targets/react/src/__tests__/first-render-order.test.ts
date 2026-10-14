/**
 * React first-render throws (TDZ) and literal consts.
 *
 *  - A `useCallback` whose dependency array names a `useCallback` declared
 *    further down read it before its declaration ran.
 *  - A `$computed` (a `useMemo`, run on the first render) calling a `$memo`
 *    read the memo's cache `const` before its declaration ran.
 *  - A primitive literal `const` was emitted as `useMemo(() => 5000, [])`.
 */
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const ORDER = `<rozie name="Order">
<props>{ items: { type: Array, default: () => [] } }</props>
<data>{ n: 0 }</data>
<script>
const memoVal = $memo(() => $props.items.length * 2, () => [$props.items])
const doubled = $computed(() => memoVal() + $data.n)
const onA = () => { onB() }
const onB = () => { $data.n = $data.n + doubled + LIMIT_MS }
const LIMIT_MS = 5000
</script>
<template><div><button @click="onA">{{ doubled }}</button><i @click="onB">x</i></div></template>
</rozie>`;

const code = compile(ORDER, { target: 'react', filename: 'Order.rozie' }).code;
const at = (needle: string): number => {
  const i = code.indexOf(needle);
  expect(i, needle).toBeGreaterThan(-1);
  return i;
};

describe('React body order', () => {
  it('a useCallback is declared before a useCallback that lists it as a dependency', () => {
    expect(at('const onB = useCallback(')).toBeLessThan(at('const onA = useCallback('));
  });

  it('a $memo cache is declared before a $computed that calls the memo', () => {
    expect(at('const memoValCache = useMemo(')).toBeLessThan(at('const doubled = useMemo('));
  });

  it('a primitive literal const is a plain const', () => {
    expect(code).toContain('const LIMIT_MS = 5000;');
    expect(code).not.toContain('useMemo(() => 5000');
  });
});

describe('React $expose handle', () => {
  const SRC = `<rozie name="H">
<data>{ open: false }</data>
<script>
const show = () => { if ($data.open) return; $data.open = true }
const hide = () => { $data.open = false }
$expose({ show, hide })
</script>
<template><div>{{ $data.open }}</div></template>
</rozie>`;
  const code = compile(SRC, { target: 'react', filename: 'H.rozie' }).code;

  it('runs each verb in flushSync, so the next call sees what this one changed', () => {
    expect(code).toContain("import { flushSync } from 'react-dom';");
    expect(code).toContain('show: (...args: Parameters<typeof show>): ReturnType<typeof show> => flushSync(() => _rozieExposeRef.current.show(...args))');
  });
});
