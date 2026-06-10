/**
 * validatePortalScopedStyle — Phase 38 (portal-scoped-style Lit diagnostic).
 *
 * Post-IR pass that flags a plain SCOPED `<style>` rule whose subject class/tag
 * is used EXCLUSIVELY inside portal-slot fill content (a `<template #body>` /
 * `#node` / `<slot portal>` fill, incl. `$portals.default`). Such content
 * teleports into the wrapper component's shadow root on Lit, where the
 * consumer's `[data-rozie-s-*]` scope attribute is absent — so the scoped rule
 * silently never applies:
 *
 *   - React/Vue/Svelte/Solid/Angular (light DOM): one document,
 *     attribute-hashed → the rule still matches → looks fine. The author never
 *     notices the latent Lit regression.
 *   - Lit (shadow DOM): the rule lives in the consumer's shadow root, the
 *     content lives in the wrapper's shadow root → the rule never applies.
 *     Silent visual regression, invisible to every behavioral/typecheck gate.
 *
 * The fix is the `:root { }` engine-DOM escape hatch (Phase 34) — a
 * document-level block the wrapper's `adopt-document-styles` adopts into its
 * shadow root, reaching the teleported content on all six targets. `:global()`
 * is forbidden (ROZ128); `:root` is the sanctioned tool.
 *
 * Trigger precision (D-01): warn ONLY when the subject class/tag appears
 * EXCLUSIVELY in portal-fill bodies — a class used in both portal and normal
 * content legitimately needs the scoped rule for its normal use, so it is
 * skipped (no false positive).
 *
 * Selector scope (D-05): v1 handles only a bare class subject (`.x`), a bare
 * tag subject (`el`), and a combinator-free compound of classes/tags (`.a.b`,
 * `el.x`). Any combinator (space / `>` / `+` / `~`), id (`#`), attribute (`[`),
 * or pseudo (`:` / `::`) selector is OUT OF SCOPE → no warning (stays
 * high-precision; deferred selectors simply don't fire).
 *
 * Per D-08 collected-not-thrown: NEVER throws. All matches push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wiring difference from the validateSlotPropCollision / validateClassSelector
 * analogs: this pass is wired AFTER `threadParamTypes` (`compile.ts`), NOT
 * inside `lowerToIR`. `filler.isPortal` is set only at threadParamTypes.ts:284,
 * which runs after lowering — wiring inside `lowerToIR` would see
 * `isPortal: undefined` everywhere and warn on nothing (silent false negative).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent, SlotFillerDecl, TemplateNode } from './types.js';
import type { StyleRule } from '../ast/blocks/StyleAST.js';

// ---------------------------------------------------------------------------
// Class/tag token toolkit — mirrors validateClassSelector.ts:67-91. Copied
// locally (not lifted to a shared module) to keep this pass self-contained;
// see packages/core/src/ir/validateClassSelector.ts for the canonical source.
// ---------------------------------------------------------------------------

/** A single bare CSS class/tag identifier — no `.`, `#`, whitespace, combinator. */
const VALID_CLASS_TOKEN = /^[A-Za-z_-][A-Za-z0-9_-]*$/;

/** Class-token extractor over a sanitized selector string. */
const CLASS_TOKEN_IN_SELECTOR = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;

