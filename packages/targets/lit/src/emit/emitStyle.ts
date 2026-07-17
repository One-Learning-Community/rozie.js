/**
 * emitStyle — Lit target (Plan 06.4-02 Task 2).
 *
 * Splits the IR StyleSection into two outputs (D-LIT-15 / D-LIT-16):
 *
 *   - `staticStylesField`: `static styles = css\`...\`;` — scoped rules go here.
 *     Lit's shadow-DOM encapsulation keeps them component-local.
 *   - `globalStyleCall`: `injectGlobalStyles('rozie-<tag>-global', \`...\`);`
 *     — `:root { }` rules from the escape hatch go here. The runtime helper
 *     idempotently injects a `<style>` tag into `document.head`.
 *
 * Mirrors solid/emit/emitStyle.ts's serialization approach (byte-slice rules
 * from the original .rozie source, then escape for template-literal embed)
 * but routes the output into two different sinks.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { toKebabCase } from './emitDecorator.js';
import { scopeCss } from './scopeCss.js';
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * Lit: 1. A competing consumer scoped-CSS rule is run through `scopeCss`
 * (Phase 07.6 consumer-scoping confinement), which appends
 * `[data-rozie-s-<hash>]` to every selector — one extra `(0,1,0)` specificity
 * unit. Repeating the `@portal` scope attribute once matches that delta so
 * the `@portal`-vs-consumer cascade resolves identically to every other
 * target.
 *
 * (The plan's first-guess `0` assumed shadow-DOM with no consumer rewrite;
 * the VR matrix oracle in Task 2 corrected it once `scopeCss`'s consumer-rule
 * `[data-rozie-s-*]` append was accounted for.)
 */
const PORTAL_SCOPE_REPEAT = 1;

/**
 * Emitter-owned host-display parity default (quick 260710-fjj).
 *
 * Lit emits a persistent custom-element host the four hostless targets
 * (React/Vue/Svelte/Solid) don't. With no `:host { display }` rule that host
 * defaults to `display: inline`, so a baseline-aligned root picks up a
 * descender/half-leading gap (@rozie-ui/switch: 24px button → 25.5px host) and
 * a block root shrinks-to-content instead of filling width. `display: contents`
 * makes the host layout-transparent → byte-exact parity with the hostless
 * targets (every Rozie host is purely structural; role/semantics live on the
 * inner root). Prepended BEFORE author rules so an explicit `:host{display:X}`
 * wins via the CSS cascade (same specificity, later source order).
 */
const HOST_DISPLAY_DEFAULT = ':host{display:contents}';

export interface EmitStyleOpts {
  componentName: string;
  lit: LitImportCollector;
  runtime: RuntimeLitImportCollector;
  /**
   * Phase 07.6 — per-component scope hash (see `scopeHash.ts`). When set,
   * every rule in the scoped CSS is rewritten to require
   * `[data-rozie-s-<hash>]` on its last simple selector, mirroring Vue's
   * scoped-CSS / React+Solid CSS-Modules attribute-selector confinement.
   * Producer-template HTML elements are stamped with the matching
   * attribute in `emitTemplate`; consumer-projected property-fill content
   * does NOT carry the attribute and therefore does not match.
   *
   * `:host` / `::slotted()` selectors are exempted automatically.
   */
  scopeHash?: string;
  /**
   * command-palette-portal-overlay phase — true when the template has at
   * least one `r-portal` element. Lit is the shadow-DOM hazard target:
   * `static styles`' `[data-rozie-s-<hash>]`-scoped CSS is attached via
   * `shadowRoot.adoptedStyleSheets`, PHYSICALLY confined to the shadow
   * tree — attribute-selector matching alone does not cross the shadow
   * boundary. When true, `scopedCss` is ALSO folded into the
   * `injectGlobalStyles` sink (the SAME runtime helper `:root {}` rules
   * already use) so the component's own scoped rules exist GLOBALLY too;
   * the relocated element already carries `[data-rozie-s-<hash>]`
   * (stamped on every `tagKind: 'html'` element unconditionally), so the
   * globally-injected rules match ONLY this component's own elements.
   * False (default) is byte-identical to pre-phase output — a non-portal
   * component's CSS routing is completely untouched.
   */
  hasElementPortal?: boolean;
}

export interface EmitStyleResult {
  /** `  static styles = css\`...\`;` line — empty when no scoped rules. */
  staticStylesField: string;
  /** `injectGlobalStyles('rozie-<tag>-global', \`...\`);` — empty when no :root rules. */
  globalStyleCall: string;
  diagnostics: Diagnostic[];
}

/**
 * Slice each rule from the original .rozie source and join with newlines.
 * Verbatim port from solid/emit/emitStyle.ts.
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
 * Escape CSS text for inclusion in a JS template literal.
 * Verbatim port from solid/emit/emitStyle.ts.
 */
