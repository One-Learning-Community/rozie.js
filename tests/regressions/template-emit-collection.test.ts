/**
 * quick 260929-ua4 — a `$emit('name', …)` written ONLY in `<template>` (or
 * ONLY in a `<listeners>` handler) is collected into `IRComponent.emits` and
 * declared on all 6 targets. Red-first structural matrix.
 *
 * Contract: every string-literal `$emit` name reachable from `<script>`,
 * `<template>` or `<listeners>` is part of the component's public event
 * surface. `ir.emits` is first-seen, deduped: script names, then template
 * names in DFS pre-order, then listeners names. Each target then declares the
 * event the same way it declares a script-emitted one:
 *   - react / solid: an optional `on<Event>?` callback prop in the props
 *     interface (react: also in `result.types`);
 *   - vue: an entry in `defineEmits`;
 *   - svelte: an `on<event>` callback prop in `Props` AND in the `$props()`
 *     destructure;
 *   - angular: an `<event> = output<…>()` field, typed `output<unknown>` when
 *     some call passes a payload and `output<void>` otherwise;
 *   - lit: `new CustomEvent("<event>"` at the call site (already correct).
 *
 * Pre-fix red set (planner probe, 2026-09-29, template-only `ping`/`pong`
 * with no `<script>`): react + solid props interfaces empty; vue template
 * called `emit(...)` with no `defineEmits` (ReferenceError on click); svelte
 * called `onping?.(…)` with `onping` never declared (ReferenceError); angular
 * template called `ping.emit(1)` with no `ping = output()` member (AOT error).
 * Lit was correct.
 *
 * The per-target shapes asserted below were read off a CONTROL compile in
 * which all five `$emit` calls live in `<script>` functions (the known-good
 * path), so each assertion accepts exactly the declaration a script emit gets.
 *
 * The source is inlined here (NOT under fixtures/): regressions.test.ts walks
 * every fixtures/ dir and requires meta.json + frozen snapshots.
 */

import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';
const TARGETS: Target[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

/** Event names in the expected `ir.emits` order: script, template DFS, listeners. */
const ORDERED = ['saved', 'ping', 'pong', 'pick', 'hit'] as const;
/** Names some call site passes a payload to → Angular `output<unknown>`. */
const WITH_PAYLOAD = new Set(['ping', 'pick', 'hit']);

const SOURCE = `<rozie name="TemplateEmits">
<props>
{
  items: { type: Array, default: () => [] },
}
</props>
<script>
const save = () => { $emit('saved') }
</script>
<listeners>
  <listener :target="document" @keydown="$emit('hit', $event)" />
</listeners>
<template>
<div>
  <button @click="$emit('ping', 1)">x</button>
  <span @click="$emit('pong')">y</span>
  <ul>
    <li r-for="item in $props.items" :key="item.id">
      <a r-if="item.visible" @click="$emit('pick', item)">{{ item.label }}</a>
    </li>
  </ul>
  <button @click="$emit('saved')">dup</button>
  <button @click="save()">s</button>
</div>
</template>
</rozie>
`;

function compileFor(target: Target) {
  return compile(SOURCE, {
    target,
    filename: 'TemplateEmits.rozie',
    types: true,
    sourceMap: false,
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `onPing?: (...args: any[]) => void;` (react code) / `unknown[]` (react .d.ts, solid). */
function callbackPropRe(propName: string): RegExp {
  return new RegExp(
    `^\\s*${esc(propName)}\\?: \\(\\.\\.\\.args: (?:any|unknown)\\[\\]\\) => void;$`,
    'm',
  );
}

/** The body of the Vue `defineEmits<{ … }>()` type literal, or null. */
function vueDefineEmitsBody(code: string): string | null {
  const m = /defineEmits<\{([\s\S]*?)\}>\(\)/.exec(code);
  return m ? m[1]! : null;
}

describe('260929-ua4 — template/listeners-only $emit collection', () => {
  describe.each(TARGETS)('%s', (target) => {
    const result = compileFor(target);
    const code = result.code;

    it('compiles with zero error-severity diagnostics', () => {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
    });

    if (target === 'react') {
      it.each(
        ORDERED,
      )('declares the %s callback prop in the props interface (code + .d.ts)', (name) => {
        const prop = `on${cap(name)}`;
        expect(code).toMatch(callbackPropRe(prop));
        expect(result.types ?? '').toMatch(callbackPropRe(prop));
      });
    }

    if (target === 'solid') {
      it.each(ORDERED)('declares the %s callback prop in the props interface', (name) => {
        expect(code).toMatch(callbackPropRe(`on${cap(name)}`));
      });
    }

    if (target === 'vue') {
      it('declares defineEmits listing every event, in first-seen order', () => {
        const body = vueDefineEmitsBody(code);
        expect(body).not.toBeNull();
        const names = [...body!.matchAll(/^\s*([A-Za-z][\w-]*): \[/gm)].map((m) => m[1]);
        expect(names).toEqual([...ORDERED]);
      });
    }

    if (target === 'svelte') {
      it.each(
        ORDERED,
      )('declares the %s callback prop in Props and destructures it from $props()', (name) => {
        const prop = `on${name}`;
        expect(code).toMatch(callbackPropRe(prop));
        const destructure = /let \{([\s\S]*?)\}: Props = \$props\(\);/.exec(code);
        expect(destructure).not.toBeNull();
        expect(destructure![1]).toMatch(new RegExp(`^\\s*${esc(prop)},$`, 'm'));
      });
    }

    if (target === 'angular') {
      it.each(ORDERED)('declares exactly one %s output field', (name) => {
        const matches = code.match(new RegExp(`^\\s*${esc(name)} = output<`, 'gm')) ?? [];
        expect(matches).toHaveLength(1);
      });
      it.each(ORDERED)('types the %s output by payload arity', (name) => {
        const type = WITH_PAYLOAD.has(name) ? 'unknown' : 'void';
        expect(code).toMatch(new RegExp(`^\\s*${esc(name)} = output<${type}>\\(\\);$`, 'm'));
      });
    }

    if (target === 'lit') {
      it('dispatches the template and listeners events as CustomEvents (control)', () => {
        expect(code).toContain('new CustomEvent("ping"');
        expect(code).toContain('new CustomEvent("hit"');
      });
    }
  });
});
