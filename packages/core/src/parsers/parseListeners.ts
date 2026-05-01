/**
 * `<listeners>` block parser (PARSE-05 — D-15 stage 1).
 *
 * Two-stage strategy per D-15:
 *   Stage 1 (THIS plan): parse the block content via `parseExpression` as an
 *     ObjectExpression. For each `ObjectProperty`, the key MUST be a string
 *     literal (e.g., `"document:click.outside($refs.x)"`). We split it into
 *     `target`, `event`, and `modifierChainText` (preserved verbatim,
 *     INCLUDING the leading dot). The modifier-chain-text is NOT parsed here.
 *   Stage 2 (Plan 04): the peggy modifier grammar consumes
 *     `modifierChainText` to produce structured `ModifierChain[]`.
 *
 * D-08: collected-not-thrown. ROZxxx codes owned here:
 *  - ROZ010  Invalid JS expression in <listeners>
 *  - ROZ011  <listeners> is not an object literal
 *  - ROZ012  Listener key is not a string literal (D-15 violation)
 *  - ROZ013  Listener entry is not a key:value object property
 *
 * Threat model T-1-03-01: prototype-pollution-shaped keys (e.g., `__proto__`)
 * are treated as ordinary string keys — we never `Object.assign({}, ...)` or
 * reduce listener entries via runtime evaluation. The AST keeps them as a
 * named ObjectProperty; downstream stages (Plan 04 / Phase 2) read them
 * declaratively.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import type {
  ObjectExpression,
  ObjectProperty,
  Expression,
  StringLiteral,
} from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ListenersAST, ListenerEntry } from '../ast/blocks/ListenersAST.js';
import { parserPositionFor, babelLocToRozieLoc } from './parserPosition.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseListenersResult {
  node: ListenersAST | null;
  diagnostics: Diagnostic[];
}

export function parseListeners(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseListenersResult {
  const diagnostics: Diagnostic[] = [];
  const pos = parserPositionFor(source, contentLoc);

  let expr: ReturnType<typeof parseExpression>;
  try {
    expr = parseExpression(content, {
      ...pos,
      ...(filename !== undefined ? { sourceFilename: filename } : {}),
      errorRecovery: true,
    });
  } catch (err: unknown) {
    const e = err as { message?: string; loc?: { index?: number } };
    diagnostics.push({
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <listeners>: ${e.message ?? 'parse failed'}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
    return { node: null, diagnostics };
  }

  const recoverableErrors =
    (expr as unknown as { errors?: Array<{ loc?: { index?: number }; message?: string }> }).errors ?? [];
  for (const e of recoverableErrors) {
    diagnostics.push({
      code: RozieErrorCode.INVALID_DECLARATIVE_EXPRESSION,
      severity: 'error',
      message: `Invalid JS expression in <listeners>: ${e.message ?? ''}`,
      loc: { start: e.loc?.index ?? contentLoc.start, end: e.loc?.index ?? contentLoc.start },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  if (expr.type !== 'ObjectExpression') {
    diagnostics.push({
      code: RozieErrorCode.NOT_OBJECT_LITERAL,
      severity: 'error',
      message: `<listeners> must be a JS object literal — found ${expr.type}.`,
      loc: babelLocToRozieLoc(expr),
      ...(filename !== undefined ? { filename } : {}),
      hint: 'Wrap your listener declarations in `{ ... }`.',
    });
    return { node: null, diagnostics };
  }

  const entries: ListenerEntry[] = [];
  for (const prop of (expr as ObjectExpression).properties) {
    if (prop.type !== 'ObjectProperty') {
      diagnostics.push({
        code: RozieErrorCode.LISTENER_VALUE_NOT_OBJECT,
        severity: 'error',
        message: '<listeners> may only contain key:value object properties (no spreads or methods).',
        loc: babelLocToRozieLoc(prop),
        ...(filename !== undefined ? { filename } : {}),
      });
      continue;
    }
    const objProp = prop as ObjectProperty;
    if (objProp.key.type !== 'StringLiteral') {
      diagnostics.push({
        code: RozieErrorCode.LISTENER_KEY_NOT_STRING,
        severity: 'error',
        message: '<listeners> keys must be string literals like "document:click.outside($refs.x)".',
        loc: babelLocToRozieLoc(objProp.key),
        ...(filename !== undefined ? { filename } : {}),
        hint: 'Wrap the key in double quotes.',
      });
      continue;
    }
    const keyNode = objProp.key as StringLiteral;
    const rawKey = keyNode.value;
    // Babel's StringLiteral loc INCLUDES the surrounding quotes (the "..."
    // delimiters). The raw key text starts at +1 byte (after the opening
    // quote) and ends at -1 byte (before the closing quote).
    const keyLoc = babelLocToRozieLoc(keyNode);
    const rawKeyLoc: SourceLoc = { start: keyLoc.start + 1, end: keyLoc.end - 1 };

    // Split target:event from modifier-chain text.
    // First '.' separates the (target:)?event prefix from the modifier chain.
    const dotIdx = rawKey.indexOf('.');
    const targetEvent = dotIdx >= 0 ? rawKey.slice(0, dotIdx) : rawKey;
    const modifierChainText = dotIdx >= 0 ? rawKey.slice(dotIdx) : '';
    const colonIdx = targetEvent.indexOf(':');
    const target = colonIdx >= 0 ? targetEvent.slice(0, colonIdx) : '$el';
    const event = colonIdx >= 0 ? targetEvent.slice(colonIdx + 1) : targetEvent;

    // Absolute byte offset of the modifier-chain text in the .rozie file.
    // When no modifiers are present, point past the end of rawKey (right
    // after the last byte of the key text).
    const modifierChainBaseOffset =
      dotIdx >= 0 ? rawKeyLoc.start + dotIdx : rawKeyLoc.end;

    entries.push({
      rawKey,
      rawKeyLoc,
      target,
      event,
      modifierChainText,
      modifierChainBaseOffset,
      // chain is populated by buildRozieAST (Plan 04 / D-15 stage 2). Empty
      // array at construction so the field is always present.
      chain: [],
      value: objProp.value as Expression,
      loc: babelLocToRozieLoc(prop),
    });
  }

  return {
    node: {
      type: 'ListenersAST',
      loc: contentLoc,
      entries,
    },
    diagnostics,
  };
}
