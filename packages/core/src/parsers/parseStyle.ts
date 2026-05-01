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
 *
 * Threat model T-1-03-05: postcss.parse is invoked with NO plugins (postcss
 * does not load plugins from CSS source anyway, but verified by code review).
 *
 * @experimental — shape may change before v1.0
 */
import postcss from 'postcss';
import type { Root, Rule } from 'postcss';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { StyleAST, StyleRule } from '../ast/blocks/StyleAST.js';

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
      code: 'ROZ080',
      severity: 'error',
      message: `PostCSS parse error: ${e.message ?? 'parse failed'}`,
      loc: contentLoc,
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  const rules: StyleRule[] = [];
  root.walkRules((rule: Rule) => {
    // Block-relative offsets from postcss source. Per node.d.ts, Position.offset
    // is non-optional; we still defensively fall back to a line/column compute.
    const startOffsetRel =
      rule.source?.start?.offset ??
      lineColToOffset(content, rule.source?.start?.line ?? 1, rule.source?.start?.column ?? 1);
    const endOffsetRel =
      rule.source?.end?.offset ??
      lineColToOffset(content, rule.source?.end?.line ?? 1, rule.source?.end?.column ?? 1);
    const ruleLoc: SourceLoc = {
      start: contentLoc.start + startOffsetRel,
      end: contentLoc.start + endOffsetRel,
    };

    // Selector classification (Pitfall 6 — mixed-:root rejection).
    const parts = rule.selector.split(',').map(s => s.trim());
    const hasRoot = parts.includes(':root');
    const isPureRoot = parts.length === 1 && parts[0] === ':root';
    if (hasRoot && !isPureRoot) {
      diagnostics.push({
        code: 'ROZ081',
        severity: 'error',
        message: `Mixed :root selector "${rule.selector}" is not allowed. Split :root rules into their own block.`,
        loc: ruleLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Move :root rules into a separate selector block; combining :root with other selectors mixes scoped and unscoped emission.',
      });
    }

    rules.push({
      selector: rule.selector,
      loc: ruleLoc,
      isRootEscape: isPureRoot,
    });
  });

  return {
    node: { type: 'StyleAST', loc: contentLoc, cssText: content, rules },
    diagnostics,
  };
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
