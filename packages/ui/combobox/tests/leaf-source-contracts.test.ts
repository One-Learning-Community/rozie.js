/**
 * leaf-source-contracts.test.ts — six-leaf structural gates for quick task
 * 260903-0s1's two combobox source fixes (E1 chip-remove keyboard activation,
 * E2 resolver-routed syncQueryToValue). Mirrors prohibitions.test.ts's reader
 * idiom: read the SIX emitted `Combobox.<ext>` leaves as plain source text and
 * assert on slices of them — no compile, no mount.
 *
 * Each gate is a pure `check(source) -> violations[]` function, never a
 * boolean baked into the function itself, so a deliberately-mutated NEGATIVE
 * fixture can prove the gate actually fires rather than only ever reporting
 * green (the same discipline prohibitions.test.ts documents in its header).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const TARGETS = [
  { name: 'react', ext: 'tsx' },
  { name: 'vue', ext: 'vue' },
  { name: 'svelte', ext: 'svelte' },
  { name: 'angular', ext: 'ts' },
  { name: 'solid', ext: 'tsx' },
  { name: 'lit', ext: 'ts' },
] as const;

interface LeafSource {
  id: string;
  source: string;
}

function readLeaf(name: string, ext: string): LeafSource {
  const path = resolve(ROOT, 'packages', name, 'src', `Combobox.${ext}`);
  return { id: name, source: readFileSync(path, 'utf8') };
}

const leaves: LeafSource[] = TARGETS.map(({ name, ext }) => readLeaf(name, ext));

// ─────────────────────────────────────────────────────────────────────────
// E1 — chip remove control: click-family activation, mousedown stays
// pointer-only preventDefault.
// ─────────────────────────────────────────────────────────────────────────
//
// The button's `aria-label` binding calls `chipRemoveLabel(row` in EVERY
// target (confirmed by reading all six leaves; Solid appends the extra `()`
// signal-call parens, Lit prefixes `this.` — both are substring-compatible
// with this shorter anchor), immediately followed by its handler bindings and
// closed by `</button>` — a stable, framework-agnostic slice of the button's
// own region, regardless of each target's very different event-binding syntax
// (JSX onMouseDown/onClick, Vue @mousedown.prevent/@click, Svelte
// onmousedown/onclick, Angular (mousedown)/(click), Lit @mousedown/@click
// template-literal bindings). Deliberately NOT the `rozie-combobox-chip__remove`
// CLASS string: that literal also appears earlier in several leaves' emitted
// CSS block (a `<style>`/CSS-in-JS selector), and `indexOf` would anchor on
// the CSS occurrence instead of the actual markup — confirmed against the
// real Solid leaf, which defines its stylesheet ahead of the component body.
const CHIP_REMOVE_MARKER = 'chipRemoveLabel(row';
const CHIP_REMOVE_CLOSE = '</button>';
// `chipRemoveLabel(row` also appears in the source-comment above the helper's
// own definition ("chipRemoveLabel(row): the aria-label naming...") and, on
// React specifically, in the `function chipRemoveLabel(row: any) {` signature
// itself — both far (thousands of characters) from any `</button>`. The real
// markup usage always has `</button>` within a short window (the button's
// remaining attributes, its two handlers, and the literal `×` text).
// Iterating candidate occurrences and taking the first one with a NEARBY
// close tag skips the false positives regardless of whether the template
// comes before the script (Angular's `@Component({ template })`) or after it
// (the other five targets).
const NEARBY_WINDOW = 500;

// The activation handler's name — chosen by this fix (Combobox.rozie's new
// `onChipRemoveActivate`). Referenced here as a literal on purpose: this test
// is authored BEFORE the source fix lands (RED-first), so the name is fixed
// by this task's own design, not discovered after the fact.
const ACTIVATION_HANDLER_NAME = 'onChipRemoveActivate';

function extractChipRemoveButtonRegion(source: string): string | null {
  let searchFrom = 0;
  for (;;) {
    const markerIdx = source.indexOf(CHIP_REMOVE_MARKER, searchFrom);
    if (markerIdx === -1) return null;
    const endIdx = source.indexOf(CHIP_REMOVE_CLOSE, markerIdx);
    if (endIdx !== -1 && endIdx - markerIdx < NEARBY_WINDOW) {
      return source.slice(markerIdx, endIdx + CHIP_REMOVE_CLOSE.length);
    }
    searchFrom = markerIdx + CHIP_REMOVE_MARKER.length;
  }
}

/**
 * check(source) -> violations[]. Splits the button region at the first
 * click-family token: everything before is the pointer (mousedown) half,
 * everything from there on is the click (activation) half — valid because
 * the fix always emits the mousedown binding BEFORE the click binding
 * (template attribute order = emission order for every one of these targets).
 */
