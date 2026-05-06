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
import type { StyleSection } from '../../../../core/src/ir/types.js';
import type { StyleRule } from '../../../../core/src/ast/blocks/StyleAST.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitStyleResult {
  /**
   * Concatenated CSS body (scoped rules + ::ng-deep :root block when present).
   * Empty string when StyleSection is empty.
   */
  stylesArrayBody: string;
  diagnostics: Diagnostic[];
}

/**
 * Emit the styles body for `styles: [\`<body>\`]`. Returns
 * `{ stylesArrayBody: '', diagnostics: [] }` when StyleSection is empty.
 */
export function emitStyle(styles: StyleSection, source: string): EmitStyleResult {
  const diagnostics: Diagnostic[] = [];
  const scopedRules = styles.scopedRules as StyleRule[];
  const rootRules = styles.rootRules as StyleRule[];

  if (scopedRules.length === 0 && rootRules.length === 0) {
    return { stylesArrayBody: '', diagnostics };
  }

  const parts: string[] = [];
  if (scopedRules.length > 0) {
    parts.push(stringifyRules(scopedRules, source));
  }
  if (rootRules.length > 0) {
    const rootBodies = rootRules.map((r) => sliceRuleBody(r, source));
    parts.push(`::ng-deep :root {\n${rootBodies.join('\n')}\n}`);
  }

  return { stylesArrayBody: parts.join('\n\n'), diagnostics };
}

function stringifyRules(rules: StyleRule[], source: string): string {
  if (rules.length === 0) return '';
  return rules.map((r) => source.slice(r.loc.start, r.loc.end)).join('\n');
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
