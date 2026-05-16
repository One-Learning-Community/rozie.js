// Quick plan 260515-u2b — collector tests for top-level $watch(getter, cb).
//
// Verifies that collectScriptDecls populates `bindings.watchers` correctly:
//   - Test 1: well-formed call appends ONE WatchEntry with both args as arrows.
//   - Test 2: malformed calls (missing cb, non-fn getter) append NO WatchEntry.
//   - Test 3: source-order is preserved across multiple $watch calls.
//   - Test 4: nested $watch (inside another fn body) is NOT collected.
//
// The collector stays silent on malformed input (Plan 02-01 contract). The
// validator emits ROZ109 — see unknownRefValidator.test.ts for that side.
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../../src/parse.js';
import { collectAllDeclarations } from '../../src/semantic/bindings.js';

function bindingsFor(src: string) {
  const result = parse(src, { filename: 'WatchSynth.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  return collectAllDeclarations(result.ast);
}

const SHELL_HEAD = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean } }</props>
<script>`;
const SHELL_TAIL = `</script>
<template><div /></template>
</rozie>`;

describe('collectScriptDecls — $watch collection (quick 260515-u2b)', () => {
  it('Test 1: well-formed $watch(arrow, arrow) appends ONE WatchEntry with both args as ArrowFunctionExpression', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => { console.log('cb') })
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(1);
    const entry = bindings.watchers[0]!;
    expect(t.isArrowFunctionExpression(entry.getter)).toBe(true);
    expect(t.isArrowFunctionExpression(entry.callback)).toBe(true);
    expect(entry.sourceLoc.start).toBeGreaterThan(0);
    expect(entry.sourceLoc.end).toBeGreaterThan(entry.sourceLoc.start);
  });

  it('Test 2a: $watch(arrow) (missing callback) appends NO WatchEntry', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open)
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(0);
  });

  it('Test 2b: $watch($props.open, cb) (getter is not a function) appends NO WatchEntry', () => {
    const src = `${SHELL_HEAD}
const cb = () => {}
$watch($props.open, cb)
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(0);
  });

  it('Test 2c: $watch(arrow, identifier) (callback is not a function expression) appends NO WatchEntry', () => {
    // The MVP locks both args to function expressions (arrow OR function);
    // an Identifier callback like `$watch(() => x, someCb)` is out of scope
    // for v1 — collector skips it silently, validator emits ROZ109.
    const src = `${SHELL_HEAD}
const cb = () => {}
$watch(() => $props.open, cb)
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(0);
  });

  it('Test 3: source-order — two $watch calls separated by console.log produce watchers[0] then watchers[1]', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => { console.log('A') })
console.log('between')
$watch(() => $props.open, () => { console.log('B') })
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(2);
    expect(bindings.watchers[0]!.sourceLoc.start).toBeLessThan(
      bindings.watchers[1]!.sourceLoc.start,
    );
  });

  it('Test 4: $watch nested inside another fn body is NOT collected (top-level rule, mirrors $onMount)', () => {
    const src = `${SHELL_HEAD}
const setup = () => {
  $watch(() => $props.open, () => {})
}
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(0);
  });

  it('Test 5: $watch(function () {...}, function () {...}) function-expression form also collects', () => {
    const src = `${SHELL_HEAD}
$watch(function () { return $props.open }, function () { console.log('fired') })
${SHELL_TAIL}`;
    const bindings = bindingsFor(src);
    expect(bindings.watchers).toHaveLength(1);
    expect(t.isFunctionExpression(bindings.watchers[0]!.getter)).toBe(true);
    expect(t.isFunctionExpression(bindings.watchers[0]!.callback)).toBe(true);
  });
});
