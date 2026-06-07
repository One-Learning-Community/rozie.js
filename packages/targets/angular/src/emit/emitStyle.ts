/**
 * emitStyle — Phase 5 Plan 05-04a Task 3.
 *
 * Re-stringifies the IR's StyleSection (split into scopedRules vs rootRules
 * by Phase 1's parseStyle / Phase 2's lowerStyles) into a single concatenated
 * string suitable for inclusion inside `styles: [\`...\`]` of the @Component
 * decorator.
 *
 * Per RESEARCH Pattern 10 v1 (OQ A4 RESOLVED):
 *
 *   - Scoped rules → emitted verbatim. Angular's default
 *     `ViewEncapsulation.Emulated` adds `_nghost-cN` / `_ngcontent-cN`
 *     attribute selectors automatically; no source-side transformation needed.
 *
 *   - Root rules (`:root { ... }`) → wrap in `::ng-deep :root { ... }`. The
 *     `::ng-deep` selector pierces the emulated-encapsulation attribute
 *     scoping so CSS custom properties declared on `:root` propagate to
 *     `document.documentElement` and are inherited by all consumers.
 *
 * Plan 05-05 Modal CSS-vars Playwright spec validates whether this v1 wrap
 * is actually necessary (Angular emulated-encap MAY auto-apply :root rules
 * globally even without ::ng-deep — A4 disposition deferred).
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { rewriteAllPortalBlocks } from '../../../../core/src/codegen/portalCss.js';

/**
 * Quick task 260520-bu7 — additional repeats of the portal scope attribute
 * selector for cross-target CSS-specificity compensation.
 *
 * Angular: 0. A competing consumer scoped-CSS rule gets `[_ngcontent-<hash>]`
 * appended by emulated view encapsulation (+1 unit) — BUT the `@portal` rule
 * here is wrapped `:host ::ng-deep`, and `:host` ALREADY contributes one
 * `(0,1,0)` unit. That `:host` unit compensates the consumer's `[_ngcontent-*]`
 * bump, so no extra attribute repeat is needed.
 *
 * FIRST GUESS — the VR matrix D-10 byte-identity is the oracle (Task 2). If
 * `:host ::ng-deep` does NOT fully compensate, this bumps to a non-zero count.
 */
const PORTAL_SCOPE_REPEAT = 0;

export interface EmitStyleResult {
  /**
   * Concatenated CSS body (scoped rules + ::ng-deep :root block when present).
   * Empty string when StyleSection has no scoped/root rules.
   */
  stylesArrayBody: string;
  /**
   * Spike 004 — body of a SEPARATE `styles` array entry for `@portal NAME
   * { ... }` rules, each inner selector wrapped in `:host ::ng-deep` so
   * Angular view-encapsulation's `_ngcontent-*` attribute scoping doesn't
   * prevent matching engine-created DOM. Empty string when no @portal blocks.
   */
  portalStylesEntry: string;
  diagnostics: Diagnostic[];
}

/**
 * Emit the styles body for `styles: [\`<body>\`]`. Returns
 * `{ stylesArrayBody: '', portalStylesEntry: '', diagnostics: [] }` when the
 * StyleSection is empty.
 *
 * @param styles     — Phase 2 IR StyleSection (already split by lowerStyles).
 * @param source     — original .rozie source text.
 * @param scopeHash  — Spike 004 per-component scope hash for `@portal`
 *                     attribute selectors. Empty string (default) when there
 *                     are no @portal blocks.
 */
export function emitStyle(
  styles: StyleSection,
  source: string,
  scopeHash: string = '',
): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];
  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];
  const portalRules = (styles.portalRules ?? []) as StyleRule[];
  // Phase 34 — engine-DOM escape hatch. Bare `root-block` children wrap with a
  // BARE `::ng-deep` (NOT `:host ::ng-deep`) so the rule pierces emulated view
  // encapsulation AND reaches body-injected engine DOM outside the host (e.g.
  // flatpickr's calendar appended to <body>). D-04/D-06: emitted verbatim.
  const engineRules = (styles.engineRules ?? []) as StyleRule[];
  const engineChildren = engineRules.flatMap((r) => r.children ?? []);

  // Spike 004 — @portal rules go in a SEPARATE styles entry, each selector
  // wrapped `:host ::ng-deep` to pierce Angular's view encapsulation.
  const portalCss = rewriteAllPortalBlocks(portalRules, source, scopeHash, PORTAL_SCOPE_REPEAT);
  const portalStylesEntry = portalCss.length > 0 ? wrapPortalSelectors(portalCss) : '';

  if (
    scopedRules.length === 0 &&
    rootRules.length === 0 &&
    portalStylesEntry.length === 0 &&
    engineChildren.length === 0
  ) {
    return { stylesArrayBody: '', portalStylesEntry: '', diagnostics };
  }

  const parts: string[] = [];
  if (scopedRules.length > 0) {
    parts.push(stringifyRules(scopedRules, source));
  }
  if (rootRules.length > 0) {
    const rootBodies = rootRules.map((r) => sliceRuleBody(r, source));
    parts.push(`::ng-deep :root {\n${rootBodies.join('\n')}\n}`);
  }
  if (engineChildren.length > 0) {
    const engineCss = stringifyRules(engineChildren, source);
    parts.push(wrapBareNgDeep(engineCss));
  }

  return {
    stylesArrayBody: parts.join('\n\n'),
    portalStylesEntry,
    diagnostics,
  };
}

