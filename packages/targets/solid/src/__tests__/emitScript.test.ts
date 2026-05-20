/**
 * emitScript tests — Plan 06.3-01 Task 2 Test 5.
 *
 * Test 5: createSignal mapping — IRComponent with data: [{ name: 'count', initial: '0' }]
 * produces code containing `createSignal(0)` and `[count, setCount]`.
 *
 * Phase 07.3.2 Plan 02 — §slots-merge intake / invocation describes appended
 * below. Tests assert the producer-side dynamic-name slots intake (slots?: on
 * the Props interface) and the per-slot merge expression at the invocation
 * site (D-02 static-wins, Pitfall 2 reactive-tracking).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitScript } from '../emit/emitScript.js';
import { emitSolid } from '../emitSolid.js';

/** Build a minimal IRComponent with one StateDecl. */
function buildMinimalIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'Counter',
    props: [],
    state: [
      {
        name: 'count',
        initializer: t.numericLiteral(0),
        sourceLoc: { start: 0, end: 1 },
      },
    ],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], sourceLoc: { start: 0, end: 0 } },
    components: [],
    setupBody: {
      type: 'SetupBody',
      scriptProgram,
      annotations: [],
    },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

describe('emitScript — Solid target', () => {
  it('Test 5: maps StateDecl to createSignal + destructuring', () => {
    const ir = buildMinimalIR();
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });

    expect(result.hookSection).toContain('createSignal(0)');
    expect(result.hookSection).toContain('[count, setCount]');
    // createSignal should be added to imports.
    expect(solidImports.has('createSignal')).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('Quick 260515-u2b — $watch with `(v) => ...` callback binds getter value to first arg via __watchVal', () => {
    const src = `<rozie name="WatchSynthParam">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, (v) => { console.log(v) })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'WatchSynthParam.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    // Getter is invoked into __watchVal; the callback is invoked with that
    // value as its first arg, inside an `untrack(...)` wrapper. Preserves
    // user-authored `(v) => ...` params so `v` binds to the new value
    // (regression: bare `(cb)()` ate the param entirely in Solid emit,
    // esbuild then surfaced `ReferenceError: v is not defined`).
    // @babel/generator drops the parens around single-param arrows, so the
    // emitted shape is `(v => { ... })(__watchVal)` rather than `((v) => ...)`.
    //
    // Bug B fix (260519 linechart-watch-recreate) — the callback runs inside
    // `untrack(...)` so its reads (and transitive helper reads) DON'T join the
    // createEffect's dependency set; only the getter defines what re-runs it.
    expect(result.hookSection).toMatch(/createEffect\(\(\) => \{[\s\S]*?const __watchVal = \(\(\) =>[\s\S]*?\)\(\);[\s\S]*?untrack\(\(\) => \(v => \{[\s\S]*?\}\)\(__watchVal\)\);[\s\S]*?\}\);/);
    expect(solidImports.has('createEffect')).toBe(true);
    expect(solidImports.has('untrack')).toBe(true);
  });

  it('Quick 260515-u2b — $watch with `() => ...` callback omits __watchVal arg (tsc TS2554-safe)', () => {
    // Tighter than the (v) => ... case: TS flags `((() => ...))(__watchVal)` as
    // "Expected 0 arguments, but got 1". The emit drops the arg when callback
    // params are empty so the gated tsc step in tests/solid-lint stays clean.
    const src = `<rozie name="WatchSynthNoParam">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, () => { console.log('fired') })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'WatchSynthNoParam.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    // Bug B fix (260519 linechart-watch-recreate) — the zero-param callback is
    // wrapped in `untrack(...)`; the inner IIFE takes no argument.
    expect(result.hookSection).toMatch(/untrack\(\(\) => \(\(\) => \{[\s\S]*?\}\)\(\)\);/);
    expect(result.hookSection).not.toContain(`)(__watchVal)`);
  });

  it('lifecycle concise-arrow body: `$onMount(() => method())` wraps the body in an arrow (no eager call, no TDZ)', () => {
    // Regression for 2026-05-18 SortableListDemo bug: extractCleanupReturn strips
    // the arrow wrapper from `$onMount(() => reset())`, leaving the bare `reset()`
    // CallExpression as `lh.setup`. Previously emitScript stringified this directly
    // as `onMount(reset());` — which (a) calls reset() at registration instead of
    // after mount, and (b) hits TDZ because `const reset = ...` lives in
    // userArrowsSection AFTER hookSection. Fix wraps non-callable-reference
    // expressions back into `() => <expr>`.
    const src = `<rozie name="MountConcise">
<data>{ items: [] }</data>
<script>
const reset = () => { $data.items = [1, 2, 3] }
$onMount(() => reset())
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'MountConcise.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    expect(result.hookSection).toContain('onMount(() => reset());');
    expect(result.hookSection).not.toContain('onMount(reset());');
  });

  it('lifecycle identifier-form: `$onMount(reset)` passes the function reference through', () => {
    // Sibling assertion to the concise-body test — verifies the fix does NOT
    // over-wrap. An Identifier callback (`$onMount(reset)`) is already a
    // function value; emitting `onMount(() => reset)` would be subtly wrong
    // (creates a closure that returns the function instead of calling it).
    const src = `<rozie name="MountIdentifier">
<data>{ items: [] }</data>
<script>
const reset = () => { $data.items = [1, 2, 3] }
$onMount(reset)
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'MountIdentifier.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    expect(result.hookSection).toContain('onMount(reset);');
    expect(result.hookSection).not.toContain('onMount(() => reset)');
  });

  it('Quick 260515-u2b — no $watch means no extra createEffect call', () => {
    const ir = buildMinimalIR();
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    expect(result.hookSection).not.toContain('createEffect(');
    expect(solidImports.has('createEffect')).toBe(false);
  });
});

