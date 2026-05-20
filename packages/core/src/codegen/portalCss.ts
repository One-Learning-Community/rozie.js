/**
 * portalCss — shared `@portal NAME { ... }` CSS-scoping helper (Spike 004).
 *
 * A Rozie wrapper's `<style>` block can host engine-created DOM scoping rules
 * via `@portal NAME { ul { ... } li { ... } }`. parseStyle lowers each such
 * block to a `portal-block` StyleRule with a `children` list of inner
 * selectors (see `StyleAST.ts`). At emit time, every target rewrites each
 * inner selector to a descendant of `[data-rozie-portal-<NAME>="<scopeHash>"]`
 * — the engine subtree inherits this attribute (the portal closure calls
 * `container.setAttribute(...)` at mount time), so the rules cascade through
 * DOM the framework never rendered.
 *
 * This module is target-agnostic. Each target's `emitStyle` places the
 * rewritten CSS into its own scoping sink (React `.module.css`, Vue's second
 * unscoped `<style>`, Svelte's `:global { }`, Angular's `:host ::ng-deep`
 * styles entry, Lit's `static styles`, Solid's inline `<style>` JSX) but the
 * selector rewrite is identical, so it lives here.
 *
 * The component `scopeHash` is reused verbatim (Spike 004 locked decision #1
 * — no per-portal hash). React/Solid/Lit already compute one; Vue/Svelte/
 * Angular have no native scope-hash infra, so `computeScopeHash` here gives
 * them the identical FNV-1a value.
 *
 * Cross-target specificity compensation (quick task 260520-bu7)
 * ------------------------------------------------------------
 * A competing CONSUMER component's scoped `<style>` rule receives a
 * target-dependent specificity bump: React/Solid/Lit +0, Vue/Angular/Svelte
 * +1 attribute unit (their scoped-CSS mechanism appends `[data-v-*]` /
 * `[_ngcontent-*]` / `.svelte-*`). Left uncompensated, an `@portal`-vs-consumer
 * cascade conflict resolves to a different winner per target — the VR matrix's
 * D-10 byte-identity invariant catches this.
 *
 * The fix: each target's `emitStyle` passes a `scopeRepeat` count that repeats
 * the portal scope attribute selector that many ADDITIONAL times
 * (`[a="b"]` → `[a="b"][a="b"]`). Each repeat is a legal CSS attribute
 * selector worth one `(0,1,0)` specificity unit, so the target adds the SAME
 * delta to BOTH the `@portal` rule and the consumer rule — keeping
 * `specificity(@portal) − specificity(consumer)` a target-invariant constant.
 * `scopeRepeat = 0` (the default) is byte-identical to the pre-260520-bu7
 * single-attribute output. The mechanism is plain repeated attribute
 * selectors only — no `:not()`, `@layer`, or `!important`.
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import type { Rule } from 'postcss';
import type { StyleRule } from '../ast/blocks/StyleAST.js';

/**
 * FNV-1a 32-bit, returned as a zero-padded 8-char lowercase hex string.
 * Byte-identical to `packages/targets/react/src/emit/scopeHash.ts` so all 6
 * targets derive the same portal scope hash.
 */
