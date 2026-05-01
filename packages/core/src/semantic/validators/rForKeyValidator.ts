/**
 * SEM-03 — r-for :key hygiene validator (Plan 02-02 Task 3).
 *
 * Walks every element in <template>, finds those with `r-for=...`, and
 * emits:
 *
 *   ROZ300 — :key attribute is missing entirely.
 *   ROZ301 — :key value is the loop's item OR index alias (per Pitfall 6).
 *   ROZ302 — :key value is a non-primitive expression (object/array literal).
 *
 * For all other key shapes (MemberExpression, BinaryExpression, LogicalExp,
 * ConditionalExpression, etc.) the validator stays silent — the author
 * provided a richer key and we defer to runtime semantics.
 *
 * Per Pitfall 6 alias support: when the r-for binding is
 * `(item, idx) in items`, the validator extracts BOTH aliases and warns
 * if `:key` is exactly either one — even when the user renamed `index`
 * (the alias literal text differs from `index`).
 *
 * Per D-08 collected-not-thrown: NEVER throws. Malformed r-for values
 * (un-parseable LHS) and malformed :key values (unparsable expression
 * text) are silently skipped — both are reported by upstream parsers.
 *
 * Per D-11/D-12: every emitted diagnostic carries an accurate byte-offset
 * loc. ROZ300 points at the element opening tag (TemplateElement.loc).
 * ROZ301/ROZ302 point at the :key attribute value (TemplateAttr.valueLoc
 * fallback to TemplateAttr.loc).
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type {
  TemplateAttr,
  TemplateElement,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { walkTemplateElements } from '../walkTemplate.js';
import { extractRForAliases } from '../extractRForAliases.js';

function findRForAttr(el: TemplateElement): TemplateAttr | undefined {
  return el.attributes.find((a) => a.kind === 'directive' && a.name === 'for');
}

function findKeyAttr(el: TemplateElement): TemplateAttr | undefined {
  return el.attributes.find((a) => a.kind === 'binding' && a.name === 'key');
}

function keyAttrLoc(attr: TemplateAttr): SourceLoc {
  return attr.valueLoc ?? attr.loc;
}

function emitMissingKey(el: TemplateElement, diagnostics: Diagnostic[]): void {
  diagnostics.push({
    code: RozieErrorCode.RFOR_MISSING_KEY,
    severity: 'warning',
    message: `r-for on <${el.tagName}> is missing :key — non-keyed lists break across all four target frameworks on reorder.`,
    loc: el.loc,
    hint: `Add :key="<stable id>" to ${el.tagName} (e.g. :key="item.id").`,
  });
}

function emitLoopVariableKey(
  el: TemplateElement,
  attr: TemplateAttr,
  identName: string,
  whichAlias: 'item' | 'index',
  diagnostics: Diagnostic[],
): void {
  diagnostics.push({
    code: RozieErrorCode.RFOR_KEY_IS_LOOP_VARIABLE,
    severity: 'warning',
    message:
      whichAlias === 'index'
        ? `:key="${identName}" — using the loop index as a key breaks reorder behavior.`
        : `:key="${identName}" — using the loop value itself as a key is unstable across reorders.`,
    loc: keyAttrLoc(attr),
    hint: 'Use a stable identifier from the iterated item, e.g., :key="item.id".',
  });
}

function emitNonPrimitiveKey(
  el: TemplateElement,
  attr: TemplateAttr,
  diagnostics: Diagnostic[],
): void {
  diagnostics.push({
    code: RozieErrorCode.RFOR_KEY_IS_NON_PRIMITIVE,
    severity: 'warning',
    message: `:key="${attr.value ?? ''}" is a non-primitive expression — object/array keys coerce to "[object Object]" across all four target frameworks.`,
    loc: keyAttrLoc(attr),
    hint: 'Pass a primitive (string/number) — e.g., :key="item.id".',
  });
}

function checkElement(el: TemplateElement, diagnostics: Diagnostic[]): void {
  const rForAttr = findRForAttr(el);
  if (!rForAttr) return;

  const keyAttr = findKeyAttr(el);
  if (!keyAttr) {
    emitMissingKey(el, diagnostics);
    return;
  }

  // Boolean :key (no value) — bizarre; skip.
  if (keyAttr.value === null) return;

  // Parse the :key expression. On parse error, skip (parser layer reports
  // malformed mustache / expression text as ROZ051; double-emit avoided).
  let parsed: t.Expression;
  try {
    parsed = parseExpression(keyAttr.value, { sourceType: 'module' });
  } catch {
    return;
  }

  // Extract aliases from the r-for LHS. If null (parse failure / malformed),
  // we cannot detect alias usage — but we can still detect non-primitive
  // shapes, so continue.
  const aliases = extractRForAliases(rForAttr.value ?? '');

  // ROZ301: bare identifier matching item/index alias.
  if (t.isIdentifier(parsed) && aliases) {
    if (parsed.name === aliases.index) {
      emitLoopVariableKey(el, keyAttr, parsed.name, 'index', diagnostics);
      return;
    }
    if (parsed.name === aliases.item) {
      emitLoopVariableKey(el, keyAttr, parsed.name, 'item', diagnostics);
      return;
    }
    // Bare identifier that's not a loop alias — could be a script-scope
    // variable; defer to runtime contract.
    return;
  }

  // ROZ302: non-primitive object/array literal.
  if (t.isObjectExpression(parsed) || t.isArrayExpression(parsed)) {
    emitNonPrimitiveKey(el, keyAttr, diagnostics);
    return;
  }

  // All other shapes (MemberExpression, LogicalExpression, BinaryExpression,
  // ConditionalExpression, CallExpression, …) — author provided a more
  // sophisticated key; defer to runtime contract per Pitfall 6.
}

/**
 * Run the r-for :key hygiene validator over the AST. Emits ROZ300/ROZ301/
 * ROZ302. NEVER throws (D-08).
 */
export function runRForKeyValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  if (!ast.template) return;
  walkTemplateElements(ast.template, (el) => checkElement(el, diagnostics));
}