/**
 * Prefix every SELECTOR line of a portal CSS string with `:host ::ng-deep `.
 * A selector line is one that ends with `{` (the rule's opening). Declaration
 * lines and the closing `}` are left alone. Multi-line selector lists
 * (`a,\n  b {`) have each part prefixed.
 */
function wrapPortalSelectors(css: string): string {
  const lines = css.split('\n');
  const out: string[] = [];
  // A run of selector lines accumulates until the line ending with `{`.
  let selectorBuf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isOpening = trimmed.endsWith('{');
    const isSelectorPart = !isOpening && trimmed.endsWith(',');
    if (isSelectorPart) {
      selectorBuf.push(`:host ::ng-deep ${trimmed}`);
      continue;
    }
    if (isOpening) {
      selectorBuf.push(`:host ::ng-deep ${trimmed}`);
      out.push(...selectorBuf);
      selectorBuf = [];
      continue;
    }
    // declaration line or closing brace — emit verbatim.
    out.push(line);
  }
  out.push(...selectorBuf);
  return out.join('\n');
}

/**
 * Phase 34 — prefix every SELECTOR line of an engine-rule CSS string with a
 * BARE `::ng-deep ` (NOT `:host ::ng-deep`). Engine-rendered DOM can be
 * body-injected OUTSIDE the host element (flatpickr calendar, body-appended
 * menus), so the `:host` anchor of `wrapPortalSelectors` would wrongly confine
 * it. Bare `::ng-deep` pierces emulated view encapsulation page-wide (D-06 —
 * page-wide leak is intended). Selector-line detection mirrors
 * `wrapPortalSelectors`: a line ending in `{` opens a rule, a line ending in
 * `,` is a selector-list continuation; declaration lines and `}` are verbatim.
 */
function wrapBareNgDeep(css: string): string {
  const lines = css.split('\n');
  const out: string[] = [];
  let selectorBuf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isOpening = trimmed.endsWith('{');
    const isSelectorPart = !isOpening && trimmed.endsWith(',');
    if (isSelectorPart) {
      selectorBuf.push(`::ng-deep ${trimmed}`);
      continue;
    }
    if (isOpening) {
      selectorBuf.push(`::ng-deep ${trimmed}`);
      out.push(...selectorBuf);
      selectorBuf = [];
      continue;
    }
    out.push(line);
  }
  out.push(...selectorBuf);
  return out.join('\n');
}

function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  return rules
    .map((r) => source.slice(r.loc.start, r.loc.end))
    // Phase 17 (SPEC-R1 non-Lit arm / SPEC-R4a): `::part(name)` is a
    // cross-shadow-DOM mechanism that only has meaning on Lit. Drop any rule
    // whose slice contains `::part(` BEFORE the `:deep(` lowering branch — so a
    // ::part rule is never passed to `lowerDeepToNgDeep` and is filtered out of
    // the array entirely (not mapped to '', which would leak a stray empty
    // line). Silent no-op — no diagnostic. Independent of the `:deep` path
    // (SPEC-R5). Match only the selector portion (before the first `{`) so a
    // `::part(` in a declaration value or comment cannot false-drop a rule.
    .filter((slice) => !slice.split('{', 1)[0]!.includes('::part('))
    .map((slice) => {
      // Quick task 260526-mk4 — Angular `:deep(X)` → `::ng-deep X` lowering.
      // Byte-slice preservation is the floor (Risk 5); we only invoke the
      // postcss reparse when the slice actually contains `:deep(`, paying the
      // reformat cost only for rules that need it.
      return slice.includes(':deep(') ? lowerDeepToNgDeep(slice) : slice;
    })
    .join('\n');
}

