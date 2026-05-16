// Quick plan 260515-u2b — WatchHook IR shape end-to-end.
//
// Asserts that lowerToIR produces `ir.watchers: WatchHook[]` with:
//   - getter / callback bodies extracted from the arrow expressions
//   - getterDeps populated from the depGraph at `watch.{N}.getter`
//   - source order preserved across multiple $watch calls
//   - malformed calls emit ROZ109 + DROP from ir.watchers (collector silently
//     skips them, validator pushes ROZ109)
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

const SHELL_HEAD = `<rozie name="WatchIR">
<props>{ open: { type: Boolean, default: false } }</props>
<data>{ count: { default: 0 } }</data>
<script>`;
const SHELL_TAIL = `</script>
<template><div /></template>
</rozie>`;

function ir(src: string) {
  const result = parse(src, { filename: 'WatchIR.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

describe('WatchHook IR — quick plan 260515-u2b', () => {
  it('IR contains exactly one WatchHook for one $watch call; getter/callback bodies pulled from arrow .body', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => { console.log('fired') })
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir).not.toBeNull();
    expect(lowered.ir!.watchers).toHaveLength(1);
    const wh = lowered.ir!.watchers[0]!;
    expect(wh.type).toBe('WatchHook');
    // Getter body is the MemberExpression `$props.open` (arrow had body =
    // Expression form, not BlockStatement).
    expect(t.isMemberExpression(wh.getter)).toBe(true);
    // Callback body is a BlockStatement (`() => { console.log(...) }`).
    expect(t.isBlockStatement(wh.callback)).toBe(true);
    // getterDeps includes props.open.
    const propsDep = wh.getterDeps.find(
      (d) => d.scope === 'props' && d.path[0] === 'open',
    );
    expect(propsDep).toBeDefined();
  });

  it('Two $watch calls produce ir.watchers of length 2 in source order with independent getterDeps', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open, () => {})
$watch(() => $data.count, () => {})
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir!.watchers).toHaveLength(2);
    expect(
      lowered.ir!.watchers[0]!.getterDeps.some(
        (d) => d.scope === 'props' && d.path[0] === 'open',
      ),
    ).toBe(true);
    expect(
      lowered.ir!.watchers[1]!.getterDeps.some(
        (d) => d.scope === 'data' && d.path[0] === 'count',
      ),
    ).toBe(true);
  });

  it('Malformed $watch (missing callback) is skipped from ir.watchers AND emits ROZ109 warning', () => {
    const src = `${SHELL_HEAD}
$watch(() => $props.open)
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir!.watchers).toHaveLength(0);
    const roz109 = lowered.diagnostics.filter((d) => d.code === 'ROZ109');
    expect(roz109).toHaveLength(1);
    expect(roz109[0]!.severity).toBe('warning');
  });

  it('Malformed $watch (non-fn getter) emits ROZ109 + ir.watchers stays empty', () => {
    const src = `${SHELL_HEAD}
const cb = () => {}
$watch($props.open, cb)
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir!.watchers).toHaveLength(0);
    const roz109 = lowered.diagnostics.filter((d) => d.code === 'ROZ109');
    expect(roz109).toHaveLength(1);
  });

  it('lowerToIR with NO <script> block returns ir.watchers === []', () => {
    const src = `<rozie name="NoScript">
<template><div /></template>
</rozie>`;
    const lowered = ir(src);
    expect(lowered.ir!.watchers).toEqual([]);
  });

  it('Lifecycle still produces correct LifecycleHook[] alongside watchers — both populated independently', () => {
    const src = `${SHELL_HEAD}
$onMount(() => { console.log('mount') })
$watch(() => $props.open, () => { console.log('open changed') })
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir!.lifecycle).toHaveLength(1);
    expect(lowered.ir!.lifecycle[0]!.phase).toBe('mount');
    expect(lowered.ir!.watchers).toHaveLength(1);
  });

  it('Nested $watch (inside another arrow) emits ROZ104 + ir.watchers stays empty', () => {
    const src = `${SHELL_HEAD}
const setup = () => {
  $watch(() => $props.open, () => {})
}
${SHELL_TAIL}`;
    const lowered = ir(src);
    expect(lowered.ir!.watchers).toHaveLength(0);
    // ROZ104 (LIFECYCLE_OUTSIDE_SCRIPT) fires for any nested LIFECYCLE_NAMES.
    const roz104 = lowered.diagnostics.filter((d) => d.code === 'ROZ104');
    expect(roz104.length).toBeGreaterThanOrEqual(1);
  });
});