// =============================================================================
// Phase 07.3.2 Plan 02 — §slots-merge intake (D-SV-16 cross-target port)
// =============================================================================
//
// Producer-side intake of the consumer-emitted `slots={{ [expr]: fn }}` map.
// Solid producers that declare slots must accept a
//   `slots?: Record<string, (ctx: any) => JSX.Element>`
// field on their Props interface; non-slotted producers (D-05 byte-equivalence)
// must NOT emit that field. The per-slot merge expression at the invocation
// site is asserted by the sibling describe block below (§slots-merge
// invocation).
//
// Canonical reference: commit 6060408, svelte/emit/emitScript.ts:154-274.
// =============================================================================

const HERE_07_3_2 = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_07_3_2 = resolve(HERE_07_3_2, '../../../../..');

function compileSolid(exampleName: string): string {
  const filename = exampleName + '.rozie';
  const source = readFileSync(resolve(REPO_ROOT_07_3_2, 'examples/' + filename), 'utf8');
  const { ast } = parse(source, { filename });
  expect(ast).not.toBeNull();
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  expect(ir).not.toBeNull();
  const result = emitSolid(ir!, { filename, source });
  const errs = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errs, JSON.stringify(errs, null, 2)).toHaveLength(0);
  return result.code;
}

describe('emitPropsInterface — §slots-merge intake (Phase 07.3.2 D-SV-16 port)', () => {
  it('Modal (slotted) Props interface contains slots?: Record<string, (ctx: any) => JSX.Element>', () => {
    const code = compileSolid('Modal');
    // Positive: the producer-side intake field is present on the inline
    // interface. Shape exactly matches the consumer-emit Record value type
    // produced by emitSlotFiller.ts:166 (`slots={{ [expr]: (ctx) => (<>...</>) }}`).
    expect(code).toContain('slots?: Record<string, (ctx: any) => JSX.Element>;');
  });

  it('Counter (non-slotted) emits NO slots?: field (D-05 byte-equivalence)', () => {
    // Negative: Counter has no <slot> declarations, so the gate
    // `ir.slots.length > 0` MUST skip the field push. Anything else would
    // break D-05 cross-target byte-equivalence for non-slotted components.
    const code = compileSolid('Counter');
    expect(code).not.toMatch(/slots\?:\s*Record/);
  });

  it('Dropdown (slotted) Props interface contains slots?: intake field', () => {
    // Coverage for the with-params-slot case (Dropdown's `trigger` slot has
    // params `open`, `toggle`). Intake field is identical regardless of
    // slot params — the producer accepts the same Record<string, fn> shape.
    const code = compileSolid('Dropdown');
    expect(code).toContain('slots?: Record<string, (ctx: any) => JSX.Element>;');
  });
});