/**
 * Lower every `:deep(X)` pseudo to `::ng-deep X` — Angular's deprecated-but-
 * supported view-encapsulation pierce. Quick task 260526-mk4.
 *
 * Trade-off: postcss reparses the rule source, so the output will be
 * canonicalized formatting rather than byte-identical to the original. We
 * only pay this cost when `:deep(` appears in the slice, leaving every
 * other rule untouched.
 *
 * Per-selector behavior:
 *   `.outer :deep(.inner)`   → `.outer ::ng-deep .inner`
 *   `:deep(.x)`              → `::ng-deep .x`
 *   `:deep(.a, .b)`          → distributes via parent-selector cloning;
 *                              each branch is rewritten independently.
 */
function lowerDeepToNgDeep(css: string): string {
  const root = postcss.parse(css);
  const transformer = selectorParser((selectors) => {
    expandDeepDistribution(selectors);
    selectors.each((sel) => {
      rewriteDeepInSelector(sel);
    });
  });
  root.walkRules((rule) => {
    rule.selector = transformer.processSync(rule.selector);
  });
  return root.toString();
}

/**
 * Same distribution pass as the other targets' scopeCss — expand
 * `:deep(a, b)` into two parent selectors so each carries a single inner.
 */
function expandDeepDistribution(root: selectorParser.Root): void {
  let changed = true;
  while (changed) {
    changed = false;
    const selectors = root.nodes.slice();
    for (const sel of selectors) {
      if (sel.type !== 'selector') continue;
      const distIdx = sel.nodes.findIndex(
        (n) =>
          n.type === 'pseudo' &&
          (n as selectorParser.Pseudo).value === ':deep' &&
          (n as selectorParser.Pseudo).nodes.length > 1,
      );
      if (distIdx === -1) continue;
      const pseudo = sel.nodes[distIdx] as selectorParser.Pseudo;
      const inners = pseudo.nodes.filter(
        (n) => n.type === 'selector',
      ) as selectorParser.Selector[];
      const expanded: selectorParser.Selector[] = inners.map((inner) => {
        const cloned = sel.clone({}) as selectorParser.Selector;
        const clonedPseudo = cloned.nodes[distIdx] as selectorParser.Pseudo;
        clonedPseudo.nodes = [inner.clone({}) as selectorParser.Selector];
        return cloned;
      });
      const selIdx = root.nodes.indexOf(sel);
      root.nodes.splice(selIdx, 1, ...expanded);
      changed = true;
      break;
    }
  }
}

/**
 * Walk a single selector and replace each `:deep(X)` with a `::ng-deep`
 * pseudo-element followed by a descendant combinator and the inner
 * contents. Insertion preserves the surrounding combinator structure:
 *   `.outer :deep(.a > .b)` → `.outer ::ng-deep .a > .b`
 *   `:deep(.x)` at the start → `::ng-deep .x`
 */
function rewriteDeepInSelector(selector: selectorParser.Selector): void {
  for (let i = selector.nodes.length - 1; i >= 0; i--) {
    const node = selector.nodes[i];
    if (
      !node ||
      node.type !== 'pseudo' ||
      (node as selectorParser.Pseudo).value !== ':deep'
    ) {
      continue;
    }
    const pseudo = node as selectorParser.Pseudo;
    const inner = pseudo.nodes[0];
    if (!inner || inner.type !== 'selector') continue;
    const innerNodes = (inner as selectorParser.Selector).nodes;

    // Build the replacement nodes: `::ng-deep` followed by the inner
    // selector contents. The descendant combinator between `::ng-deep`
    // and the inner already exists implicitly when the inner starts with
    // a non-combinator node — but we always insert a descendant space
    // combinator so the output is unambiguous.
    const ngDeep = selectorParser.pseudo({ value: '::ng-deep' });
    const sep = selectorParser.combinator({ value: ' ' });

    // If the slot before the pseudo is a non-combinator node (e.g. `.outer`
    // followed by descendant space and then `:deep(...)`), postcss-selector-
    // parser already represents the descendant space as a combinator node
    // at index i-1, so the splice replaces just the pseudo.
    selector.nodes.splice(i, 1, ngDeep, sep, ...innerNodes);
  }
}

function sliceRuleBody(rule: StyleRule, source: string): string {
  const full = source.slice(rule.loc.start, rule.loc.end);
  const openIdx = full.indexOf('{');
  const closeIdx = full.lastIndexOf('}');
  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) {
    return full;
  }
  return full.slice(openIdx + 1, closeIdx).trim();
}