function fnv1a32Hex(s: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Final path segment of a filename, without depending on `node:path`. */
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
 * Compute the stable 8-char-hex component scope id, identical to the React
 * target's `computeScopeHash`. Used by Vue/Svelte/Angular's portal-CSS emit
 * (they have no native scope-hash infrastructure of their own).
 *
 * @param componentName - The component's IR name (e.g., 'PortalListStyled').
 * @param filename      - The .rozie source filename when known. The BASENAME
 *                        is the hash input so absolute and relative path
 *                        forms produce the same hash. May be undefined.
 */
export function computeScopeHash(componentName: string, filename?: string): string {
  const basename = filename ? extractBasename(filename) : '';
  const input = basename ? `${basename}::${componentName}` : componentName;
  return fnv1a32Hex(input);
}

/** Build the portal scope attribute name: `data-rozie-portal-<name>`. */
export function portalAttrName(portalName: string): string {
  return `data-rozie-portal-${portalName}`;
}

/**
 * Build the portal scope attribute selector prefix:
 * `[data-rozie-portal-<name>="<scopeHash>"]`.
 *
 * @param scopeRepeat - Number of ADDITIONAL repeats of the attribute selector
 *                      (quick task 260520-bu7 specificity compensation). `0`
 *                      (default) → `[a="b"]` (byte-identical to pre-260520-bu7);
 *                      `1` → `[a="b"][a="b"]`; `2` → `[a="b"][a="b"][a="b"]`.
 *                      Each repeat adds one `(0,1,0)` CSS specificity unit so a
 *                      target can match the consumer-rule scoping bump its
 *                      framework applies (Vue `[data-v-*]`, Angular
 *                      `[_ngcontent-*]`, Svelte `.svelte-*`).
 */
export function portalScopeSelector(
  portalName: string,
  scopeHash: string,
  scopeRepeat = 0,
): string {
  const attr = `[${portalAttrName(portalName)}="${scopeHash}"]`;
  // attr appears once + `scopeRepeat` additional times, concatenated with no
  // separator so the result is a single compound attribute selector.
  const repeats = scopeRepeat > 0 ? scopeRepeat : 0;
  return attr.repeat(1 + repeats);
}

/**
 * Re-stringify one parsed postcss Rule as a normalized 2-space-indented CSS
 * rule with the portal scope prefix prepended to each comma-separated
 * selector. Custom properties, vendor prefixes, and `!important` flags pass
 * through verbatim (postcss carries them on the decl nodes).
 */
function stringifyScopedRule(rule: Rule, prefix: string): string {
  const scopedSelector = rule.selector
    .split(',')
    .map((s) => `${prefix} ${s.trim()}`)
    .join(',\n');
  const decls: string[] = [];
  rule.walkDecls((decl) => {
    const important = decl.important ? ' !important' : '';
    decls.push(`  ${decl.prop}: ${decl.value}${important};`);
  });
  return `${scopedSelector} {\n${decls.join('\n')}\n}`;
}

/**
 * Rewrite an entire `portal-block` StyleRule into one CSS string,
 * newline-joined. The block is byte-sliced from the original `.rozie` source
 * and re-parsed with postcss so nested at-rules (`@portal X { @media (...) {
 * ul {} } }`) are descended correctly — the prefix is applied only at the
 * bottom selector level. Returns `''` when the block is empty.
 *
 * @param scopeRepeat - Additional repeats of the portal scope attribute
 *                      selector (quick task 260520-bu7). Threaded straight
 *                      through to `portalScopeSelector`. `0` (default) is
 *                      byte-identical to the pre-260520-bu7 output.
 */
export function rewritePortalBlock(
  portalRule: StyleRule,
  source: string,
  scopeHash: string,
  scopeRepeat = 0,
): string {
  const portalName = portalRule.portalName ?? '';
  if (portalName.length === 0) return '';
  const prefix = portalScopeSelector(portalName, scopeHash, scopeRepeat);

  // Byte-slice the whole `@portal NAME { ... }` block and re-parse just its
  // inner content. We strip the `@portal NAME {` header + trailing `}` so
  // postcss parses the inner rules directly.
  const blockText = source.slice(portalRule.loc.start, portalRule.loc.end);
  const openIdx = blockText.indexOf('{');
  const closeIdx = blockText.lastIndexOf('}');
  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) return '';
  const innerCss = blockText.slice(openIdx + 1, closeIdx);

  let root;
  try {
    root = postcss.parse(innerCss);
  } catch {
    return '';
  }

  const parts: string[] = [];
  // Top-level plain rules inside the @portal block.
  root.each((node) => {
    if (node.type === 'rule') {
      parts.push(stringifyScopedRule(node, prefix));
    } else if (node.type === 'atrule') {
      // Nested at-rule (e.g. @media) — wrap its inner rules, keep the at-rule.
      const inner: string[] = [];
      node.walkRules((r) => {
        inner.push(
          stringifyScopedRule(r, prefix)
            .split('\n')
            .map((l) => `  ${l}`)
            .join('\n'),
        );
      });
      parts.push(`@${node.name} ${node.params} {\n${inner.join('\n')}\n}`);
    }
  });
  return parts.join('\n');
}

/**
 * Rewrite every `portal-block` rule in a `StyleSection.portalRules` bucket
 * into a single CSS string, newline-joined. Returns `''` when there are no
 * portal blocks.
 *
 * @param scopeRepeat - Additional repeats of the portal scope attribute
 *                      selector (quick task 260520-bu7 specificity
 *                      compensation). Each target's `emitStyle` owns its own
 *                      per-target count (a local `PORTAL_SCOPE_REPEAT`
 *                      constant) and threads it here. `0` (default) is
 *                      byte-identical to the pre-260520-bu7 output, keeping
 *                      back-compat for any caller not yet threading it.
 */
export function rewriteAllPortalBlocks(
  portalRules: readonly StyleRule[],
  source: string,
  scopeHash: string,
  scopeRepeat = 0,
): string {
  if (portalRules.length === 0) return '';
  return portalRules
    .map((rule) => rewritePortalBlock(rule, source, scopeHash, scopeRepeat))
    .filter((s) => s.length > 0)
    .join('\n');
}
