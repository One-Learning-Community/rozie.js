/**
 * emitStyle — Solid target.
 *
 * Pitfall 3 (Phase 06.3 RESEARCH.md): Solid has no CSS Modules pipeline
 * analogous to Vite's React CSS Modules. Pre-pre-Phase-16 emitter inlined
 * each component's scoped CSS as a sibling `<style>` JSX element in the
 * rendered tree. That worked for in-isolation rendering but broke same-
 * specificity cascade when a consumer composed a wrapper: the wrapper's
 * inline `<style>` rendered AFTER the consumer's `<style>` (and once per
 * wrapper INSTANCE), so source-order made the wrapper's same-specificity
 * rules win — wiping consumer overrides like the `.extra-variant {
 * font-weight: 600 }` rule in the `ThemedButtonConsumer · solid` matrix
 * VR cell.
 *
 * Pre-Phase-16 Item-1-residual closure (2026-05-24) — switched to module-
 * top `document.head` injection via the `__rozieInjectStyle` runtime
 * helper. Wrapper modules are loaded BEFORE consumer modules (consumer's
 * `import X from '...'` resolves wrapper first), so wrapper styles land
 * in `<head>` first and consumer styles second — restoring the source-
 * order cascade the other five targets already get via their respective
 * per-framework style pipelines.
 *
 * Output:
 *   - Scoped rules → `__rozieInjectStyle(<scopeKey>, <css>)` side-effect
 *     statement at module top. `<scopeKey>` is `'<componentName>-<hash>'`
 *     so HMR replacements of the same component refresh the same `<style>`
 *     element in-place (instead of appending duplicates).
 *   - `:root { }` rules → folded into the SAME injection (separated by a
 *     newline). Cascade order is identical (both live in `<head>`); v1
 *     keeps one injection-per-component for simplicity.
 *   - When the component has NO styles, no injection is emitted.
 *
 * CSS Rule Serialization:
 *   Same byte-slice approach as the React/Vue/Svelte/Lit targets — slices
 *   each rule's bytes from the original `.rozie` source by absolute
 *   `loc.start..loc.end`. Scoped slices route through `scopeCss` so every
 *   selector gets `[data-rozie-s-<hash>]` appended; `:root` rules are
 *   spliced verbatim (already-global by their own semantics).
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { scopeCss } from './scopeCss.js';
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * Solid: 1. A competing consumer scoped-CSS rule is run through `scopeCss`,
 * which appends `[data-rozie-s-<hash>]` to every selector — one extra
 * `(0,1,0)` specificity unit. Repeating the `@portal` scope attribute once
 * matches that delta so the `@portal`-vs-consumer cascade resolves identically
 * to every other target.
 *
 * (The plan's first-guess `0` assumed unscoped-by-default CSS; the VR matrix
 * oracle in Task 2 corrected it once `scopeCss`'s consumer-rule
 * `[data-rozie-s-*]` append was accounted for.)
 */
const PORTAL_SCOPE_REPEAT = 1;

export interface EmitStyleResult {
  /**
   * Module-top side-effect statement that injects the component's CSS into
   * `document.head`, e.g. `__rozieInjectStyle('ThemedButton-7914ecaa',
   * '.btn[data-rozie-s-7914ecaa] { ... }');`. Empty string when the
   * component has no styles. The shell splices this into the module
   * preamble (after imports, before the component function declaration)
   * so it runs ONCE at module-load time per component class.
   */
  injectStatement: string;
  /**
   * True when `injectStatement` references `__rozieInjectStyle` — the
   * shell uses this signal to add the import to the runtime collector.
   * (Cheaper than `injectStatement.includes(...)` and avoids the
   * collector hearing about every empty-style component.)
   */
  needsInjectHelper: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Slice each rule from the original .rozie source and join with newlines.
 */
function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  const parts: string[] = [];
  for (const rule of rules) {
    const slice = source.slice(rule.loc.start, rule.loc.end);
    parts.push(slice);
  }
  return parts.join('\n');
}

