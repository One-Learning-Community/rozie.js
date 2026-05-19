/**
 * scopeHash — deterministic per-component scope token for Lit's
 * producer-side CSS scoping (Phase 07.6 follow-up to ec24d26).
 *
 * Why this exists: Lit's `static styles` block is shadow-DOM-scoped, but
 * inside the shadow root rules with tag/class selectors (e.g.
 * `header h2 { ... }`) match ANY element rendered into the shadow tree —
 * including consumer-projected content that arrives via property-fill
 * functions (post-ec24d26). The other 5 targets all naturally scope
 * producer rules to producer-template elements via their framework's
 * native mechanism (Vue `[data-v-X]`, Svelte class-hash, Angular
 * `_ngcontent-*`, React/Solid CSS-Modules hashing). Lit needs the same
 * isolation explicitly: stamp every producer-template HTML element with
 * `data-rozie-s-<hash>` and rewrite static-styles selectors to require it.
 *
 * Mirrors `packages/targets/{react,solid}/src/emit/scopeHash.ts` —
 * same algorithm (FNV-1a 32-bit, basename + componentName) for cross-target
 * scope-hash stability.
 *
 * @experimental — shape may change before v1.0
 */

const ATTR_PREFIX = 'data-rozie-s-';

export function computeScopeHash(componentName: string, filename?: string): string {
  const basename = filename ? extractBasename(filename) : '';
  const input = basename ? `${basename}::${componentName}` : componentName;
  return fnv1a32Hex(input);
}

export function scopeAttrName(scopeHash: string): string {
  return ATTR_PREFIX + scopeHash;
}

function extractBasename(filename: string): string {
  let lastSep = -1;
  for (let i = filename.length - 1; i >= 0; i--) {
    const ch = filename.charCodeAt(i);
    if (ch === 47 /* / */ || ch === 92 /* \ */) {
      lastSep = i;
      break;
    }
  }
  return lastSep === -1 ? filename : filename.slice(lastSep + 1);
}

function fnv1a32Hex(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