describe('emitSlotInvocation — §slots-merge invocation (Phase 07.3.2 D-02 static-wins, Pitfall 2 reactive-tracking)', () => {
  it("Modal header-slot invocation merges (_props.headerSlot ?? _props.slots?.['header']) at invocation site", () => {
    // D-02 invariant: static slot prop on the LEFT of `??`, dynamic map on
    // the RIGHT. The static-named consumer fill always wins when both are
    // present. Without this, Modal 2's `<template #[$data.slotName]>`
    // (dynamic header) is silently dropped (SC#2 dogfood blocker).
    const code = compileSolid('Modal');
    expect(code).toContain("(_props.headerSlot ?? _props.slots?.['header'])");
    // Both invocation forms (with-params header at conditional branch + with-params
    // footer at static branch) MUST emit the merge:
    expect(code).toContain("(_props.footerSlot ?? _props.slots?.['footer'])");
  });

  it("Dropdown trigger-slot (with-params) invocation merges and invokes: (_props.triggerSlot ?? _props.slots?.['trigger'])?.(... open: open() ...)", () => {
    // With-params variant uses optional-call `?.(...)` form. The merge
    // expression sits INSIDE the JSX `{...}` braces — see Pitfall 2 test
    // below — and the paramObj `{ open: open(), toggle }` is passed
    // unchanged from before Plan 02.
    const code = compileSolid('Dropdown');
    expect(code).toContain("(_props.triggerSlot ?? _props.slots?.['trigger'])?.(");
    // Sanity-check the param object is preserved through the merge:
    expect(code).toMatch(/\(_props\.triggerSlot \?\? _props\.slots\?\.\['trigger'\]\)\?\.\(\{ open: open\(\), toggle \}\)/);
  });

  it('merge expression stays INSIDE JSX {...} braces — never hoisted to a local const (Pitfall 2 / Assumption A2)', () => {
    // Solid's compiler wraps JSX expression scope with effect-tracking
    // accessors. If the merge were hoisted to a top-level `const merged =
    // _props.headerSlot ?? _props.slots?.['header']` outside the JSX
    // return expression, Solid would lose the reactive dependency on
    // `_props.slots` and Modal 2 would render on first paint but never
    // update when $data.slotName changes.
    //
    // Assert (a) no `const <name> = (...??...);` declaration on a
    // standalone source line, AND (b) every `_props.slots?.[` reference
    // is preceded (after any whitespace) by an opening JSX brace `{` on
    // the same or a recent token sequence — i.e., the merge lives inside
    // JSX braces, not as a free statement.
    const code = compileSolid('Modal');

    // (a) Negative: no hoisted-const form of the merge. Match patterns of
    //     `const X = (_props.Y ?? _props.slots?.[...])` at line start or
    //     after indentation — none should exist.
    const hoistedConstPattern =
      /^\s*const\s+[a-zA-Z_$][\w$]*\s*=\s*\(_props\.[a-zA-Z_$][\w$]*\s*\?\?\s*_props\.slots\?\.\[/m;
    expect(code).not.toMatch(hoistedConstPattern);

    // (b) Positive: every `_props.slots?.[` reference appears immediately
    //     inside a JSX expression `{...}` (the merge expression). Walk
    //     each occurrence and confirm there is an unmatched `{` between
    //     the most-recent newline and the match — i.e., the merge is
    //     enclosed by a JSX brace pair.
    const matches = [...code.matchAll(/_props\.slots\?\.\[/g)];
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      const idx = m.index!;
      const lineStart = code.lastIndexOf('\n', idx) + 1;
      const prefix = code.slice(lineStart, idx);
      const opens = (prefix.match(/\{/g) ?? []).length;
      const closes = (prefix.match(/\}/g) ?? []).length;
      // There must be at least one unmatched `{` open on this line before
      // the merge — meaning we're inside a JSX expression brace.
      expect(opens, `Pitfall 2: merge at offset ${idx} is not enclosed by JSX braces on the same line:\n${prefix}`).toBeGreaterThan(closes);
    }
  });
});

describe('emitScript — helper hoisting (260520-hus #2, TipTap·solid TDZ)', () => {
  it('hoists a `const` arrow helper to a `function` declaration so an eager createMemo can call it', () => {
    // Regression: `$computed` lowers to `createMemo`, whose callback runs
    // EAGERLY at component setup. Memos are emitted in `hookSection`, ABOVE
    // the user helpers in `userArrowsSection` — so a `$computed` body calling
    // a user helper read that helper before its `const` declaration ran →
    // TDZ `ReferenceError: Cannot access 'strip' before initialization`
    // (TipTapDemo·solid). Emitting the helper as a hoisted `function`
    // declaration makes it defined regardless of textual position.
    const source = [
      '<rozie name="TdzRepro">',
      "<data>{ value: 'hello world' }</data>",
      '<script>',
      'const strip = (s) => s.trim()',
      'const derived = $computed(() => strip($data.value))',
      '</script>',
      '<template><p>{{ derived }}</p></template>',
      '</rozie>',
    ].join('\n');
    const { ast } = parse(source, { filename: 'TdzRepro.rozie' });
    expect(ast).not.toBeNull();
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir).not.toBeNull();
    const result = emitSolid(ir!, { filename: 'TdzRepro.rozie', source });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // Helper emitted as a hoisted `function` declaration — NOT a `const` arrow
    // (which has a temporal dead zone and would TDZ when the memo runs).
    expect(result.code).toMatch(/function strip\(/);
    expect(result.code).not.toMatch(/const strip\s*=/);
    // The eagerly-evaluated memo callback references the helper.
    expect(result.code).toContain('createMemo');
  });
});