/**
 * Escape CSS text for inclusion in a JS template literal:
 *   - Backslash → \\
 *   - Backtick → \`
 *   - ${ → \${
 */
function escapeCssForTemplateLiteral(css: string): string {
  return css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/**
 * Re-stringify a StyleSection into a module-top `__rozieInjectStyle(...)`
 * side-effect statement.
 *
 * @param componentName — IR component name, used as the human-readable half
 *                        of the injection cache key (`'<name>-<hash>'`).
 * @param styles     — Phase 2 IR StyleSection (split by lowerStyles).
 * @param source     — original .rozie source text (for byte-slice serialization).
 * @param scopeHash  — per-component scope token (8-char hex). When provided,
 *                     every scoped rule's selector list is rewritten to include
 *                     `[data-rozie-s-<scopeHash>]`. When omitted (empty), the
 *                     emitter falls back to the unscoped byte-slice — kept for
 *                     back-compat with old callers that don't thread a hash.
 */
export function emitStyle(
  componentName: string,
  styles: StyleSection,
  source: string,
  scopeHash: string = '',
): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];
  const portalRules = (styles.portalRules ?? []) as StyleRule[];
  // Phase 34 — engine-DOM escape hatch. Bare `root-block` children append into
  // `globalCss` (verbatim, unscoped) so they ride the SAME `__rozieInjectStyle`
  // document.head injection — reaching engine-rendered DOM page-wide. D-04/D-06.
  const engineRules = (styles.engineRules ?? []) as StyleRule[];
  const engineChildren = engineRules.flatMap((r) => r.children ?? []);

  const rawScopedCss = stringifyRules(scopedRules, source);
  const scopedCss = scopeHash.length > 0 && rawScopedCss.length > 0
    ? scopeCss(rawScopedCss, scopeHash)
    : rawScopedCss;
  const rootCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : '';
  const engineCss = stringifyRules(engineChildren, source);
  const globalParts = [rootCss, engineCss].filter((s) => s.length > 0);
  const globalCss = globalParts.join('\n');

  // Spike 004 — @portal rules slot in alongside scoped rules. Solid's CSS
  // pipeline is unscoped-by-default (no class hashing), so the
  // [data-rozie-portal-<NAME>="<hash>"] selectors slot in verbatim — the
  // portal attribute is their sole scoping.
  const portalCss = rewriteAllPortalBlocks(portalRules, source, scopeHash, PORTAL_SCOPE_REPEAT);

  // Combine scoped + portal + :root sections. Order: scoped first, portal
  // next, :root last (matches the pre-Item-1-residual two-`<style>`-element
  // emit order — scoped/portal in element 1, :root in element 2). Putting
  // them in a single injection keeps the head-injection cache key
  // 1-per-component, which is enough for HMR granularity.
  const sections: string[] = [];
  if (scopedCss.length > 0) sections.push(scopedCss);
  if (portalCss.length > 0) sections.push(portalCss);
  if (globalCss.length > 0) sections.push(globalCss);

  if (sections.length === 0) {
    return { injectStatement: '', needsInjectHelper: false, diagnostics };
  }

  const combined = sections.join('\n');
  // Cache key: '<componentName>-<scopeHash>'. The hash is content-derived
  // via FNV-1a over the component name + filename basename, so different
  // components compute different hashes naturally — but rename-without-
  // content-change would collide. Including the human-readable name
  // disambiguates and aids debugging in DevTools' Elements panel
  // (`<style data-rozie-style="ThemedButton-7914ecaa">`).
  const cacheKey = scopeHash.length > 0 ? `${componentName}-${scopeHash}` : componentName;
  const escapedCss = escapeCssForTemplateLiteral(combined);
  const escapedKey = cacheKey.replace(/'/g, "\\'");
  const injectStatement = `__rozieInjectStyle('${escapedKey}', \`${escapedCss}\`);`;

  return {
    injectStatement,
    needsInjectHelper: true,
    diagnostics,
  };
}
