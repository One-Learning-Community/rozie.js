// Phase 2 Plan 02-04 Task 2 — MOD-04 key/button filter builtins.
//
// All key/button filters share the same shape: `kind: 'filter', modifier: <name>, args: []`.
// `ctx.event` distinguishes key (keydown/keyup) vs mouse (click/mousedown) at emit time.
// Filters cover: escape, enter, tab, delete, space, up, down, left, right, home, end,
// pageUp, pageDown, middle (mouse-only).
import { describe, expect, it } from 'vitest';
import {
  keyFilters,
  KEY_FILTER_NAMES,
  registerKeyFilters,
} from '../../../src/modifiers/builtins/keyFilters.js';
import { ModifierRegistry, type ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

function findFilter(name: string) {
  const f = keyFilters.find((k) => k.name === name);
  if (!f) throw new Error(`key filter '${name}' not found`);
  return f;
}

const KEYDOWN_CTX: ModifierContext = {
  source: 'template-event',
  event: 'keydown',
  sourceLoc: { start: 100, end: 107 },
};

const CLICK_CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: { start: 200, end: 206 },
};

describe('builtin: key filters — Plan 02-04', () => {
  it('exports KEY_FILTER_NAMES list with 14 entries (escape..pageDown + middle)', () => {
    expect(KEY_FILTER_NAMES).toContain('escape');
    expect(KEY_FILTER_NAMES).toContain('enter');
    expect(KEY_FILTER_NAMES).toContain('tab');
    expect(KEY_FILTER_NAMES).toContain('delete');
    expect(KEY_FILTER_NAMES).toContain('space');
    expect(KEY_FILTER_NAMES).toContain('up');
    expect(KEY_FILTER_NAMES).toContain('down');
    expect(KEY_FILTER_NAMES).toContain('left');
    expect(KEY_FILTER_NAMES).toContain('right');
    expect(KEY_FILTER_NAMES).toContain('home');
    expect(KEY_FILTER_NAMES).toContain('end');
    expect(KEY_FILTER_NAMES).toContain('pageUp');
    expect(KEY_FILTER_NAMES).toContain('pageDown');
    expect(KEY_FILTER_NAMES).toContain('middle');
    expect(KEY_FILTER_NAMES.length).toBe(14);
  });

  it('.escape (keydown ctx) → filter entry with modifier: "escape"', () => {
    const result = findFilter('escape').resolve([], KEYDOWN_CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'filter',
      modifier: 'escape',
      args: [],
      sourceLoc: KEYDOWN_CTX.sourceLoc,
    });
  });

  it('.enter → filter entry with modifier: "enter"', () => {
    const result = findFilter('enter').resolve([], KEYDOWN_CTX);
    expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: 'enter' });
  });

  it('.tab → filter entry with modifier: "tab"', () => {
    const result = findFilter('tab').resolve([], KEYDOWN_CTX);
    expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: 'tab' });
  });

  it('.left in keydown ctx → filter entry with modifier: "left" (key — ArrowLeft)', () => {
    const result = findFilter('left').resolve([], KEYDOWN_CTX);
    expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: 'left' });
  });

  it('.left in click ctx → same filter shape (emitter disambiguates via ctx.event)', () => {
    const result = findFilter('left').resolve([], CLICK_CTX);
    expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: 'left' });
  });

  it('.middle (mouse-only) → filter entry with modifier: "middle"', () => {
    const result = findFilter('middle').resolve([], CLICK_CTX);
    expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: 'middle' });
  });

  it('all 14 key/button filters resolve cleanly with no args + emit no diagnostics', () => {
    for (const name of KEY_FILTER_NAMES) {
      const result = findFilter(name).resolve([], KEYDOWN_CTX);
      expect(result.diagnostics, `${name} should not emit diagnostics`).toEqual([]);
      expect(result.entries[0]).toMatchObject({ kind: 'filter', modifier: name });
    }
  });

  it('any key filter with args → ROZ111 arity mismatch (none expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 7, end: 8 } },
    ];
    const result = findFilter('escape').resolve(args, KEYDOWN_CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });

  it('registerKeyFilters(reg) registers all 14 names into a fresh registry', () => {
    const reg = new ModifierRegistry();
    registerKeyFilters(reg);
    for (const name of KEY_FILTER_NAMES) {
      expect(reg.has(name), `${name} should be registered`).toBe(true);
    }
    expect(reg.list().length).toBe(14);
  });
});
