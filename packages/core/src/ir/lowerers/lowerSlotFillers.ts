/**
 * lowerSlotFillers — extract `<template #name>` directives from component-tag
 * children into `SlotFillerDecl[]`.
 *
 * Phase 07.2 Plan 01 Task 3.
 *
 * Operates on a parallel pair of arrays:
 *   - `componentChildren` — the raw `TemplateAST` children of a component-tag
 *   - `loweredChildren`   — the same children already lowered to `IRTemplateNode`s
 *
 * For each child:
 *   - If it's a `<template>` element with a `#name` / `#default` / `#[expr]`
 *     attribute → build a `SlotFillerDecl` whose `body` is the child's
 *     lowered children.
 *   - Otherwise → buffer as "loose" content for the default-shorthand synth.
 *
 * R3 default-shorthand contract: when no explicit `<template #default>` is
 * present and there are meaningful (non-pure-whitespace) loose children, a
 * synthetic `SlotFillerDecl { name: '' }` wrapping those children is appended.
 * Mixing loose children + an explicit `<template #default>` emits ROZ940
 * `DUPLICATE_DEFAULT_FILL`.
 *
 * R5 dynamic-name parsing: `#[expr]` → parse the bracketed text via
 * `@babel/parser.parseExpression`. Parse failure → ROZ946
 * `DYNAMIC_NAME_EXPRESSION_INVALID`.
 *
 * Sibling duplicate-named fills emit ROZ942 `DUPLICATE_NAMED_FILL` per D-08.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failure paths push a
 * diagnostic and continue with a degraded-but-safe result.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type {
  TemplateNode as ASTTemplateNode,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type {
  SlotFillerDecl,
  ParamDecl,
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
} from '../types.js';

/**
 * Result of parsing a `#name` / `#[expr]` / `#default` directive's name part.
 */
interface ParsedFillDirective {
  /** Resolved slot name; '' for default. */
  name: string;
  /** Whether the original directive was `#[expr]`. */
  isDynamic: boolean;
  /** Parsed bracketed expression; only set when isDynamic and parse succeeded. */
  dynamicNameExpr?: t.Expression;
  /** Set when parsing failed (ROZ946 already pushed). */
  errored: boolean;
}

/**
 * Parse a fill-directive raw attribute name into a normalized shape.
 *
 *   '#header'   → { name: 'header',   isDynamic: false }
 *   '#default'  → { name: '',         isDynamic: false }  // map to D-18 sentinel
 *   '#[expr]'   → { name: <exprText>, isDynamic: true,    dynamicNameExpr: <parsed> }
 *   '#[bad..]'  → ROZ946 emitted; returns { name: '__error__', isDynamic: true, errored: true }
 */
function parseFillDirectiveName(
  rawName: string,
  loc: { start: number; end: number },
  diagnostics: Diagnostic[],
): ParsedFillDirective {
  // rawName begins with '#'
  const inner = rawName.slice(1);

  if (inner.startsWith('[') && inner.endsWith(']') && inner.length >= 2) {
    const exprText = inner.slice(1, -1);
    try {
      const expr = parseExpression(exprText, { sourceType: 'module' });
      return {
        name: exprText,
        isDynamic: true,
        dynamicNameExpr: expr,
        errored: false,
      };
    } catch {
      diagnostics.push({
        code: RozieErrorCode.DYNAMIC_NAME_EXPRESSION_INVALID,
        severity: 'error',
        message: `Dynamic slot name expression "${exprText}" is not a valid JS expression.`,
        loc,
      });
      return { name: '__error__', isDynamic: true, errored: true };
    }
  }

  // #default → default-slot sentinel '' per D-18 convention.
  if (inner === 'default') {
    return { name: '', isDynamic: false, errored: false };
  }

  // Static named slot.
  return { name: inner, isDynamic: false, errored: false };
}

/**
 * Parse the scoped-params destructure of a `<template #name="{ a, b }">`
 * attribute value. Returns `ParamDecl[]` — one per top-level destructure
 * binding identifier.
 *
 * Wraps the raw value in parens to coerce object-pattern context for the
 * Babel parser. Bindings that aren't simple object-properties (e.g., spreads,
 * computed keys) are silently skipped — the consumer's intent is unambiguous
 * only for the simple `{ a, b: c }` shape; threadParamTypes later validates
 * the param names against the producer SlotDecl.params for ROZ947.
 */
function parseScopedParams(
  rawValue: string | null,
  valueLoc: { start: number; end: number } | null,
): ParamDecl[] {
  if (rawValue === null || valueLoc === null) return [];
  try {
    const expr = parseExpression(`(${rawValue})`, { sourceType: 'module' });
    if (!t.isObjectExpression(expr)) return [];
    const params: ParamDecl[] = [];
    for (const prop of expr.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      if (prop.computed) continue;
      if (!t.isIdentifier(prop.key)) continue;
      params.push({
        type: 'ParamDecl',
        name: prop.key.name,
        // Identity binding — the param's value-expression in scope is itself.
        // threadParamTypes attaches paramTypes; emitters generate `{ a, b }` /
        // `({ a, b }) => …` per target.
        valueExpression: t.identifier(prop.key.name),
        sourceLoc: valueLoc,
      });
    }
    return params;
  } catch {
    return [];
  }
}

/**
 * Locate a fill-directive attribute on a `<template>` element. Returns the
 * first attribute whose `rawName` starts with `#`, or `null` if none.
 *
 * Currently parseTemplate.ts keeps `#`-prefixed attributes with kind: 'static'
 * (Task 3 parser extension preserves rawName verbatim — see PATTERNS.md note
 * "lowerer treats them specially based on the # prefix").
 */
