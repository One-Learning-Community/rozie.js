/**
 * `<style>` block parser (PARSE-06).
 *
 * Wraps `postcss.parse` to walk top-level rules and flag `:root { }` rules
 * for unscoped emission (the always-scoped escape hatch per PROJECT.md key
 * decisions). Mixed `:root, .other { }` selectors are REJECTED with ROZ081
 * (RESEARCH.md Pitfall 6) so Phase 2's emitter can rely on a clean per-rule
 * "scope OR don't scope" decision.
 *
 * D-08 contract: collected-not-thrown. PostCSS's parse error is wrapped in
 * try/catch and converted to ROZ080.
 *
 * ROZxxx codes owned here:
 *  - ROZ080  PostCSS parse error
 *  - ROZ081  Mixed :root selector (e.g., `:root, .other` — must be split)
 *  - ROZ082  `@portal` nested inside `@media` (or any non-`@portal` at-rule)
 *  - ROZ084  `@portal` block with empty/malformed prelude or content (Spike 004)
 *
 * Spike 004 — `@portal NAME { ... }` at-rule recognition. An `@portal item
 * { ul {} li {} }` block parses to a `portal-block` StyleRule whose `children`
 * carry the inner selectors. Producer-side CSS scoping (per-target emitStyle)
 * rewrites those children to `[data-rozie-portal-<NAME>="<hash>"] <selector>`.
 *
 * Threat model T-1-03-05: postcss.parse is invoked with NO plugins (postcss
 * does not load plugins from CSS source anyway, but verified by code review).
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import type { AtRule, ChildNode, Node, Root, Rule } from 'postcss';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { StyleAST, StyleRule } from '../ast/blocks/StyleAST.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseStyleResult {
  node: StyleAST | null;
  diagnostics: Diagnostic[];
}

export function parseStyle(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseStyleResult {
  // `source` is required by every parser's signature for diagnostic
  // line/column rendering, but parseStyle does not currently consume it
  // (postcss carries its own offset metadata). Keep it in the signature so
  // the contract matches the rest of the parsers.
  void source;

  const diagnostics: Diagnostic[] = [];
  let root: Root;
  try {
    root = postcss.parse(content, filename !== undefined ? { from: filename } : {});
  } catch (err: unknown) {
    const e = err as { message?: string };
    diagnostics.push({
      code: RozieErrorCode.STYLE_PARSE_ERROR,
      severity: 'error',
      message: `PostCSS parse error: ${e.message ?? 'parse failed'}`,
      loc: contentLoc,
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  const rules: StyleRule[] = [];

  /** Absolute byte span of any postcss node, with offset fallbacks. */
  const nodeLoc = (node: ChildNode | Rule | AtRule): SourceLoc => {
    const startOffsetRel =
      node.source?.start?.offset ??
      lineColToOffset(content, node.source?.start?.line ?? 1, node.source?.start?.column ?? 1);
    const endOffsetRel =
      node.source?.end?.offset ??
      lineColToOffset(content, node.source?.end?.line ?? 1, node.source?.end?.column ?? 1);
    return {
      start: contentLoc.start + startOffsetRel,
      end: contentLoc.start + endOffsetRel,
    };
  };

  /** Build a plain (non-portal) StyleRule, emitting ROZ081 on mixed :root. */
  const buildPlainRule = (rule: Rule): StyleRule => {
    const ruleLoc = nodeLoc(rule);
    // Selector classification (Pitfall 6 — mixed-:root rejection).
    const parts = rule.selector.split(',').map(s => s.trim());
    const hasRoot = parts.includes(':root');
    const isPureRoot = parts.length === 1 && parts[0] === ':root';
    if (hasRoot && !isPureRoot) {
      diagnostics.push({
        code: RozieErrorCode.STYLE_MIXED_ROOT_SELECTOR,
        severity: 'error',
        message: `Mixed :root selector "${rule.selector}" is not allowed. Split :root rules into their own block.`,
        loc: ruleLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Move :root rules into a separate selector block; combining :root with other selectors mixes scoped and unscoped emission.',
      });
    }
    return { kind: 'rule', selector: rule.selector, loc: ruleLoc, isRootEscape: isPureRoot };
  };

  // Spike 004 — first collect `@portal NAME { ... }` blocks. PostCSS's
  // top-level `root.walkRules` descends INTO at-rule bodies too, so we must
  // skip portal-block inner rules in the top-level pass below to avoid
  // double-collecting them as plain scopedRules.
  root.walkAtRules((atRule: AtRule) => {
    if (atRule.name !== 'portal') return;

    const blockLoc = nodeLoc(atRule);

    // ROZ082 — `@portal` must NOT be nested inside another at-rule (e.g.
    // `@media (...) { @portal x {} }`). The valid direction
    // (`@portal x { @media (...) {} }`) has `@media` as a DESCENDANT, which
    // this ancestor walk does not flag.
    let ancestor: Node | undefined = atRule.parent;
    let invalidNesting = false;
    while (ancestor && ancestor.type !== 'root') {
      if (ancestor.type === 'atrule') {
        invalidNesting = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    if (invalidNesting) {
      diagnostics.push({
        code: RozieErrorCode.STYLE_PORTAL_INVALID_NESTING,
        severity: 'error',
        message:
          '@portal cannot be nested inside @media or another at-rule. ' +
          'Put the at-rule INSIDE the @portal block (@portal X { @media ... }).',
        loc: blockLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Invert the nesting: `@portal X { @media (...) { ul {} } }`.',
      });
      return;
    }

    // ROZ084 — empty / malformed prelude.
    const portalName = atRule.params.trim();
    if (portalName.length === 0) {
      diagnostics.push({
        code: RozieErrorCode.STYLE_PORTAL_SELECTOR_PARSE_ERROR,
        severity: 'error',
        message: '@portal requires a name (e.g. `@portal item { ... }`).',
        loc: blockLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Name the portal block after the portal slot it styles: `@portal <slotName> { ... }`.',
      });
      return;
    }

    // Collect inner selectors (recursive — descends into nested @media etc.).
    const children: StyleRule[] = [];
    try {
      atRule.walkRules((inner: Rule) => {
        children.push({
          kind: 'rule',
          selector: inner.selector,
          loc: nodeLoc(inner),
          isRootEscape: false,
        });
      });
    } catch (innerErr: unknown) {
      const e = innerErr as { message?: string };
      diagnostics.push({
        code: RozieErrorCode.STYLE_PORTAL_SELECTOR_PARSE_ERROR,
        severity: 'error',
        message: `@portal ${portalName} block selector parse error: ${e.message ?? 'parse failed'}`,
        loc: blockLoc,
        ...(filename !== undefined ? { filename } : {}),
      });
      return;
    }

    rules.push({
      kind: 'portal-block',
      selector: `@portal ${portalName}`,
      loc: blockLoc,
      isRootEscape: false,
      portalName,
      children,
    });
  });

  // Top-level plain rules. Skip any rule that descends from a `@portal`
  // at-rule — those are collected (as `children`) by the walkAtRules pass
  // above. Without this gate they would be double-counted as scopedRules.
  root.walkRules((rule: Rule) => {
    if (hasPortalAncestor(rule)) return;
    rules.push(buildPlainRule(rule));
  });

  return {
    node: { type: 'StyleAST', loc: contentLoc, cssText: content, rules },
    diagnostics,
  };
}

/**
 * True when `rule` is nested (at any depth) inside a `@portal` at-rule.
 * Used to gate the top-level `walkRules` pass so portal-block inner rules
 * are collected exactly once (by the `walkAtRules` pass).
 */
function hasPortalAncestor(rule: Rule): boolean {
  let parent: Node | undefined = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && (parent as AtRule).name === 'portal') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Defensive fallback when postcss does not populate `source.start.offset`.
 * Per RESEARCH.md A1: postcss 8.5+ should always populate offsets, but we
 * keep this fallback to avoid silent breakage on obscure postcss versions.
 */
function lineColToOffset(text: string, line: number, column: number): number {
  let off = 0;
  for (let l = 1; l < line; l++) {
    const nl = text.indexOf('\n', off);
    if (nl < 0) return off;
    off = nl + 1;
  }
  return off + Math.max(0, column - 1);
}
