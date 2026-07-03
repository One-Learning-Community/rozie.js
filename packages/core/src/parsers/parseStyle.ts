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
 *  - ROZ085  `<style lang="scss">` used but the optional `sass` peer is absent (Phase 10)
 *  - ROZ086  dart-sass threw on invalid SCSS — collected, never propagated (Phase 10, D-08)
 *  - ROZ087  unrecognized `<style lang>` value (neither `scss` nor `css`) (Phase 10, D-02)
 *
 * Phase 10 — SCSS preprocessing. When `lang === 'scss'` (resolved
 * case-insensitively + trimmed, mirroring `parseScript`'s `normalizedLang`),
 * the style body is compiled to plain CSS by dart-sass BEFORE `postcss.parse`
 * runs — so the existing scoping / `@portal` / `:root` machinery (and the six
 * `emitStyle.ts` files) need no change. The SCSS branch is fully gated on
 * `lang === 'scss'`; the plain-CSS path is the untouched `else` and stays
 * byte-identical (SPEC-REQ-8).
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
import { loadSass } from './resolveSass.js';

export interface ParseStyleResult {
  node: StyleAST | null;
  diagnostics: Diagnostic[];
}

/**
 * Quick task 260703-12j — top-level conditional-group at-rules whose WHOLE
 * `@media (...) { ... }` span is captured as a single `at-rule-block`
 * scoped rule so the wrapper survives compilation (see `StyleAST.StyleRule`
 * doc for the full rationale). `@keyframes` is deliberately excluded — its
 * children are keyframe-selector percentages/`from`/`to`, not style rules,
 * and a target's `scopeCss` selector-rewriter would mangle them if routed
 * through the same path (T-12j-03, accepted). `@portal` is excluded — it has
 * its own dedicated collection pass (`walkAtRules('portal', ...)` below) and
 * its own nesting-validation diagnostic (ROZ082).
 */
const SCOPED_GROUP_AT_RULES = new Set(['media', 'supports', 'container']);

/**
 * Parse a `<style>` block into a `StyleAST`.
 *
 * @param lang - the resolved `lang=` attribute from the source `<style>` tag
 *   (Phase 9 generic `lang=` substrate). Phase 10 consumes it: resolved
 *   case-insensitively + trimmed (mirroring `parseScript`'s `normalizedLang`),
 *   `'scss'` triggers compile-time SCSS-to-CSS preprocessing via dart-sass;
 *   `'css'` or absent is the plain-CSS path (byte-identical to pre-Phase-10).
 *   Any other non-empty value emits ROZ087 and returns `node: null` (D-02).
 *   Threading it here (rather than mutating the node after construction in
 *   `parse.ts`) keeps `StyleAST.lang` set at construction time, consistent with
 *   every other block AST and with `exactOptionalPropertyTypes` (WR-04).
 */
export function parseStyle(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
  lang?: string,
): ParseStyleResult {
  // `source` is required by every parser's signature for diagnostic
  // line/column rendering, but parseStyle does not currently consume it
  // (postcss carries its own offset metadata). Keep it in the signature so
  // the contract matches the rest of the parsers.
  void source;

  const diagnostics: Diagnostic[] = [];

  // Phase 10 — resolve the `lang=` attribute. Mirrors `parseScript`'s
  // `normalizedLang` (D-01): trimmed + lowercased. Recognized values are
  // `scss` (preprocess) and `css`/absent (plain CSS — today's default path).
  const normalizedLang = lang?.trim().toLowerCase();
  const isScss = normalizedLang === 'scss';
  const isPlain =
    normalizedLang === undefined || normalizedLang === '' || normalizedLang === 'css';

  // D-02 — an unrecognized non-empty `lang` fires ROZ087 at error severity and
  // emits NO `<style>` output (fail loud — feeding e.g. Less to `postcss.parse`
  // otherwise surfaces as a confusing ROZ080). D-03 — the hint branches on the
  // value: `less` gets a Less-aware deferral message; anything else a generic
  // typo hint. Unlike `parseScript`'s ROZ032 (warn + continue), parseStyle must
  // return `node: null` here.
  if (!isScss && !isPlain) {
    const hint =
      normalizedLang === 'less'
        ? 'Less is planned for a follow-up phase — use <style lang="scss"> or plain CSS for now.'
        : 'Use <style lang="scss"> for SCSS, or omit lang for plain CSS.';
    diagnostics.push({
      code: RozieErrorCode.STYLE_UNRECOGNIZED_LANG,
      severity: 'error',
      message: `Unrecognized <style lang="${lang}"> value. Recognized: "scss" (SCSS) or "css" / no lang (plain CSS).`,
      loc: contentLoc,
      ...(filename !== undefined ? { filename } : {}),
      hint,
    });
    return { node: null, diagnostics };
  }

  // Phase 10 — SCSS pre-pass. Runs BEFORE `postcss.parse` so all downstream
  // machinery (scoping, @portal, :root, the six emitStyle.ts files) operates on
  // plain CSS. `cssForPostcss` is `content` for the plain-CSS path and the
  // dart-sass-compiled CSS for the SCSS path.
  let cssForPostcss = content;
  if (isScss) {
    const sass = loadSass();
    if (sass === null) {
      // ROZ085 — `lang="scss"` used but the optional `sass` peer is absent.
      // Error severity, no partial output (D-08-aligned fail-loud).
      diagnostics.push({
        code: RozieErrorCode.STYLE_MISSING_SASS,
        severity: 'error',
        message:
          '<style lang="scss"> requires the "sass" package, which is not installed.',
        loc: contentLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Install dart-sass as a dev dependency: `npm install -D sass` (or `pnpm add -D sass`).',
      });
      return { node: null, diagnostics };
    }
    try {
      // The option object is deterministic for the dist-parity byte gate.
      // `charset: false` is LOAD-BEARING — it suppresses the `@charset`/BOM
      // dart-sass would otherwise inject; `sourceMap: false` and the silent
      // logger keep output reproducible with no embedded comments.
      cssForPostcss = sass.compileString(content, {
        style: 'expanded',
        charset: false,
        sourceMap: false,
        logger: sass.Logger.silent,
      }).css;
    } catch (err: unknown) {
      // ROZ086 — dart-sass threw on invalid SCSS. Collected, never propagated
      // (D-08). dart-sass carries `span.start.offset` — a block-relative,
      // 0-based UTF-16 offset into the SCSS string — and `sassMessage` (clean
      // text). Map the offset block-relative -> absolute; fall back to
      // `contentLoc` when no span is present. Do NOT branch on `err.name`
      // (it is `'Error'`, not `'Exception'`).
      const e = err as {
        message?: string;
        sassMessage?: string;
        span?: { start?: { offset?: number } };
      };
      const off = e.span?.start?.offset;
      const loc =
        off !== undefined
          ? { start: contentLoc.start + off, end: contentLoc.start + off }
          : contentLoc;
      diagnostics.push({
        code: RozieErrorCode.STYLE_SCSS_COMPILE_ERROR,
        severity: 'error',
        message: `SCSS compile error: ${e.sassMessage ?? e.message ?? 'compile failed'}`,
        loc,
        ...(filename !== undefined ? { filename } : {}),
      });
      return { node: null, diagnostics };
    }
  }

  let root: Root;
  try {
    root = postcss.parse(cssForPostcss, filename !== undefined ? { from: filename } : {});
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

  /**
   * Absolute byte span of any postcss node, with offset fallbacks.
   *
   * The `lineColToOffset` fallback indexes into `cssForPostcss` — the string
   * postcss actually parsed (the compiled CSS for the SCSS path, `content` for
   * plain CSS). D-07: for SCSS these offsets correspond to compiled-CSS bytes,
   * NOT the SCSS source — callers that surface user-facing locs for SCSS
   * blocks clamp to `contentLoc` instead (see `buildPlainRule`'s ROZ081 push).
   */
  const nodeLoc = (node: ChildNode | Rule | AtRule): SourceLoc => {
    const startOffsetRel =
      node.source?.start?.offset ??
      lineColToOffset(
        cssForPostcss,
        node.source?.start?.line ?? 1,
        node.source?.start?.column ?? 1,
      );
    const endOffsetRel =
      node.source?.end?.offset ??
      lineColToOffset(cssForPostcss, node.source?.end?.line ?? 1, node.source?.end?.column ?? 1);
    return {
      start: contentLoc.start + startOffsetRel,
      end: contentLoc.start + endOffsetRel,
    };
  };

  // Phase 34 (D-08) — ROZ128: `:global(...)` in a selector. postcss already
  // hands us the selector portion ONLY (declaration values + comments live in
  // the rule body, not `rule.selector`), so this substring scan cannot
  // false-trip on a `:global(` inside a declaration value or comment. Works
  // only on Vue/Svelte; silently dropped on React/Solid/Lit — a hard error.
  // Collected, never thrown (D-08 contract). The `:root { .sel { ... } }`
  // engine-DOM escape hatch is the cross-target replacement.
  //
  // CR-03 — factored out of `buildPlainRule` so BOTH the plain-rule path AND
  // the engine-block child path (`:root { .sel:global(.foo) {} }`) fire it.
  // Engine-block children never flow through `buildPlainRule` (they are
  // collected by the dedicated `walkRules` pass and the top-level pass skips
  // them via `hasRootAncestor`), so without this helper a `:global()` nested
  // inside the escape hatch was silently kept and then silently dropped on
  // React/Solid/Lit — the exact divergence ROZ128 exists to make impossible.
  const checkGlobalPseudo = (selector: string, ruleLoc: SourceLoc): void => {
    if (!selector.includes(':global(')) return;
    diagnostics.push({
      code: RozieErrorCode.STYLE_GLOBAL_PSEUDO_FORBIDDEN,
      severity: 'error',
      message:
        ':global() is not supported in <style> — it works only on Vue/Svelte and is silently dropped on React, Solid, and Lit.',
      loc: isScss ? contentLoc : ruleLoc,
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Use a :root { .selector { ... } } block to style engine-rendered runtime DOM across all six targets.',
    });
  };

  /**
   * Run the per-rule diagnostics (ROZ128 `:global()` + ROZ081 mixed-`:root`)
   * for a rule's selector, given its already-computed loc. Factored out of
   * `buildPlainRule` (quick task 260703-12j) so the new top-level conditional-
   * group at-rule pass can reuse the SAME diagnostics for its inner rules
   * without also pushing them as separate scoped rules. Returns whether the
   * selector is a pure `:root` escape (mirrors `buildPlainRule`'s `isPureRoot`).
   */
  const runRuleDiagnostics = (selector: string, ruleLoc: SourceLoc): boolean => {
    checkGlobalPseudo(selector, ruleLoc);
    // Selector classification (Pitfall 6 — mixed-:root rejection).
    const parts = selector.split(',').map(s => s.trim());
    const hasRoot = parts.includes(':root');
    const isPureRoot = parts.length === 1 && parts[0] === ':root';
    if (hasRoot && !isPureRoot) {
      // D-07 — for SCSS-sourced blocks, `ruleLoc` indexes into the COMPILED
      // CSS (nesting flattened, mixins expanded) and has no correspondence to
      // SCSS source bytes; reporting it would actively mislead. Clamp to the
      // coarse `<style>`-block content span. The plain-CSS path keeps the
      // precise per-rule `nodeLoc` unchanged (SPEC-REQ-8).
      diagnostics.push({
        code: RozieErrorCode.STYLE_MIXED_ROOT_SELECTOR,
        severity: 'error',
        message: `Mixed :root selector "${selector}" is not allowed. Split :root rules into their own block.`,
        loc: isScss ? contentLoc : ruleLoc,
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Move :root rules into a separate selector block; combining :root with other selectors mixes scoped and unscoped emission.',
      });
    }
    return isPureRoot;
  };

  /** Build a plain (non-portal) StyleRule, emitting ROZ081 on mixed :root. */
  const buildPlainRule = (rule: Rule): StyleRule => {
    const ruleLoc = nodeLoc(rule);
    const isPureRoot = runRuleDiagnostics(rule.selector, ruleLoc);
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

  // Phase 34 — the engine-DOM escape hatch. A `:root { .sel { ... } }` block
  // (a pure-`:root` rule that CONTAINS nested `Rule` children) is collected
  // into a single `root-block` StyleRule whose `children` carry the nested
  // selectors flattened bare (NO `:root` wrapper, NO scope attr). This mirrors
  // the `@portal` collect-once + skip-gate above: without it, `postcss`'s
  // `root.walkRules` would descend into the `:root` body and double-collect each
  // nested `.sel` as a dead scoped rule (D-02). The pure-`:root` rule itself
  // still flows through `buildPlainRule` below IF it carries flat declarations
  // (the mixed `:root { --x: 1; .foo {} }` case splits: flat decls →
  // `isRootEscape`/`rootRules`, nested rules → this `root-block`/`engineRules`).
  // A nested-ONLY `:root { .sel {} }` block produces NO `isRootEscape` rule.
  root.walkRules((rule: Rule) => {
    if (hasPortalAncestor(rule) || hasRootAncestor(rule)) return;
    if (!isPureRootSelector(rule.selector)) return;
    // Collect nested child nodes. CR-01 — also collect at-rule children
    // (`@media`, `@supports`, `@container`, keyframes) sliced verbatim, so a
    // responsive engine block (`:root { .cm { } @media (...) { .cm { } } }`)
    // survives instead of being silently dropped: the at-rule descends from a
    // pure-`:root` rule, so the top-level `walkRules` pass skips it via
    // `hasRootAncestor` and nothing else would emit it. The emitters byte-slice
    // by `loc`, so an at-rule child slices its full `@media (...) { ... }` text
    // unchanged. An at-rule child carries an empty `selector` (the prelude lives
    // in the slice); CR-03 fires ROZ128 on the at-rule's INNER rule selectors
    // too via `walkRules`.
    const children: StyleRule[] = [];
    rule.each((child: ChildNode) => {
      if (child.type === 'rule') {
        const childRule = child as Rule;
        checkGlobalPseudo(childRule.selector, nodeLoc(childRule));
        children.push({
          kind: 'rule',
          selector: childRule.selector,
          loc: nodeLoc(childRule),
          isRootEscape: false,
        });
      } else if (child.type === 'atrule') {
        const atChild = child as AtRule;
        // ROZ128 must still fire for a `:global()` nested inside the at-rule
        // (`@media (...) { .cm:global(.foo) {} }`).
        atChild.walkRules((inner: Rule) => {
          checkGlobalPseudo(inner.selector, nodeLoc(inner));
        });
        children.push({
          kind: 'rule',
          selector: '',
          loc: nodeLoc(atChild),
          isRootEscape: false,
        });
      }
    });
    if (children.length === 0) return; // flat-only :root — buildPlainRule handles it
    rules.push({
      kind: 'root-block',
      selector: ':root',
      loc: nodeLoc(rule),
      isRootEscape: false,
      children,
    });
  });

  // Quick task 260703-12j — top-level conditional-group at-rule survival.
  // `root.walkRules` (used both above for `:root` and below for plain rules)
  // DESCENDS into `@media`/`@supports`/`@container` bodies too — without this
  // collect-once pass, the top-level plain-rule pass would collect each INNER
  // selector as a bare, unconditional scoped rule, silently dropping the
  // at-rule wrapper and hoisting a conditional guard (e.g. Dialog's
  // `@media (prefers-reduced-motion: no-preference)` guard) to unconditional.
  //
  // Only DIRECT root children are considered (`root.each`, not `walkAtRules`)
  // so a nested at-rule (`@supports (...) { @media (...) { ... } }`) is NOT
  // separately collected — it stays inside its parent's byte slice, preserving
  // the nesting verbatim. `@keyframes` is deliberately excluded: its children
  // are keyframe selectors (`0%`, `to`, ...), not style rules, and running them
  // through a target's `scopeCss` selector-rewriter would mangle them (T-12j-03,
  // accepted — no shipped component nests @keyframes inside a conditional
  // at-rule). `@portal` is excluded too — it has its own dedicated collection
  // pass (walkAtRules above) and its own nesting-validation diagnostic (ROZ082).
  root.each((node: ChildNode) => {
    if (node.type !== 'atrule') return;
    const atRule = node as AtRule;
    if (!SCOPED_GROUP_AT_RULES.has(atRule.name)) return;

    // ROZ082 (`@portal` nested inside `@media`) is already raised by the
    // dedicated `walkAtRules('portal', ...)` pass above (it runs over the
    // whole `root` independently of this pass and never pushes a `rules`
    // entry for the invalid-nesting case). Skip collecting THIS at-rule as a
    // scoped rule when it contains a descendant `@portal` — otherwise the
    // `@portal ... { ul {} }` text would leak verbatim into the scoped-rule
    // byte slice and its inner `ul` selector would be double-collected here.
    let containsPortal = false;
    atRule.walkAtRules('portal', () => {
      containsPortal = true;
    });
    if (containsPortal) return;

    const children: StyleRule[] = [];
    atRule.walkRules((inner: Rule) => {
      const innerLoc = nodeLoc(inner);
      runRuleDiagnostics(inner.selector, innerLoc);
      children.push({ kind: 'rule', selector: inner.selector, loc: innerLoc, isRootEscape: false });
    });

    rules.push({
      kind: 'at-rule-block',
      selector: '',
      loc: nodeLoc(atRule),
      isRootEscape: false,
      children,
    });
  });

  // Top-level plain rules. Skip any rule that descends from a `@portal`
  // at-rule — those are collected (as `children`) by the walkAtRules pass
  // above. Without this gate they would be double-counted as scopedRules.
  // Also skip rules nested inside a `:root { }` block (Phase 34) — those are
  // collected as a `root-block`'s `children` by the pass above. Also skip
  // rules nested inside a captured conditional-group at-rule (quick task
  // 260703-12j) — those are collected as an `at-rule-block`'s `children` by
  // the pass immediately above.
  root.walkRules((rule: Rule) => {
    if (hasPortalAncestor(rule) || hasRootAncestor(rule) || hasScopedGroupAtRuleAncestor(rule)) return;
    // A pure-`:root` rule that carries NO flat declarations produced a
    // `root-block` above and must NOT also emit a dead empty `isRootEscape`
    // rule. One that DOES carry flat decls still flows through (mixed split).
    if (isPureRootSelector(rule.selector) && !ruleHasDeclarations(rule)) return;
    rules.push(buildPlainRule(rule));
  });

  return {
    node: {
      type: 'StyleAST',
      loc: contentLoc,
      // Phase 10: `cssForPostcss` is the raw body for plain CSS and the
      // dart-sass-compiled plain CSS for `lang="scss"` — it is the string the
      // downstream PostCSS scoping pass consumes.
      cssText: cssForPostcss,
      rules,
      // Phase 9: carry the resolved `lang` onto the StyleAST. Set only when
      // present — conditional-spread keeps the key absent under
      // `exactOptionalPropertyTypes: true` (WR-04).
      ...(lang !== undefined ? { lang } : {}),
    },
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
 * True when `rule` is nested (at any depth) inside a `:root { }` rule (Phase
 * 34, the engine-DOM escape hatch). Clone of `hasPortalAncestor`, but `:root`
 * is a Rule (NOT an at-rule) — so the ancestor test keys on `type === 'rule'`
 * with a pure-`:root` selector, not `type === 'atrule'`. Gates the top-level
 * `walkRules` pass so a nested-`:root` inner rule is never double-collected as
 * a `scopedRule`; it is collected once as a `root-block` child instead.
 */
function hasRootAncestor(rule: Rule): boolean {
  let parent: Node | undefined = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'rule' && isPureRootSelector((parent as Rule).selector)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * True when `rule` is nested (at any depth) inside a top-level
 * `@media`/`@supports`/`@container` at-rule captured by the `at-rule-block`
 * pass (quick task 260703-12j). Mirrors `hasPortalAncestor`. Gates the
 * top-level `walkRules` plain-rule pass so a captured at-rule's inner rules
 * are NOT double-collected as bare unconditional scoped rules.
 */
function hasScopedGroupAtRuleAncestor(rule: Rule): boolean {
  let parent: Node | undefined = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && SCOPED_GROUP_AT_RULES.has((parent as AtRule).name)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * True when a selector list is exactly `:root` (a single `:root` part, the
 * escape-hatch trigger). The descendant-combinator form `:root .foo` is a
 * single multi-token selector — NOT pure `:root` — so it is NOT a trigger and
 * stays a scoped rule. Mirrors `buildPlainRule`'s `isPureRoot` classification.
 */
function isPureRootSelector(selector: string): boolean {
  const parts = selector.split(',').map(s => s.trim());
  return parts.length === 1 && parts[0] === ':root';
}

/** True when a rule has at least one direct declaration node (e.g. `--x: 1`). */
function ruleHasDeclarations(rule: Rule): boolean {
  return rule.nodes.some(n => n.type === 'decl');
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