/** Combinator / id / attribute / pseudo markers that put a selector OUT OF SCOPE (D-05). */
const OUT_OF_SCOPE_SELECTOR = /[\s>+~#[:]/;

/**
 * The subject of a single combinator-free compound selector.
 *   - `classes` — bare `.x` (and `.a.b` compound) tokens.
 *   - `tag`     — a leading bare tag identifier (`el`, `el.x`).
 * A sub-selector with any combinator/id/attribute/pseudo yields `null` (skip).
 */
interface Subject {
  classes: Set<string>;
  tag: string | null;
}

/**
 * Extract the subject(s) of a raw selector per D-05. Splits on `,`
 * (sub-selectors); any sub-selector containing a combinator (whitespace, `>`,
 * `+`, `~`), id (`#`), attribute (`[`), or pseudo (`:` / `::`) is OUT OF SCOPE
 * and contributes nothing (we never reduce a combinator selector to its
 * rightmost compound — Pitfall 3 / D-05). A single combinator-free compound
 * contributes its bare `.class` tokens and, if it starts with a bare tag
 * identifier, that tag.
 *
 * Defensive: a malformed selector yields an empty subject rather than throwing.
 */
function extractSubject(selector: unknown): Subject {
  const subject: Subject = { classes: new Set(), tag: null };
  if (typeof selector !== 'string') return subject;

  for (const raw of selector.split(',')) {
    const sub = raw.trim();
    if (sub === '') continue;
    // Any combinator / id / attribute / pseudo → out of scope (D-05).
    if (OUT_OF_SCOPE_SELECTOR.test(sub)) continue;

    // Class tokens in this combinator-free compound.
    for (const m of sub.matchAll(CLASS_TOKEN_IN_SELECTOR)) {
      if (m[1]) subject.classes.add(m[1]);
    }

    // A leading bare tag identifier (the compound does not start with `.`).
    // e.g. `strong` → tag 'strong'; `el.x` → tag 'el' + class 'x'.
    if (!sub.startsWith('.')) {
      const lead = sub.match(/^([A-Za-z_-][A-Za-z0-9_-]*)/);
      if (lead && lead[1] && VALID_CLASS_TOKEN.test(lead[1])) {
        subject.tag = lead[1];
      }
    }
  }
  return subject;
}

// ---------------------------------------------------------------------------
// Template-element class/tag collection.
// ---------------------------------------------------------------------------

/** Collect the class tokens authored on a single TemplateElement. */
function collectElementClasses(
  node: Extract<TemplateNode, { type: 'TemplateElement' }>,
  out: Set<string>,
): void {
  for (const attr of node.attributes) {
    // `r-bind="obj"` spread bindings carry no `name` — skip (no static class
    // tokens to harvest; a dynamic spread can't be statically resolved here).
    if (attr.kind === 'spreadBinding') continue;
    if (attr.name !== 'class') continue;
    switch (attr.kind) {
      case 'static':
        // `class="a b"` — split on whitespace.
        for (const tok of attr.value.split(/\s+/)) {
          if (tok !== '') out.add(tok);
        }
        break;
      case 'binding':
        // `:class="{ x: y }"` — ObjectExpression property keys are class names.
        collectObjectClassKeys(attr.expression, out);
        break;
      case 'interpolated':
        // `class="card--{{ x }}"` — static segments carry literal class text.
        for (const seg of attr.segments) {
          if (seg.kind === 'static') {
            for (const tok of seg.text.split(/\s+/)) {
              if (tok !== '') out.add(tok);
            }
          }
        }
        break;
    }
  }
}

/** Pull class names from a `:class="{ 'x': cond }"` ObjectExpression. Defensive. */
function collectObjectClassKeys(expr: unknown, out: Set<string>): void {
  if (!expr || !t.isObjectExpression(expr as t.Node)) return;
  for (const prop of (expr as t.ObjectExpression).properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.key;
    if (t.isStringLiteral(key)) {
      // A string-literal key may itself be a space-separated class list.
      for (const tok of key.value.split(/\s+/)) {
        if (tok !== '') out.add(tok);
      }
    } else if (!prop.computed && t.isIdentifier(key)) {
      out.add(key.name);
    }
  }
}

/**
 * Walk a template subtree, partitioning every element's class tokens and tag
 * name into a PORTAL bucket (reached while inside a `filler.isPortal === true`
 * body, skipping `filler.isDynamic` fills) and a NON-portal bucket.
 *
 * `inPortal` carries down through nested elements/fills so an element deep
 * inside a portal-fill body is still counted as portal.
 */
interface Buckets {
  portalClasses: Set<string>;
  portalTags: Set<string>;
  nonPortalClasses: Set<string>;
  nonPortalTags: Set<string>;
}

function walk(
  node: TemplateNode | null,
  inPortal: boolean,
  b: Buckets,
): void {
  if (node === null) return;

  switch (node.type) {
    case 'TemplateElement': {
      const classBucket = inPortal ? b.portalClasses : b.nonPortalClasses;
      const tagBucket = inPortal ? b.portalTags : b.nonPortalTags;
      const classes = new Set<string>();
      collectElementClasses(node, classes);
      for (const c of classes) classBucket.add(c);
      if (node.tagKind === 'html' && VALID_CLASS_TOKEN.test(node.tagName)) {
        tagBucket.add(node.tagName);
      }

      // A `<template #X>` slot-fill directive is preserved in BOTH `children`
      // (the raw directive element) AND the matching `slotFillers[].body`. Walk
      // the directive's content ONLY via `slotFillers` (with the right portal
      // flag) — walking the `<template>` child too would double-count its
      // classes as NON-portal and defeat the D-01 exclusivity test.
      for (const child of node.children) {
        if (child.type === 'TemplateElement' && child.tagName === 'template') {
          continue;
        }
        walk(child, inPortal, b);
      }

      if (node.slotFillers) {
        for (const f of node.slotFillers) {
          // Dynamic fills never thread isPortal → treat as non-portal.
          const fillerIsPortal = !f.isDynamic && f.isPortal === true;
          const childInPortal = inPortal || fillerIsPortal;
          for (const child of f.body) walk(child, childInPortal, b);
        }
      }
      break;
    }
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walk(child, inPortal, b);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walk(child, inPortal, b);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walk(child, inPortal, b);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walk(child, inPortal, b);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/**
 * Find ONE portal filler whose body contributes the given class/tag subject so
 * the message can name the portal slot + child component (D-03). Best-effort:
 * returns the first portal filler whose body uses the subject; if none is
 * pinpointed, returns null and the message falls back to generic wording.
 */
function findNamingFiller(
  node: TemplateNode | null,
  subjectClasses: Set<string>,
  subjectTag: string | null,
): { slotName: string; childTag: string } | null {
  if (node === null) return null;

  switch (node.type) {
    case 'TemplateElement': {
      if (node.slotFillers) {
        for (const f of node.slotFillers) {
          if (f.isDynamic || f.isPortal !== true) continue;
          if (fillerUsesSubject(f, subjectClasses, subjectTag)) {
            return { slotName: f.name, childTag: node.tagName };
          }
        }
      }
      for (const child of node.children) {
        // Skip `<template #X>` slot-fill directive children — their content is
        // walked via `slotFillers` below (mirrors `walk`).
        if (child.type === 'TemplateElement' && child.tagName === 'template') {
          continue;
        }
        const hit = findNamingFiller(child, subjectClasses, subjectTag);
        if (hit) return hit;
      }
      if (node.slotFillers) {
        for (const f of node.slotFillers) {
          for (const child of f.body) {
            const hit = findNamingFiller(child, subjectClasses, subjectTag);
            if (hit) return hit;
          }
        }
      }
      break;
    }
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) {
          const hit = findNamingFiller(child, subjectClasses, subjectTag);
          if (hit) return hit;
        }
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) {
        const hit = findNamingFiller(child, subjectClasses, subjectTag);
        if (hit) return hit;
      }
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) {
        const hit = findNamingFiller(child, subjectClasses, subjectTag);
        if (hit) return hit;
      }
      break;
    case 'TemplateFragment':
      for (const child of node.children) {
        const hit = findNamingFiller(child, subjectClasses, subjectTag);
        if (hit) return hit;
      }
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
  return null;
}

/** Whether a portal filler's body uses any of the subject class/tag tokens. */
function fillerUsesSubject(
  f: SlotFillerDecl,
  subjectClasses: Set<string>,
  subjectTag: string | null,
): boolean {
  let found = false;
  const b: Buckets = {
    portalClasses: new Set(),
    portalTags: new Set(),
    nonPortalClasses: new Set(),
    nonPortalTags: new Set(),
  };
  for (const child of f.body) walk(child, true, b);
  for (const c of subjectClasses) {
    if (b.portalClasses.has(c)) found = true;
  }
  if (subjectTag && b.portalTags.has(subjectTag)) found = true;
  return found;
}

/**
 * Validate every scoped `<style>` rule against the component's portal-fill
 * content.
 *
 * @param ir          - the lowered + threaded IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ088 pushed per match)
 */
export function validatePortalScopedStyle(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  if (ir.template === null || ir.template === undefined) return;

  const buckets: Buckets = {
    portalClasses: new Set(),
    portalTags: new Set(),
    nonPortalClasses: new Set(),
    nonPortalTags: new Set(),
  };
  walk(ir.template, false, buckets);

  // D-01 exclusivity: a subject is portal-exclusive iff it never occurs in
  // non-portal content. Classes and tags are kept distinguishable so a `.x`
  // selector only matches a portal-exclusive CLASS and a bare `el` selector
  // only matches a portal-exclusive TAG.
  const portalExclusiveClasses = new Set<string>();
  for (const c of buckets.portalClasses) {
    if (!buckets.nonPortalClasses.has(c)) portalExclusiveClasses.add(c);
  }
  const portalExclusiveTags = new Set<string>();
  for (const tg of buckets.portalTags) {
    if (!buckets.nonPortalTags.has(tg)) portalExclusiveTags.add(tg);
  }

  if (portalExclusiveClasses.size === 0 && portalExclusiveTags.size === 0) {
    return;
  }

  // Read ONLY the risk set (`scopedRules`). The other style buckets are
  // escape-hatched (`:root {}` / `:root { .x {} }` / `@portal {}`) and SAFE —
  // the pass never reads them.
  const scopedRules = (ir.styles?.scopedRules ?? []) as StyleRule[];

  for (const rule of scopedRules) {
    const subject = extractSubject(rule?.selector);

    // A subject matches when ANY of its class tokens is a portal-exclusive
    // class, OR its tag is a portal-exclusive tag (class-vs-class, tag-vs-tag).
    const matchedClasses = new Set<string>();
    for (const c of subject.classes) {
      if (portalExclusiveClasses.has(c)) matchedClasses.add(c);
    }
    const matchedTag =
      subject.tag !== null && portalExclusiveTags.has(subject.tag)
        ? subject.tag
        : null;

    if (matchedClasses.size === 0 && matchedTag === null) continue;

    // Per-rule dedup is free (one push per scoped rule).
    const naming = findNamingFiller(ir.template, matchedClasses, matchedTag);
    const subjectLabel =
      matchedTag !== null
        ? `\`${matchedTag}\``
        : `\`.${[...matchedClasses].join('.')}\``;
    const where = naming
      ? `the \`${naming.slotName || '(default)'}\` portal slot of \`<${naming.childTag}>\``
      : 'portal-slot fill content';

    diagnostics.push({
      code: RozieErrorCode.STYLE_SCOPED_RULE_TARGETS_PORTAL_CONTENT,
      severity: 'warning',
      message: `Scoped style \`${rule.selector}\` (subject ${subjectLabel}) targets content rendered into ${where}. Portal content teleports into the engine's shadow root on Lit, where this scoped rule can't reach it (the 5 light-DOM targets are unaffected).`,
      loc: rule.loc,
      hint: `Move this rule into a \`:root { … }\` block (the Phase 34 engine-DOM escape hatch) so it applies on all six targets — \`:global()\` is forbidden (ROZ128).`,
    });
  }
}
