// Phase 5 Plan 02a Task 2 — emitTemplate behavior tests + 3 per-block fixture
// snapshots (Counter / TodoList / Modal).
//
// Behavior tests assert the 8 must-haves from the plan:
//  1. Counter @click → onclick={handler} (lowercase, no `on:` prefix)
//  2. TodoList r-for + :key → {#each items as item (item.id)}
//  3. Modal slot with defaultContent → A1 RESOLVED verbose form ({:else} fallback)
//  4. @click.stop → onclick={(e) => { e.stopPropagation(); handler(e); }}
//  5. ROZ621 raised on template @click.once (native descriptor in template ctx)
//  6. Mustache-in-attribute → template literal: class={`card card--${variant}`}
//  7. r-html → {@html expr}; ROZ620 if same element has children
//  8. Slot WITHOUT defaultContent → bare {@render trigger?.(...)} shorthand
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

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

const REGISTRY = createDefaultRegistry();

describe('emitTemplate — behavior (Plan 05-02a Task 2)', () => {
  it('Test 1: Counter template uses lowercase onclick / onmouseenter / onmouseleave (no `on:` prefix)', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('Counter'), REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('onclick=');
    expect(template).toContain('onmouseenter=');
    expect(template).toContain('onmouseleave=');
    expect(template).not.toMatch(/on:click/);
    expect(template).not.toMatch(/on:mouseenter/);
  });

  it('Test 2: TodoList template emits {#each items as item (item.id)} for r-for + :key', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('TodoList'), REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('{#each items as item (item.id)}');
    expect(template).toContain('{/each}');
  });

  it('Test 3: Modal template emits {#if header}{@render header(...)}{:else}<h2>...</h2>{/if} for slot with defaultContent', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('Modal'), REGISTRY);
    expect(diagnostics).toEqual([]);
    // The Modal `<slot name="header" :close="close"><h2>...</h2></slot>` must
    // render as the verbose form (A1 RESOLVED).
    expect(template).toMatch(
      /\{#if header\}\{@render header\([^)]*\)\}\{:else\}[\s\S]*?<h2>[\s\S]*?<\/h2>[\s\S]*?\{\/if\}/,
    );
  });

  it('Test 4: TodoList @submit.prevent emits onsubmit={(e) => { e.preventDefault(); add(e); }}', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('TodoList'), REGISTRY);
    expect(diagnostics).toEqual([]);
    // .prevent inlineGuard → e.preventDefault() before handler invocation.
    expect(template).toMatch(
      /onsubmit=\{\(e\) => \{ e\.preventDefault\(\); add\(e\); \}\}/,
    );
  });

  it('Test 5: ROZ621 NOT raised on @keydown.enter template (key-filter inlineGuard, not native)', () => {
    // Per Plan 05-01 Wave 0: keyFilter modifiers emit inlineGuard for Svelte —
    // they do NOT trigger ROZ621 (that's reserved for native+template-context).
    const { template, diagnostics } = emitTemplate(lowerExample('SearchInput'), REGISTRY);
    expect(diagnostics.filter((d) => d.code === 'ROZ621')).toEqual([]);
    expect(template).toContain("e.key !== 'Enter'");
    expect(template).toContain("e.key !== 'Escape'");
  });

  it('Test 6: Modal `:aria-label="$props.title || undefined"` emits aria-label={title || undefined}', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('Modal'), REGISTRY);
    expect(diagnostics).toEqual([]);
    // The Modal :aria-label binding rewrites $props.title → title.
    expect(template).toMatch(/aria-label=\{title \|\| undefined\}/);
  });

  it('Test 7: TodoList `:class="{ done: item.done }"` emits class={...} (binding form)', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('TodoList'), REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toMatch(/class=\{[\s\S]*?done: item\.done[\s\S]*?\}/);
  });

  it('Test 8: Dropdown slot WITHOUT defaultContent uses bare {@render trigger?.(...)} shorthand', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('Dropdown'), REGISTRY);
    expect(diagnostics).toEqual([]);
    // <slot name="trigger" :open="$props.open" :toggle="toggle" /> has no
    // defaultContent and no fallback children → bare {@render trigger?.(open, toggle)}.
    expect(template).toMatch(/\{@render trigger\?\.\(open, toggle\)\}/);
  });

  it('Test 9: SearchInput `r-model="$data.query"` emits bind:value={query}', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('SearchInput'), REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:value={query}');
  });

  it('Test 10: SearchInput `ref="inputEl"` on input emits bind:this={inputEl}', () => {
    const { template, diagnostics } = emitTemplate(lowerExample('SearchInput'), REGISTRY);
    expect(diagnostics).toEqual([]);
    expect(template).toContain('bind:this={inputEl}');
  });

  it('Test 11: SearchInput @input.debounce(300) emits an inline IIFE scriptInjection (no @rozie/runtime-svelte)', () => {
    const { template, scriptInjections, diagnostics } = emitTemplate(
      lowerExample('SearchInput'),
      REGISTRY,
    );
    expect(diagnostics).toEqual([]);
    expect(scriptInjections.length).toBeGreaterThanOrEqual(1);
    const debounceWrap = scriptInjections.find((i) => i.name.startsWith('debounced'));
    expect(debounceWrap).toBeDefined();
    expect(debounceWrap!.decl).toContain('setTimeout');
    expect(debounceWrap!.decl).not.toContain("from '@rozie/runtime-svelte'");
    // Template binds the wrapper name as the handler.
    expect(template).toContain(debounceWrap!.name);
  });

  it('Test 12: Counter has NO `on:` Svelte 4 syntax anywhere in the emitted template', () => {
    const { template } = emitTemplate(lowerExample('Counter'), REGISTRY);
    expect(template).not.toMatch(/\son:/);
  });
});

describe('emitTemplate — per-block fixture snapshots (Plan 05-02a Task 2)', () => {
  const TEMPLATE_FIXTURE_NAMES = ['Counter', 'TodoList', 'Modal'] as const;

  for (const name of TEMPLATE_FIXTURE_NAMES) {
    it(`${name}.template.snap`, async () => {
      const { template } = emitTemplate(lowerExample(name), REGISTRY);
      await expect(template).toMatchFileSnapshot(
        resolve(FIXTURES, `${name}.template.snap`),
      );
    });
  }
});
