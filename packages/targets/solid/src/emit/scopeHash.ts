/**
 * scopeHash — deterministic per-component scope token used by the
 * scoped-CSS rewriter (`scopeCss`) and the template-side attribute
 * injector in `emitTemplateNode`.
 *
 * Why this exists: Solid has no CSS Modules pipeline analogous to Vite's
 * React CSS Modules — `emitStyle` inlines the component's CSS as a `<style>`
 * JSX element. Without selector rewriting, bare element selectors leak
 * globally. To match Vue/Svelte/Angular/Lit component-scoped semantics,
 * the Solid emitter rewrites every selector to include a unique attribute
 * (`button[data-rozie-s-<hash>]`) AND injects the same attribute on
 * every host element rendered by the component.
 *
 * Hash derivation matches the React target's behavior:
 *   - Prefer the .rozie filename basename when available — stable across
 *     builds and absolute/relative path normalization. The basename keeps
 *     the three emit-paths (direct `compile()`, CLI `runBuildMatrix`,
 *     babel-plugin sibling-write) byte-parity-equivalent.
 *   - Fall back to the component's IR name when no filename is provided.
 *
 * FNV-1a 32-bit was chosen over MD5/SHA-1 to avoid pulling in `crypto`
 * for the emitter (keeps the package free of Node-only imports). 8 hex
 * chars give 2^32 unique scopes — far beyond the realistic per-bundle
 * component count.
 *
 * @experimental — shape may change before v1.0
 */

const ATTR_PREFIX = 'data-rozie-s-';

/**
 * Compute a stable 8-char-hex scope id for a component.
 *
 * @param componentName - The component's IR name (e.g., 'Counter').
 * @param filename      - The .rozie source filename when known. The BASENAME
 *                        is used as the hash input so absolute and relative
 *                        path forms produce the same hash. May be undefined.
 */
export function computeScopeHash(componentName: string, filename?: string): string {
  const basename = filename ? extractBasename(filename) : '';
  const input = basename ? `${basename}::${componentName}` : componentName;
  return fnv1a32Hex(input);
}

/**
 * Build the full attribute name: `data-rozie-s-<hash>`.
 */
export function scopeAttrName(scopeHash: string): string {
  return ATTR_PREFIX + scopeHash;
}

/**
 * Return the final path segment of a filename without depending on
 * `node:path` (this module stays platform-neutral). Handles both POSIX
 * and Windows separators conservatively — the basename is whatever
 * follows the last `/` or `\`.
 */
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

/**
 * FNV-1a 32-bit, returned as a zero-padded 8-char lowercase hex string.
 */
function fnv1a32Hex(s: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit multiply via Math.imul for correct overflow semantics in JS.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
