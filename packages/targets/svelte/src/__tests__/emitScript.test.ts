// Phase 5 Plan 02a Task 1 — emitScript behavior tests + 3 per-block fixture
// snapshots (Counter / SearchInput / Modal).
//
// Per CONTEXT D-46 the per-block snapshots live at
// packages/targets/svelte/fixtures/{Name}.script.snap and lock the script-side
// emitter output verbatim.
//
// Behavior tests assert the 7 must-haves from the plan:
//  1. Counter $props destructure with $bindable() for model:true
//  2. Counter $data → $state()
//  3. Counter $computed → $derived()
//  4. Counter (no $onMount in source) ⇒ no $effect lifecycle line
//  5. SearchInput $watch debounce → inline IIFE (no @rozie/runtime-svelte)
//  6. Modal D-19 paired-cleanup: ONE $effect block per $onMount/$onUnmount pair
//  7. console.log("hello from rozie") in <script> body survives byte-identical
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string): IRComponent {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — behavior (Plan 05-02a Task 1)', () => {
  it('Test 1: Counter $props destructure emits $bindable(0) for model:true value prop', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('value = $bindable(0)');
    expect(scriptBlock).toContain('step = 1');
    expect(scriptBlock).toContain('min = -Infinity');
    expect(scriptBlock).toContain('max = Infinity');
    expect(scriptBlock).toContain(': Props = $props();');
  });

  it('Test 2: Counter $data emits `let hovering = $state(false);`', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('let hovering = $state(false);');
  });

  it('Test 3: Counter $computed canIncrement/canDecrement emits $derived(...) with rewritten body', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toMatch(/const canIncrement = \$derived\(/);
    expect(scriptBlock).toMatch(/const canDecrement = \$derived\(/);
    // Body uses bare value/step/max — no `.value` suffix in Svelte (per Pattern 1).
    expect(scriptBlock).toMatch(/value \+ step <= max/);
    expect(scriptBlock).toMatch(/value - step >= min/);
  });

  it('Test 4: Counter has NO lifecycle line (no $onMount/$onUnmount in source)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).not.toMatch(/\$effect\(/);
    expect(scriptBlock).not.toMatch(/\bonMount\(/);
  });

  it('Test 5: SearchInput $onMount with cleanup-return emits ONE onMount with `return () => ...`', () => {
    const { scriptBlock } = emitScript(lowerExample('SearchInput'));
    // Bug B fix (260519 linechart-watch-recreate) — $onMount lowers to the
    // non-tracking `onMount` lifecycle, NOT a tracking `$effect`. onMount
    // natively supports a cleanup-return.
    expect(scriptBlock).toMatch(/onMount\(\(\) => \{/);
    expect(scriptBlock).toContain('return () =>');
    expect(scriptBlock).toContain("import { onMount } from 'svelte';");
    // No external runtime-svelte import — A8/A9 RESOLVED.
    expect(scriptBlock).not.toContain("from '@rozie/runtime-svelte'");
  });

  it('Test 6: Modal D-19 paired-cleanup → ONE onMount block per $onMount/$onUnmount pair', () => {
    const { scriptBlock } = emitScript(lowerExample('Modal'));
    // Bug B fix (260519 linechart-watch-recreate) — the lockScroll/unlockScroll
    // pair merges into ONE non-tracking `onMount` block that returns the
    // cleanup:  onMount(() => { lockScroll(); return () => unlockScroll(); });
    expect(scriptBlock).toMatch(
      /onMount\(\(\) => \{[\s\S]*lockScroll\(\)[\s\S]*return \(\) => unlockScroll\(\)[\s\S]*\}\);/,
    );
    // The standalone `$onMount(() => { $refs.dialogEl?.focus() })` becomes
    // its OWN second `onMount` block.
    const onMountMatches = scriptBlock.match(/onMount\(/g) ?? [];
    expect(onMountMatches.length).toBe(2);
  });

  it('Test 7: Counter console.log("hello from rozie") survives verbatim (DX-03 trust-erosion floor)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('console.log("hello from rozie")');
  });

  it('Test 8: Counter Props interface includes value, step, min, max fields', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).toContain('interface Props {');
    expect(scriptBlock).toMatch(/value\?: number;/);
    expect(scriptBlock).toMatch(/step\?: number;/);
    expect(scriptBlock).toMatch(/min\?: number;/);
    expect(scriptBlock).toMatch(/max\?: number;/);
  });

  it('Test 9: Counter has NO Snippet import (no slots declared)', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    expect(scriptBlock).not.toContain('Snippet');
  });

  it('Test 10: TodoList includes `import type { Snippet } from \'svelte\';`', () => {
    const { scriptBlock } = emitScript(lowerExample('TodoList'));
    expect(scriptBlock).toContain("import type { Snippet } from 'svelte';");
  });

  it('Quick 260515-u2b — WatchHook binds the getter value as the callback\'s first arg (when callback declares a param)', () => {
    // Callback declares a param `(v) => ...` so emit MUST bind `__watchVal` to
    // it; the zero-param variant is covered separately below to ensure the
    // svelte-check arity gate doesn't regress.
    const src = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, (v) => { if (v) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchSynth.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const { scriptBlock } = emitScript(ir);
    // Getter is invoked into __watchVal; callback is invoked with that value
    // as its first argument. Preserves user-authored `(v) => ...` params so
    // `v` binds to the new value (regression: the bare `(cb)()` form left
    // `v` undefined — Svelte/Angular/Lit silent no-op, Solid ReferenceError).
    //
    // 260602-9lw — $watch is now LAZY by default (reverses 260519): the
    // deleted `__rozieWatchInitial_N` skip-initial gate is RESTORED. A
    // component-scope `let __rozieWatchInitial_0 = true;` is read/written
    // INSIDE `untrack(...)` (so it does not self-subscribe); the getter still
    // runs in tracking scope. The callback (`(v) => ...`) is invoked with
    // `__watchVal` only after the first run is skipped.
    // `v` carries a `: any` annotation from typeNeutralizeScript (untyped
    // `<script>` callback param).
    expect(scriptBlock).toContain('let __rozieWatchInitial_0 = true;');
    expect(scriptBlock).toMatch(
      /\$effect\(\(\) => \{\s*const __watchVal = \(\(\) => open\)\(\);\s*untrack\(\(\) => \{\s*if \(__rozieWatchInitial_0\) \{ __rozieWatchInitial_0 = false; return; \}\s*\((?:v|\(v: any\)) => \{[\s\S]*?\}\)\(__watchVal\);\s*\}\);\s*\}\);/,
    );
  });

  it('Quick 260515-u2b — WatchHook with zero-param callback omits __watchVal (svelte-check arity gate)', () => {
    // Zero-param callbacks must NOT receive __watchVal — `(() => {...})(__watchVal)`
    // trips svelte-check "Expected 0 arguments, but got 1". Dropdown.rozie has
    // exactly this shape (callback closes over `open` directly).
    const src = `<rozie name="WatchSynthNoArg">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.open) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchSynthNoArg.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const { scriptBlock } = emitScript(ir);
    // 260602-9lw — lazy-by-default restores the `__rozieWatchInitial_0` gate
    // inside `untrack`; the zero-param callback is still invoked with no args
    // (svelte-check arity gate), only after the first run is skipped.
    expect(scriptBlock).toContain('let __rozieWatchInitial_0 = true;');
    expect(scriptBlock).toMatch(
      /\$effect\(\(\) => \{\s*\(\(\) => open\)\(\);\s*untrack\(\(\) => \{\s*if \(__rozieWatchInitial_0\) \{ __rozieWatchInitial_0 = false; return; \}\s*\(\(\) => \{[\s\S]*?\}\)\(\);\s*\}\);\s*\}\);/,
    );
    expect(scriptBlock).not.toContain('__watchVal');
  });

  it('Quick 260515-u2b — Counter (no watchers) emits no extra $effect lines beyond lifecycle', () => {
    const { scriptBlock } = emitScript(lowerExample('Counter'));
    // Counter has no $watch and no $onMount, so $effect should not appear.
    expect(scriptBlock).not.toMatch(/\$effect/);
  });
});

describe('emitScript — per-block fixture snapshots (Plan 05-02a Task 1)', () => {
  const SCRIPT_FIXTURE_NAMES = ['Counter', 'SearchInput', 'Modal'] as const;

  for (const name of SCRIPT_FIXTURE_NAMES) {
    it(`${name}.script.snap`, async () => {
      const { scriptBlock } = emitScript(lowerExample(name));
      await expect(scriptBlock).toMatchFileSnapshot(
        resolve(FIXTURES, `${name}.script.snap`),
      );
    });
  }
});

// Phase 07.3.1 D-SV-16 — Svelte producer reads consumer-emitted `snippets`
// prop and merges into named-snippet locals via `$derived`. The consumer-side
// emitter (emitSlotFiller.ts:174) emits `snippets={{ [expr]: __rozieDynSlot_N }}`
// for `<template #[dynamic]>` fills; without the producer-side merge the
// dynamic projection is silently dropped (the destructure only reads bare
// `header`, never `snippets.header`).
//
// These tests construct synthetic single-component .rozie sources via the
// parser path so the IR is hand-built end-to-end (no fixture coupling). They
// lock the contract at the @rozie/target-svelte level — independent of the
// shared snapshot suite which exercises the same code path implicitly via
// Modal/Dropdown/TodoList .svelte.snap re-blessings.
function emitScriptFromSrc(src: string, name: string): string {
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return emitScript(lowered.ir).scriptBlock;
}

describe('snippets-merge (Phase 07.3.1 D-SV-16)', () => {
  it('Props interface includes snippets?: Record<string, any>; when ir.slots is non-empty', () => {
    // Typed `Record<string, any>` (not `Record<string, Snippet<[any]>>`) so the
    // `const X = $derived(__XProp ?? snippets?.X)` merge preserves the per-slot
    // Snippet signature from `__XProp`. A more specific Snippet<...> would
    // force the union into the strict-arity shape and surface as
    // "Expected 1 arguments, but got 0" at every `{@render X?.()}` callsite
    // for zero-param slots (Card.children, TodoList.empty) under svelte-check.
    const src = `<rozie name="SlottedTwo">
<template>
  <div>
    <slot name="header" />
    <slot />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedTwo');
    expect(scriptBlock).toContain('snippets?: Record<string, any>;');
  });

  it('Props destructure renames slot entries and appends snippets + emits $derived merge per slot', () => {
    const src = `<rozie name="SlottedHeader">
<template>
  <div>
    <slot name="header" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedHeader');
    // Rename in destructure.
    expect(scriptBlock).toContain('header: __headerProp');
    // snippets entry appended to destructure.
    expect(scriptBlock).toMatch(/\bsnippets\b[,\s}]/);
    // $derived merge line spliced after the destructure.
    expect(scriptBlock).toContain(
      'const header = $derived(__headerProp ?? snippets?.header);',
    );
  });

  it('static-named header wins over snippets?.header via `??` left-precedence (T-07.3.1-14)', () => {
    // The threat-model precedence rule: `__headerProp ?? snippets?.header`
    // makes the statically-named consumer fill the more specific binding.
    const src = `<rozie name="SlottedHeader">
<template>
  <div>
    <slot name="header" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedHeader');
    // Specifically assert __headerProp comes BEFORE snippets?.header in the
    // expression — coalesce evaluates left-to-right.
    const match = scriptBlock.match(
      /const header = \$derived\(__headerProp \?\? snippets\?\.header\);/,
    );
    expect(match).not.toBeNull();
  });

  it('slot name colliding with a declared prop → `$derived` merge identifier is `Slot`-suffixed (no duplicate declaration)', () => {
    // Regression (Phase 28): FullCalendar declares BOTH a boolean prop
    // `nowIndicator` AND a portal-slot `nowIndicator`. The props destructure
    // binds `let { nowIndicator = false } = $props()`; a bare
    // `const nowIndicator = $derived(...)` is a SECOND declaration of the same
    // identifier in the same <script> scope → hard Svelte compile error
    // "Identifier 'nowIndicator' has already been declared". The merge
    // identifier is disambiguated to `nowIndicatorSlot`; the boolean prop keeps
    // the bare name and the destructure temp / snippets key stay bare.
    const src = `<rozie name="Collision">
<props>
{
  nowIndicator: { type: Boolean, default: false }
}
</props>
<template>
  <div>
    <slot name="nowIndicator" portal :params="['arg']" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'Collision');
    // Disambiguated merge lvalue.
    expect(scriptBlock).toContain(
      'const nowIndicatorSlot = $derived(__nowIndicatorProp ?? snippets?.nowIndicator);',
    );
    // The colliding bare merge MUST NOT be emitted (it would duplicate the prop
    // binding).
    expect(scriptBlock).not.toContain(
      'const nowIndicator = $derived(__nowIndicatorProp ?? snippets?.nowIndicator);',
    );
    // The boolean prop keeps the bare name.
    expect(scriptBlock).toContain('nowIndicator = false');
    // Destructure temp + snippets map key stay bare.
    expect(scriptBlock).toContain('nowIndicator: __nowIndicatorProp');
  });

  it('non-colliding slot keeps a bare `$derived` merge identifier (byte-identical)', () => {
    const src = `<rozie name="NoCollision">
<props>
{
  editable: { type: Boolean, default: false }
}
</props>
<template>
  <div>
    <slot name="eventContent" portal :params="['arg']" />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'NoCollision');
    expect(scriptBlock).toContain(
      'const eventContent = $derived(__eventContentProp ?? snippets?.eventContent);',
    );
    expect(scriptBlock).not.toContain('eventContentSlot');
  });

  it('default-slot lowers to `children` and gets the same merge treatment', () => {
    const src = `<rozie name="SlottedDefault">
<template>
  <div>
    <slot />
  </div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'SlottedDefault');
    expect(scriptBlock).toContain('children: __childrenProp');
    expect(scriptBlock).toContain(
      'const children = $derived(__childrenProp ?? snippets?.children);',
    );
  });

  it('no snippets merge when ir.slots is empty — Counter byte-equivalent shape', () => {
    // Counter has props + state + computed but NO slots. The fix must not
    // touch it at all — no snippets field, no rename, no $derived merge.
    const scriptBlock = emitScript(lowerExample('Counter')).scriptBlock;
    expect(scriptBlock).not.toContain('snippets?: Record<string');
    expect(scriptBlock).not.toMatch(/__\w+Prop\b/);
    // Counter's $computed legitimately uses $derived — guard the assertion
    // against false-positives by checking the slot-merge-specific pattern.
    expect(scriptBlock).not.toMatch(/\$derived\(__\w+Prop \?\? snippets/);
  });
});

describe('$expose — Svelte instance exports (Phase 21 Plan 04, REQ-6)', () => {
  const EXPOSE_SRC = `<rozie name="ExposeProbe">
<data>
  count: 0
</data>
<script>
  function reset() {
    count = 0;
  }
  function focus() {
    inputEl?.focus();
  }
  function untouched() {
    count = count + 1;
  }
  $expose({ reset, focus })
</script>
<template>
  <div>{{ count }}</div>
</template>
</rozie>`;

  it('emits `export function` for each exposed top-level function', () => {
    const scriptBlock = emitScriptFromSrc(EXPOSE_SRC, 'ExposeProbe');
    expect(scriptBlock).toMatch(/export function reset\(/);
    expect(scriptBlock).toMatch(/export function focus\(/);
  });

  it('does NOT export a non-exposed top-level function', () => {
    const scriptBlock = emitScriptFromSrc(EXPOSE_SRC, 'ExposeProbe');
    // `untouched` is declared but not in $expose — stays a bare declaration.
    expect(scriptBlock).toMatch(/(?<!export )function untouched\(/);
    expect(scriptBlock).not.toMatch(/export function untouched\(/);
  });

  it('strips the `$expose(...)` call from the residual script body (no leak)', () => {
    const scriptBlock = emitScriptFromSrc(EXPOSE_SRC, 'ExposeProbe');
    // The compile-time directive must NOT survive as a runtime reference.
    expect(scriptBlock).not.toContain('$expose(');
  });

  it('exported functions retain their original signature (svelte-check infers — D-04)', () => {
    const src = `<rozie name="ExposeArgs">
<data>
  value: ""
</data>
<script>
  function setValue(next) {
    value = next;
  }
  $expose({ setValue })
</script>
<template>
  <div>{{ value }}</div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'ExposeArgs');
    // The exported function keeps its `next` param (typeNeutralizeScript fills
    // the untyped param with `: any`); svelte-check infers the handle type.
    expect(scriptBlock).toMatch(/export function setValue\(next: any\)/);
  });

  it('byte-identity: a non-$expose source gains no `export function`', () => {
    // Counter has user-authored helpers but no $expose — nothing exported.
    const scriptBlock = emitScript(lowerExample('Counter')).scriptBlock;
    expect(scriptBlock).not.toMatch(/export function/);
  });

  it('exports an exposed function that carries a LEADING COMMENT (regression)', () => {
    // Regression: prepending a bare `export ` string to @babel/generator output
    // orphaned the keyword when the declaration had leading comments —
    // `export // comment\nfunction clear()` left `clear` UNexported. The AST-level
    // ExportNamedDeclaration wrap keeps `export` adjacent to the keyword.
    // Surfaced by @rozie-ui/flatpickr's commented clear()/openPicker() handle.
    const src = `<rozie name="ExposeCommented">
<data>
  value: ""
</data>
<script>
  // A leading comment block above the exposed function — must not orphan
  // the export keyword.
  function clear() {
    value = "";
  }
  function plain() {
    value = "x";
  }
  $expose({ clear, plain })
</script>
<template>
  <div>{{ value }}</div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'ExposeCommented');
    // Both must be instance-exported; the comment must precede `export`, never
    // sit between `export` and `function`.
    expect(scriptBlock).toMatch(/export function clear\(/);
    expect(scriptBlock).toMatch(/export function plain\(/);
    // The broken form (orphaned export before a comment) must NOT appear.
    expect(scriptBlock).not.toMatch(/export\s*\n\s*\/\//);
    expect(scriptBlock).not.toMatch(/export \/\//);
  });
});

// Regression — debug `svelte-prop-shadow-self-ref` (2026-06-08).
//
// End-to-end SFC compile of the two prop-shadow facets the unit suite covers at
// the rewriteScript level. The svelte rune idiom lowers EVERY prop to a bare
// destructured local, so a local/param shadowing a prop name would (pre-fix)
// capture the rewritten `$props.X` → `X` identifier:
//   (a) `const X = $props.X` → `const X = X` (TDZ self-reference, runtime crash).
//   (b) `$props.X` inside fn(X){} → bare `X` binds the param (silent wrong value).
// The `deconflictPropShadows` pre-pass renames the colliding local/param to
// `<name>$local` before the rewrite. This test asserts the emitted <script>
// block has NEITHER pathology.
describe('prop-shadow deconfliction — end-to-end SFC emit (svelte-prop-shadow-self-ref)', () => {
  it('a `.rozie` with `const X = $props.X` AND a param-shadow emits clean svelte (no self-ref, no param capture)', () => {
    const src = `<rozie name="PropShadow">
<props>
{
  src: { type: String, default: '' },
  step: { type: Number, default: 1 }
}
</props>
<script>
  function buildSource() {
    const src = $props.src;
    return src.trim();
  }
  function advance(step) {
    return step + $props.step;
  }
</script>
<template>
  <div>{{ buildSource() }} / {{ advance(2) }}</div>
</template>
</rozie>`;
    const scriptBlock = emitScriptFromSrc(src, 'PropShadow');

    // FACET A — no `const src = src` TDZ self-reference. The local is renamed to
    // `src$local` and its initializer reads the bare rune prop `src`.
    expect(scriptBlock).not.toMatch(/const src = src\b/);
    expect(scriptBlock).toContain('const src$local = src;');
    expect(scriptBlock).toContain('return src$local.trim();');

    // FACET B — the `step` param is renamed; `$props.step` lowers to the bare
    // rune prop `step`, so the body reads BOTH the renamed param and the prop.
    expect(scriptBlock).toContain('function advance(step$local');
    expect(scriptBlock).toContain('return step$local + step;');

    // No raw sigil survives in the emitted body.
    expect(scriptBlock).not.toContain('$props.');
    // The top-level rune prop bindings are still the bare names.
    expect(scriptBlock).toMatch(/\bsrc = ''/);
    expect(scriptBlock).toMatch(/\bstep = 1\b/);
  });
});
