import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(import.meta.dirname, '..', '..');
const read = (family: string) => readFileSync(resolve(UI, family, 'src/themes/base.css'), 'utf8');

/** suffix → default, from the wiring lines `--rXX-x: var(--rozie-<family>-x, <default>);` */
function wiredDefaults(css: string, family: string): Map<string, string> {
  const out = new Map<string, string>();
  // comments stripped first: the header prose quotes `var(--rozie-<family>-x, <default>)` and would otherwise match
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp(`var\\(--rozie-${family}-([a-z0-9-]+),\\s*([^;]+)\\);`, 'g');
  for (const m of css.matchAll(re)) out.set(m[1]!, m[2]!.trim().replace(/--rozie-[a-z]+-/g, '--rozie-X-').replace(/--r[a-z]{2}-/g, '--rX-'));
  return out;
}
/** every public suffix mentioned anywhere in the file (wiring lines, plain declarations, comments excluded) */
function publicSuffixes(css: string, family: string): Set<string> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set([...stripped.matchAll(new RegExp(`--rozie-${family}-([a-z0-9-]+)`, 'g'))].map((m) => m[1]!));
}

const COMBOBOX_ONLY = new Set(['chips-padding', 'create-bg', 'inline-input-min-width', 'inline-input-padding', 'inline-padding', 'input-padding', 'input-underline', 'more-color', 'more-size']);
/** check-color and popup-radius are Select-only too, but derived (accent / radius) and so declared in no base.css. */
const SELECT_ONLY = new Set(['control-padding', 'gap', 'placeholder', 'arrow-color', 'arrow-opacity', 'clear-color', 'clear-size', 'active-fg', 'selected-bg', 'selected-fg', 'check', 'z']);

/** Tokens whose default is ANOTHER token of the family (accent / radius), so base.css declares none. */
const DERIVED = new Set(['check-color', 'popup-radius', 'focus-border-color']);
/** every `--rozie-select-*` token READ (`var(...)`) anywhere in Select.rozie, comments and prose included */
const readTokens = (): Set<string> => {
  const src = readFileSync(resolve(import.meta.dirname, '..', 'src/Select.rozie'), 'utf8');
  return new Set([...src.matchAll(/var\(--rozie-select-([a-z0-9-]+)/g)].map((m) => m[1]!));
};

describe('select ↔ combobox token parity', () => {
  const cb = read('combobox'); const sl = read('select');
  const cbPub = publicSuffixes(cb, 'combobox'); const slPub = publicSuffixes(sl, 'select');
  const cbDef = wiredDefaults(cb, 'combobox'); const slDef = wiredDefaults(sl, 'select');

  it('every combobox token exists on select unless listed as combobox-only', () => {
    expect([...cbPub].filter((s) => !slPub.has(s) && !COMBOBOX_ONLY.has(s))).toEqual([]);
  });
  it('every select token exists on combobox unless listed as select-only', () => {
    expect([...slPub].filter((s) => !cbPub.has(s) && !SELECT_ONLY.has(s))).toEqual([]);
  });
  it('the exception lists hold no stale entries', () => {
    expect([...COMBOBOX_ONLY].filter((s) => !cbPub.has(s) || slPub.has(s))).toEqual([]);
    expect([...SELECT_ONLY].filter((s) => !slPub.has(s) || cbPub.has(s))).toEqual([]);
  });
  it('every token Select.rozie reads is declared in base.css or listed as derived', () => {
    expect([...readTokens()].filter((t) => !slPub.has(t) && !DERIVED.has(t))).toEqual([]);
  });
  it('the derived list holds no stale entries', () => {
    const read = readTokens();
    expect([...DERIVED].filter((t) => !read.has(t) || slPub.has(t))).toEqual([]);
  });
  it('shared tokens have identical defaults', () => {
    const diffs = [...slDef].filter(([s, d]) => cbDef.has(s) && cbDef.get(s) !== d).map(([s, d]) => `${s}: select=${d} combobox=${cbDef.get(s)}`);
    expect(diffs).toEqual([]);
  });
});