function findFillAttr(attrs: TemplateAttr[]): TemplateAttr | null {
  for (const attr of attrs) {
    if (attr.rawName.startsWith('#')) return attr;
  }
  return null;
}

/**
 * Span the source-loc across a sequence of nodes. Used for the synthetic
 * default-shorthand SlotFillerDecl.sourceLoc.
 */
function spanLoc(nodes: IRTemplateNode[]): { start: number; end: number } {
  if (nodes.length === 0) return { start: 0, end: 0 };
  const first = nodes[0]!.sourceLoc ?? { start: 0, end: 0 };
  const last = nodes[nodes.length - 1]!.sourceLoc ?? { start: 0, end: 0 };
  return { start: first.start, end: last.end };
}

/**
 * Extract `SlotFillerDecl[]` from a component-tag's children.
 *
 * @param componentChildren - the raw AST children of the component-tag element
 * @param loweredChildren   - the parallel IR children produced by the
 *   lowerTemplate walker for the same element. Indexed identically.
 * @param diagnostics       - accumulator for ROZ940 / ROZ942 / ROZ946
 *
 * @returns the populated `SlotFillerDecl[]`. Empty when the element has no
 *   `<template #name>` children AND no meaningful loose-content children.
 */
export function extractSlotFillers(
  componentChildren: readonly ASTTemplateNode[],
  loweredChildren: readonly IRTemplateNode[],
  diagnostics: Diagnostic[],
): SlotFillerDecl[] {
  const fillers: SlotFillerDecl[] = [];
  const looseChildren: IRTemplateNode[] = [];
  let explicitDefaultLoc: { start: number; end: number } | null = null;
  const seenNamed = new Map<string, { start: number; end: number }>();

  for (let i = 0; i < componentChildren.length; i++) {
    const astChild = componentChildren[i]!;
    const irChild = loweredChildren[i]!;

    if (
      astChild.type === 'TemplateElement' &&
      astChild.tagName === 'template'
    ) {
      const fillAttr = findFillAttr(astChild.attributes);
      if (fillAttr) {
        const directive = parseFillDirectiveName(
          fillAttr.rawName,
          fillAttr.loc,
          diagnostics,
        );

        // Skip errored dynamic directives — ROZ946 already pushed; do not
        // synthesize a SlotFillerDecl since the name is meaningless.
        if (directive.errored) continue;

        const params = parseScopedParams(fillAttr.value, fillAttr.valueLoc);

        // Track explicit-default vs named-duplicate per D-08:
        //   - ROZ940 — loose-children-with-explicit-default conflict
        //   - ROZ942 — sibling <template #header> + <template #header>
        if (!directive.isDynamic) {
          if (directive.name === '') {
            // Explicit #default declared.
            if (explicitDefaultLoc !== null) {
              diagnostics.push({
                code: RozieErrorCode.DUPLICATE_NAMED_FILL,
                severity: 'error',
                message:
                  'Duplicate <template #default> fill — a component may declare at most one default-slot fill.',
                loc: astChild.loc,
              });
              continue;
            }
            explicitDefaultLoc = astChild.loc;
          } else {
            const prior = seenNamed.get(directive.name);
            if (prior !== undefined) {
              diagnostics.push({
                code: RozieErrorCode.DUPLICATE_NAMED_FILL,
                severity: 'error',
                message: `Duplicate <template #${directive.name}> fill — only one sibling fill may target slot '${directive.name}'.`,
                loc: astChild.loc,
              });
              continue;
            }
            seenNamed.set(directive.name, astChild.loc);
          }
        }

        // Body = the IR children of the <template> element. The lowerTemplate
        // walker has already lowered them; we just attach them here.
        const body: IRTemplateNode[] =
          irChild.type === 'TemplateElement' ? irChild.children : [];

        const filler: SlotFillerDecl = {
          type: 'SlotFillerDecl',
          name: directive.name,
          params,
          body,
          sourceLoc: astChild.loc,
          ...(directive.isDynamic
            ? {
                isDynamic: true as const,
                ...(directive.dynamicNameExpr
                  ? { dynamicNameExpr: directive.dynamicNameExpr }
                  : {}),
              }
            : {}),
        };
        fillers.push(filler);
        continue;
      }
      // <template> without a # directive — fall through to loose buffer.
    }
    // Non-<template> child (or <template> without #) → loose default-shorthand.
    looseChildren.push(irChild);
  }

  // R3 default-shorthand: filter out pure-whitespace static text and synthesize
  // a single { name: '' } SlotFillerDecl wrapping the meaningful loose
  // children. Mixing loose + explicit default → ROZ940.
  const meaningfulLoose = looseChildren.filter((c) => {
    if (c.type === 'TemplateStaticText') {
      return c.text.trim().length > 0;
    }
    return true;
  });

  if (meaningfulLoose.length > 0) {
    if (explicitDefaultLoc !== null) {
      diagnostics.push({
        code: RozieErrorCode.DUPLICATE_DEFAULT_FILL,
        severity: 'error',
        message:
          'Component-tag body has both loose children and an explicit <template #default> fill — pick one.',
        loc: meaningfulLoose[0]!.sourceLoc ?? explicitDefaultLoc,
      });
    } else {
      fillers.push({
        type: 'SlotFillerDecl',
        name: '',
        params: [],
        body: meaningfulLoose,
        sourceLoc: spanLoc(meaningfulLoose),
      });
    }
  }

  return fillers;
}

/**
 * Type guard helper for downstream call sites that want to narrow a
 * `TemplateElementIR` to one that has populated slot fillers.
 */
export function hasSlotFillers(
  el: TemplateElementIR,
): el is TemplateElementIR & { slotFillers: SlotFillerDecl[] } {
  return Array.isArray(el.slotFillers) && el.slotFillers.length > 0;
}
