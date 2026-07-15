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
 * TODO (RED stub — Task 2 implements the real grammar): returns '' for every
 * input so the Task 1 unit suite observes a clean RED before GREEN.
 */
export const formatKeyToken = (token, isApple) => {
  return '';
};
