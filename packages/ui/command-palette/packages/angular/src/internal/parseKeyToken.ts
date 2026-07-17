/**
 * parseKeyToken.ts — shared modifier-grammar parser (quick 260716-npt
 * Finding 2, dual-parser drift fix).
 *
 * Vendored verbatim into all 6 leaves by codegen.mjs (copyInternal, *.test.ts
 * excluded) — kept framework-neutral and dependency-free (no TS param
 * annotations, mirrors formatKeyToken.ts's convention).
 *
 * Before this module, formatKeyToken.ts (badge display) and actionMenu.ts's
 * matchesActionKey (key matcher) each hand-rolled their OWN reading of the
 * `$mod+$shift+k`-style grammar. formatKeyToken already split on '+' and
 * rendered EVERY segment (so it correctly badges a multi-modifier token);
 * matchesActionKey only ever recognized `$mod+<letter>` or a bare single
 * char — a multi-modifier actionKey rendered a badge that could never fire.
 * This module is the SINGLE source of truth both now consume, so a token
 * that renders a badge is always one the matcher can handle.
 *
 * Grammar (same as formatKeyToken's doc comment):
 *   - Non-string / empty token → null.
 *   - Split on '+'. Each segment is matched CASE-INSENSITIVELY against the 4
 *     modifiers ($mod/$shift/$alt/$ctrl) — author order is preserved in
 *     `segments` for display, but the derived `modifiers` set is order-free
 *     (repeats/reorders collapse to the same match semantics).
 *   - The last segment that is NOT a recognized modifier becomes `key`
 *     (raw case preserved — callers lowercase for comparison as needed).
 */
const MODIFIER_KEYS = ['$mod', '$shift', '$alt', '$ctrl'];

export const parseKeyToken = (token) => {
  if (typeof token !== 'string' || token === '') return null;
  const segments = token.split('+').map((raw) => {
    const lower = raw.toLowerCase();
    const modifier = MODIFIER_KEYS.indexOf(lower) !== -1 ? lower : null;
    return { raw, modifier };
  });
  const modifiers = { mod: false, shift: false, alt: false, ctrl: false };
  let key = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.modifier === '$mod') modifiers.mod = true;
    else if (seg.modifier === '$shift') modifiers.shift = true;
    else if (seg.modifier === '$alt') modifiers.alt = true;
    else if (seg.modifier === '$ctrl') modifiers.ctrl = true;
    else key = seg.raw;
  }
  return { segments, modifiers, key };
};