function escapeCssForTemplateLiteral(css: string): string {
  return css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/**
 * FNV-1a 32-bit hash, hex-encoded. Local copy — INTENTIONALLY not shared
 * with `scopeHash.ts`'s `fnv1a32Hex` (quick 260716-npt Finding 1): that one
 * hashes `basename::componentName` (name-derived), so two versions of the
 * same source file collide identically on it. This hash is over the
 * injected CSS TEXT ITSELF, so distinct global CSS payloads produce
 * distinct `injectGlobalStyles` runtime dedup ids even when the
 * componentName is unchanged.
 */
function fnv1a32HexOfCss(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function emitStyle(
  styles: StyleSection,
  source: string,
  opts: EmitStyleOpts,
): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];

  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];
  const portalRules = (styles.portalRules ?? []) as StyleRule[];
  // Phase 34 — engine-DOM escape hatch, DUAL SINK (D-04). Each `root-block`
  // engineRule carries `children` flattened bare. Lit is the only shadow target,
  // so engine DOM lives in TWO disjoint places: in-shadow content (TipTap
  // placeholder, in-template menu host) reached by `static styles`, AND
  // body-injected content (flatpickr calendar) reached by `injectGlobalStyles`.
  // The bare rules go into BOTH sinks. One duplicated rule is expected and
  // harmless (disjoint DOM scopes). The bare rules carry NO `[data-rozie-s-*]`
  // attr — engine DOM lacks it, so they must stay bare even inside the shadow
  // sheet. CRITICAL D-03: the FLAT `:root { --custom-prop }` (rootRules) path
  // stays single-sink → injectGlobalStyles ONLY (byte-identity preserved).
  const engineRules = (styles.engineRules ?? []) as StyleRule[];
  const engineChildren = engineRules.flatMap((r) => r.children ?? []);
  const engineCss = stringifyRules(engineChildren, source);

  const rawScopedCss = stringifyRules(scopedRules, source);
  const scopedCss = opts.scopeHash
    ? scopeCss(rawScopedCss, opts.scopeHash)
    : rawScopedCss;
  const rootCss = rootRules.length > 0 ? stringifyRules(rootRules, source) : '';
  // injectGlobalStyles sink gets flat :root (D-03) PLUS engine rules (D-04)
  // PLUS — command-palette-portal-overlay phase — the component's OWN
  // scoped CSS when `r-portal` is in use (see opts.hasElementPortal doc
  // comment). `scopedCss` is already `[data-rozie-s-<hash>]`-qualified, so
  // its global copy matches ONLY this component's own (portalled)
  // elements, never a sibling consumer's shadow-internal ones.
  const globalParts = [
    rootCss,
    engineCss,
    opts.hasElementPortal === true ? scopedCss : '',
  ].filter((s) => s.length > 0);
  const globalCss = globalParts.join('\n');

  // Spike 004 — @portal rules emit INTO the same `static styles` css block.
  // Lit's shadow-DOM CSS encapsulation already isolates these selectors to
  // this component's shadow tree, which IS where the engine appends children
  // (via the shadow-DOM-rooted `_ref__rozieRoot` query). The
  // [data-rozie-portal-<NAME>="<hash>"] attribute reaches the engine subtree.
  const portalCss = rewriteAllPortalBlocks(portalRules, source, opts.scopeHash ?? '', PORTAL_SCOPE_REPEAT);
  // The `static styles` sink folds scoped + portal + bare engine rules. The
  // engine rules go in UNSCOPED/bare (NO scopeCss rewrite) — engine DOM inside
  // the shadow tree (e.g. TipTap placeholder) carries no `[data-rozie-s-*]`
  // attr, so the rule must be bare to match (D-04 in-shadow arm).
  // HOST_DISPLAY_DEFAULT is prepended so an author `:host{display:X}` (carried in
  // scopedCss, later in the sheet) overrides it via the cascade. It is NOT run
  // through scopeCss (host selectors are exempt anyway) and is always present, so
  // even a style-LESS component emits the host rule (its host would otherwise
  // default to display:inline).
  const combinedScoped = [HOST_DISPLAY_DEFAULT, scopedCss, portalCss, engineCss]
    .filter((s) => s.length > 0)
    .join('\n');

  let globalStyleCall = '';

  // combinedScoped always carries the host default → the css field is always emitted.
  opts.lit.add('css');
  const escaped = escapeCssForTemplateLiteral(combinedScoped);
  const staticStylesField = `  static styles = css\`\n${escaped}\n\`;`;

  if (globalCss.length > 0) {
    opts.runtime.add('injectGlobalStyles');
    const escaped = escapeCssForTemplateLiteral(globalCss);
    // Quick 260716-npt Finding 1: suffix with a hash of the injected CSS
    // TEXT (not just the component name) so two versions of the same
    // component with different global CSS payloads get distinct runtime
    // dedup ids — see fnv1a32HexOfCss doc comment above.
    const cssHash = fnv1a32HexOfCss(globalCss);
    const id = `rozie-${toKebabCase(opts.componentName)}-${cssHash}-global`;
    globalStyleCall = `injectGlobalStyles('${id}', \`\n${escaped}\n\`);`;
  }

  return { staticStylesField, globalStyleCall, diagnostics };
}
