/**
 * formatKeyToken.ts — shared modifier-grammar → display-string helper.
 *
 * Vendored verbatim into all 6 leaves by codegen.mjs (copyInternal, *.test.ts
 * excluded) — kept framework-neutral and dependency-free (no TS param
 * annotations; see CommandPalette.rozie's other src/internal/ helpers for the
 * same convention).
 *
 * Formats an author-side key token (the same `$mod+p` / `$mod+$shift+p`
 * grammar `matchesActionKey` MATCHES against, see internal/actionMenu.ts) for
 * DISPLAY only — this module never binds or listens for a key itself.
 *
 * Grammar:
 *   - Non-string / empty token → ''.
 *   - Split on '+'. Each segment is matched CASE-INSENSITIVELY against the 4
 *     modifiers below; a match renders the platform-appropriate glyph/word —
 *     author ORDER is preserved (no canonical reordering).
 *   - The FINAL segment, when it is NOT a modifier: a single character is
 *     uppercased (`p` → `P`); a multi-character token (`F5`, `enter`, `Tab`)
 *     gets its first letter capitalized on BOTH platforms — the shared
 *     key-name convention (⇧Enter / Shift+Enter, ⌘Delete / Ctrl+Delete).
 *     Already-cased input (`F5`, `Tab`) is unaffected.
 *   - Any unrecognized NON-final segment is left verbatim (untouched case).
 *   - Join: Apple = straight concatenation (no separator); non-Apple = '+'.
 */
const MODIFIERS = {
  '$mod': { apple: '⌘', other: 'Ctrl' },
  '$shift': { apple: '⇧', other: 'Shift' },
  '$alt': { apple: '⌥', other: 'Alt' },
  '$ctrl': { apple: '⌃', other: 'Ctrl' },
};

export const formatKeyToken = (token, isApple) => {
  if (typeof token !== 'string' || token === '') return '';
  const segments = token.split('+');
  const lastIndex = segments.length - 1;
  const rendered = segments.map((segment, i) => {
    const mod = MODIFIERS[segment.toLowerCase()];
    if (mod) return isApple ? mod.apple : mod.other;
    if (i !== lastIndex) return segment;
    if (segment.length === 1) return segment.toUpperCase();
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  });
  return rendered.join(isApple ? '' : '+');
};