function checkChipRemoveActivationContract(source: string): string[] {
  const violations: string[] = [];
  const region = extractChipRemoveButtonRegion(source);
  if (region === null) {
    violations.push('chip remove button region not found (marker or closing </button> missing)');
    return violations;
  }

  const clickIdx = region.search(/click/i);
  if (clickIdx === -1) {
    violations.push('no click-family binding on the chip remove button');
    return violations;
  }
  const pointerHalf = region.slice(0, clickIdx);
  const clickHalf = region.slice(clickIdx);

  if (!/mousedown/i.test(pointerHalf)) {
    violations.push('no mousedown-family binding precedes the click binding');
  }
  // Vue's `.prevent` modifier suppresses the native focus shift declaratively
  // — the compiled SFC template never spells out the literal word
  // "preventDefault" (that call is injected by Vue's runtime modifier
  // handling, not visible as template text), while the other five targets DO
  // emit a literal `$event.preventDefault()` call inside the handler body. So
  // either spelling counts as B1 evidence.
  if (!/preventdefault/i.test(pointerHalf) && !/\.prevent\b/.test(pointerHalf)) {
    violations.push('the mousedown path does not call preventDefault (B1 regression)');
  }
  const activationRe = new RegExp(ACTIVATION_HANDLER_NAME, 'g');
  if (activationRe.test(pointerHalf)) {
    violations.push('the activation handler is invoked from the mousedown path — would double-remove (B3 regression)');
  }
  const clickActivationMatches = clickHalf.match(new RegExp(ACTIVATION_HANDLER_NAME, 'g')) ?? [];
  if (clickActivationMatches.length !== 1) {
    violations.push(
      `expected exactly one ${ACTIVATION_HANDLER_NAME} call on the click path, found ${clickActivationMatches.length}`,
    );
  }

  return violations;
}

describe('leaf-source-contracts — E1 chip remove control (six-leaf structural gate)', () => {
  it('the negative fixture proves the gate actually fires (mousedown-only, no click binding at all)', () => {
    const negative = `<button type="button" class="rozie-combobox-chip__remove" aria-label={rozieAttr(chipRemoveLabel(row))} onMouseDown={($event) => { $event.preventDefault(); removeChipValue(row.value); }}>×</button>`;
    expect(checkChipRemoveActivationContract(negative)).not.toEqual([]);
  });

  it('the negative fixture proves the gate fires when the activation handler is (also) wired to mousedown', () => {
    const negative = `<button type="button" class="rozie-combobox-chip__remove" aria-label={rozieAttr(chipRemoveLabel(row))} onMouseDown={($event) => { $event.preventDefault(); onChipRemoveActivate(row.value); }} onClick={($event) => { onChipRemoveActivate(row.value); }}>×</button>`;
    expect(checkChipRemoveActivationContract(negative)).not.toEqual([]);
  });

  it('a positive fixture with the doc-comment and a `function chipRemoveLabel(row: any) {` definition both preceding the real markup (the actual React leaf shape) is still resolved correctly, not anchored on either false positive', () => {
    const reactShaped = `// chipRemoveLabel(row): the aria-label naming what a chip's remove control removes.
  function chipRemoveLabel(row: any) {
    return 'Remove ' + String(row.label);
  }
  ${'const filler = 1;\n'.repeat(80)}
  <button type="button" className={"rozie-combobox-chip__remove"} aria-label={rozieAttr(chipRemoveLabel(row))} onMouseDown={($event) => { $event.preventDefault(); onChipRemovePointerDown(); }} onClick={($event) => { onChipRemoveActivate(row.value); }}>×</button>`;
    expect(checkChipRemoveActivationContract(reactShaped)).toEqual([]);
  });

  it('a correctly-shaped fixture (mousedown.prevent empty, click activates) reports zero violations', () => {
    const positive = `<button type="button" class="rozie-combobox-chip__remove" aria-label={rozieAttr(chipRemoveLabel(row))} onMouseDown={($event) => { $event.preventDefault(); onChipRemovePointerDown(); }} onClick={($event) => { onChipRemoveActivate(row.value); }}>×</button>`;
    expect(checkChipRemoveActivationContract(positive)).toEqual([]);
  });

  for (const leaf of leaves) {
    it(`${leaf.id}: the chip remove button binds click to the activation handler and keeps mousedown preventDefault-only`, () => {
      expect(checkChipRemoveActivationContract(leaf.source)).toEqual([]);
    });
  }
});
