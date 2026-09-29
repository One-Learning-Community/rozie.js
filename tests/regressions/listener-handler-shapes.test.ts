/**
 * quick 260929-mn8 (split from 260929-lyc, DD-8) — `<listeners>` handler-shape
 * parity across all 6 emitters. Red-first structural matrix.
 *
 * Contract (the Lit Phase-07.1 WR-03 contract — see
 * packages/targets/lit/src/__tests__/wr03-outside-inline.test.ts — applied to
 * every target, and the documented semantic in
 * docs/guide/templates-and-events.md:127 "reach a specific element … via the
 * event target"):
 *
 *   - A CALLABLE handler (method name, function expression, member reference)
 *     is invoked WITH the DOM event.
 *   - Any other expression is a STATEMENT: it runs as a statement with
 *     `$event` in scope. It is never called as a function (`(stmt)($event)`)
 *     and never evaluated eagerly at setup (`throttle(stmt, 50)`).
 *
 * The matrix covers 3 handler shapes × 3 listener classes:
 *   - Class A/D plain listener (`:target="document"`)
 *   - Class B `.outside($refs.x)` listener
 *   - Class C `.debounce/.throttle` wrapped listener (`:target="window"`)
 *
 * Pre-fix red set (planning probe, 2026-09-29): (i) identifier drops the event
 * on vue/svelte/angular/solid; (ii)/(iii) A+B statement call-wrapped on
 * vue/svelte/angular and the C statement broken on ALL 6; (iv) function-valued
 * A/B handlers are a no-op on react/solid and `(…)()` on vue B.
 *
 * The source is inlined here (NOT under fixtures/): regressions.test.ts walks
 * every fixtures/ dir and requires meta.json + frozen snapshots.
 */

import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';
const TARGETS: Target[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

const SOURCE = `<rozie name="ListenerShapes">
<props>
{
  open: { type: Boolean, default: false },
}
</props>
<script>
const onKeyId = (e) => { console.log(e) }
const onKeyFn = (e) => { console.log(e) }
const onKeyStmt = (e) => { console.log(e) }
const onOutId = (e) => { console.log(e) }
const onOutFn = (e) => { console.log(e) }
const onOutStmt = (e) => { console.log(e) }
const onTickId = (e) => { console.log(e) }
const onTickFn = (e) => { console.log(e) }
const onTickStmt = (e) => { console.log(e) }
</script>
<listeners>
  <listener :target="document" @keydown="onKeyId" r-if="$props.open" />
  <listener :target="document" @keyup="(e) => onKeyFn(e)" r-if="$props.open" />
  <listener :target="document" @keypress="onKeyStmt($event)" r-if="$props.open" />
  <listener :target="document" @click.outside($refs.boxEl)="onOutId" r-if="$props.open" />
  <listener :target="document" @click.outside($refs.boxEl)="(e) => onOutFn(e)" r-if="$props.open" />
  <listener :target="document" @click.outside($refs.boxEl)="onOutStmt($event)" r-if="$props.open" />
  <listener :target="window" @resize.debounce(50)="onTickId" r-if="$props.open" />
  <listener :target="window" @scroll.debounce(50)="(e) => onTickFn(e)" r-if="$props.open" />
  <listener :target="window" @wheel.throttle(50)="onTickStmt($event)" r-if="$props.open" />
</listeners>
<template><div ref="boxEl">box</div></template>
</rozie>
`;

function compileFor(target: Target) {
  return compile(SOURCE, {
    target,
    filename: 'ListenerShapes.rozie',
    types: true,
    sourceMap: false,
  });
}

describe('260929-mn8 (DD-8) — <listeners> handler-shape parity', () => {
  describe.each(TARGETS)('%s', (target) => {
    const result = compileFor(target);
    const code = result.code;

    it('(0) compiles with zero error-severity diagnostics', () => {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
    });

    it('(i) identifier handlers receive the event (never called with no args)', () => {
      expect(code).not.toMatch(/(?:this\.)?on(?:Key|Out|Tick)Id\(\)/);
    });

    it('(ii) statement handlers are never invoked as a callable', () => {
      expect(code).not.toMatch(/on(?:Key|Out|Tick)Stmt\(\$event\)\)*\s*(?:\(|as\b)/);
    });

    it('(ii) statement handlers are never evaluated eagerly inside a debounce/throttle wrapper', () => {
      expect(code).not.toMatch(
        /(?:throttle|debounce|Callback|Handler)\(\s*(?:this\.)?onTickStmt\(/,
      );
    });

    it.each([
      'onKeyStmt',
      'onOutStmt',
      'onTickStmt',
    ])('(iii) %s is emitted as a statement', (name) => {
      expect(code).toMatch(new RegExp(`(?:this\\.)?${name}\\(\\$event\\);`));
    });

    it('(iv) function-valued A/B handlers are not a no-op statement', () => {
      expect(code).not.toMatch(/=>\s*(?:this\.)?on(?:Key|Out)Fn\(e\)\s*\)?\s*;/);
    });

    it('(iv) function-valued A/B handlers are not invoked with no args', () => {
      expect(code).not.toMatch(/on(?:Key|Out)Fn\(e\)\)\(\)/);
    });

    it.each(['onKeyFn', 'onOutFn'])('(iv) %s is invoked with the event', (name) => {
      expect(code).toMatch(new RegExp(`${name}\\(e\\)[^;\\n]{0,80}\\(\\$event\\)`));
    });
  });
});
