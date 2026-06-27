/**
 * surface.test.ts — Phase 64 P0 cross-package `.rzts` boundary gate as a vitest
 * test (so it runs under `turbo run test`, not just the standalone
 * scripts/compile-headless-core-check.mjs).
 *
 * Re-asserts the SAME boundary proof the .mjs gate checks: a CROSS-PACKAGE
 * bare-specifier `.rzts` partial (`@rozie-ui/headless-core/smoke.rzts`) resolves
 * + inlines (via inlineScriptPartials()) + compiles with ZERO error diagnostics
 * on all 6 targets, the partial decl is spliced into the host body, and the
 * partial DISSOLVES (no surviving runtime import).
 *
 * There is NO component IR here (the partial exports a pure function, not a
 * component) — so unlike the per-family surface gates we assert only the
 * compile×6 zero-error + splice + dissolve contract, not a props/emits/slots
 * surface. Pure GLUE over the @rozie/core public API — no compiler change.
 */
import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// Synthetic host path INSIDE the package so the package's own `exports` map
// self-resolves the bare specifier (enhanced-resolve self-reference).
const FILENAME = resolve(ROOT, 'scripts', '__smoke-host.rozie');

const BARE_SPECIFIER = '@rozie-ui/headless-core/smoke.rzts';

const source = `<rozie name="HeadlessCoreSmokeHost">
<script lang="ts">
import { headlessCoreSmoke } from '${BARE_SPECIFIER}'
const probe = headlessCoreSmoke(41)
</script>
<template>
  <div data-testid="headless-core-smoke">{{ probe }}</div>
</template>
</rozie>
`;

// ── listCore.rzts (P2) — a SELECT-ONLY smoke host inlining the shared list spine ──────────────
// A trimmed Listbox satisfying the listCore.rzts HOST CONTRACT (input-mode discriminant props,
// the option/value/state surface, the reassigned module-`let`s typeBuffer/typeTimer, the impure
// $refs fns focusControl/scrollActiveIntoView) that references a broad slice of the imported spine
// so the tree-shaker keeps the decls — proving the REAL list spine resolves + inlines + dissolves
// cross-package ×6.
const LISTCORE_SPECIFIER = '@rozie-ui/headless-core/listCore.rzts';
const listCoreSource = `<rozie name="ListCoreSmokeHost">
<props>
{
  options: { type: Array, default: () => [] },
  value: { type: null, default: null, model: true },
  multiple: { type: Boolean, default: false },
  combobox: { type: Boolean, default: false },
  filterable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  closeOnSelect: { type: Boolean, default: true },
  optionLabel: { type: Function, default: null },
  optionValue: { type: Function, default: null },
  optionDisabled: { type: Function, default: null },
  id: { type: String, default: 'rozie-listcore-smoke' },
}
</props>
<data>
{ open: false, activeIndex: -1, query: '' }
</data>
<script>
let typeBuffer = ''
let typeTimer = null
import { labelOf, optionId, visibleOptions, selectedLabel, activeDescendant, isSelected, open, close, toggle, clear, select, onControlKeyDown, onOptionPointerMove } from '${LISTCORE_SPECIFIER}'
const focusControl = () => { $refs.triggerEl?.focus() }
const scrollActiveIntoView = () => { if ($refs.listEl) void 0 }
$onUnmount(() => { if (typeTimer !== null) clearTimeout(typeTimer) })
$expose({ open, close, toggle, clear, focusControl })
</script>
<template>
  <div class="lc-smoke">
    <button ref="triggerEl" type="button" role="combobox" :aria-activedescendant="activeDescendant" @click="toggle" @keydown="onControlKeyDown($event)">
      <span r-if="selectedLabel">{{ selectedLabel }}</span>
    </button>
    <div r-if="$data.open" ref="listEl" role="listbox">
      <div r-for="opt, index in visibleOptions()" :key="optionId(index)" :id="optionId(index)" role="option" :aria-selected="!!isSelected(opt)" @click="select(opt)" @mousemove="onOptionPointerMove(index)">
        {{ labelOf(opt) }}
      </div>
    </div>
  </div>
</template>
</rozie>
`;

// Match the import STATEMENT form only — Vue preserves the partial's leading
// comment banner (which mentions the specifier in prose); the import form is the
// true dissolve signal.
const SURVIVING_IMPORT = /from\s*['"]@rozie-ui\/headless-core/;

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

describe('headless-core cross-package .rzts boundary (P0)', () => {
  it.each(TARGETS)(
    'compile(%s) resolves + inlines + dissolves the bare-specifier partial with zero errors',
    (target) => {
      const r = compile(source, { target, filename: FILENAME, resolverRoot: ROOT });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      expect(errs).toEqual([]);
      expect(r.code.length).toBeGreaterThan(0);
      // The partial decl spliced into host scope.
      expect(r.code).toContain('headlessCoreSmoke');
      expect(r.code).toContain('n + 1');
      // The partial dissolved — no surviving runtime import to headless-core.
      expect(SURVIVING_IMPORT.test(r.code)).toBe(false);
    },
  );
});

describe('headless-core listCore.rzts shared list spine (P2)', () => {
  it.each(TARGETS)(
    'compile(%s) resolves + inlines + dissolves the select-only list spine with zero errors',
    (target) => {
      const r = compile(listCoreSource, { target, filename: FILENAME, resolverRoot: ROOT });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      expect(errs).toEqual([]);
      expect(r.code.length).toBeGreaterThan(0);
      // A fragment of nextEnabled's body — pulled in transitively via the
      // move/onControlKeyDown reducer chain (proof the splice landed).
      expect(r.code).toContain('for (let step = 0');
      // The partial dissolved — no surviving runtime import to headless-core.
      expect(SURVIVING_IMPORT.test(r.code)).toBe(false);
    },
  );
});
