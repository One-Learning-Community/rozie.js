/**
 * lowerProps — convert PropsAST + BindingsTable to PropDecl[].
 *
 * Plan 02-05 Task 2.
 *
 * Iterates `bindings.props` (already collected by Plan 02-01 collectPropDecls)
 * and produces typed PropDecl entries. The PropTypeAnnotation is derived from
 * the prop's `type:` field — single identifiers (`Number`) lower to
 * { kind: 'identifier', name: 'Number' }; arrays of identifiers like
 * `[Number, String]` lower to a union annotation.
 *
 * Per D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { PropsAST } from '../../ast/blocks/PropsAST.js';
import type { BindingsTable, PropDeclEntry } from '../../semantic/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { PropDecl, PropTypeAnnotation } from '../types.js';

/**
 * Build a PropTypeAnnotation from a Babel Expression (the `type:` value).
 *
 * Recognized shapes:
 *   - Identifier: Number / String / Boolean / Array / Object / Function → kind 'identifier'
 *   - ArrayExpression: [Number, String] → kind 'union' with member identifiers
 *   - Anything else → kind 'identifier', name 'unknown' (defensive default)
 */
function inferTypeAnnotation(typeExpr: t.Expression | null): PropTypeAnnotation {
  if (!typeExpr) {
    return { kind: 'identifier', name: 'unknown' };
  }
  if (t.isIdentifier(typeExpr)) {
    return { kind: 'identifier', name: typeExpr.name };
  }
  if (t.isArrayExpression(typeExpr)) {
    const members: PropTypeAnnotation[] = [];
    for (const el of typeExpr.elements) {
      if (el && t.isIdentifier(el)) {
        members.push({ kind: 'identifier', name: el.name });
      }
    }
    return members.length > 0
      ? { kind: 'union', members }
      : { kind: 'identifier', name: 'unknown' };
  }
  return { kind: 'identifier', name: 'unknown' };
}

/**
 * Find the `type:` Expression on a prop's options ObjectExpression.
 *
 * Walks the ObjectProperties of a prop entry's `decl.value` (which is itself an
 * ObjectExpression like `{ type: Number, default: 0, model: true }`).
 */
function findTypeExpression(entry: PropDeclEntry): t.Expression | null {
  const decl = entry.decl;
  if (!t.isObjectExpression(decl.value)) return null;
  for (const prop of decl.value.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.key;
    const keyName =
      t.isIdentifier(key) ? key.name :
      t.isStringLiteral(key) ? key.value :
      null;
    if (keyName !== 'type') continue;
    if (t.isExpression(prop.value)) return prop.value;
  }
  return null;
}

/**
 * Read the `required:` flag off a prop's options ObjectExpression.
 *
 * Modeled on `findTypeExpression` — walks `entry.decl.value`'s
 * ObjectProperties. Returns `true` ONLY when a `required:` key carries a
 * literal boolean `true`. An absent key, `required: false`, or any
 * non-boolean value (`required: 0`, `required: someIdent`) all yield `false`.
 */
function findRequiredFlag(entry: PropDeclEntry): boolean {
  const decl = entry.decl;
  if (!t.isObjectExpression(decl.value)) return false;
  for (const prop of decl.value.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.key;
    const keyName =
      t.isIdentifier(key) ? key.name :
      t.isStringLiteral(key) ? key.value :
      null;
    if (keyName !== 'required') continue;
    return t.isBooleanLiteral(prop.value) && prop.value.value;
  }
  return false;
}

export function lowerProps(
  _propsAst: PropsAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): PropDecl[] {
  const out: PropDecl[] = [];
  for (const entry of bindings.props.values()) {
    const typeExpr = findTypeExpression(entry);
    const required = findRequiredFlag(entry);
    // `required` is the sole determinant of requiredness; a `required: true`
    // prop that ALSO carries a `default:` is incoherent — the default can
    // never fire — so drop it and emit a ROZ014 warning.
    let defaultValue = entry.defaultExpression;
    if (required && defaultValue !== null) {
      diagnostics.push({
        code: RozieErrorCode.REQUIRED_PROP_HAS_DEFAULT,
        severity: 'warning',
        message: `Prop '${entry.name}' is declared 'required: true' but also has a 'default:' — the default can never fire on a required prop and has been dropped.`,
        loc: entry.sourceLoc,
        hint: "Remove either 'required: true' or the 'default:' value. A prop with a default is optional; a required prop is always passed by the consumer.",
      });
      defaultValue = null;
    }
    out.push({
      type: 'PropDecl',
      name: entry.name,
      typeAnnotation: inferTypeAnnotation(typeExpr),
      defaultValue,
      isModel: entry.isModel,
      required,
      sourceLoc: entry.sourceLoc,
    });
  }
  return out;
}
