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
import type { PropDecl, PropDocs, PropTypeAnnotation } from '../types.js';

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

/** The allowed `docs:` sub-keys. Any other key is malformed (ROZ018). */
const ALLOWED_DOCS_KEYS = new Set(['description', 'deprecated', 'example']);

/**
 * Build a typed `PropDocs` from a prop's `docs:` options value (Phase 58 SC-1).
 *
 * Modeled on `findRequiredFlag` — walks `entry.decl.value`'s ObjectProperties
 * for a `docs:` key. The raw options node NEVER escapes this seam: only the
 * returned typed `PropDocs` reaches `PropDecl.docs`, keeping `docs` inert by
 * construction (SC-6 — no emitter can serialize the raw options object).
 *
 * Shape contract: `docs: { description?: string, deprecated?: true | string,
 * example?: string }`. A malformed shape degrades gracefully:
 *   - `docs` not an ObjectExpression  → ROZ018, return null (whole docs dropped)
 *   - `description`/`example` non-string → ROZ018, drop THAT sub-key
 *   - `deprecated` neither boolean-`true` nor string → ROZ018, drop THAT sub-key
 *   - any unknown sub-key             → ROZ018, drop THAT sub-key
 * Per D-08 the diagnostics are COLLECTED, never thrown — a bad `docs` can never
 * block the compile (T-58-02). Returns null when no usable sub-key survives, so
 * an empty/all-malformed docs lowers to `PropDecl.docs === undefined`.
 */
function findPropDocs(entry: PropDeclEntry, diagnostics: Diagnostic[]): PropDocs | null {
  const decl = entry.decl;
  if (!t.isObjectExpression(decl.value)) return null;

  let docsValue: t.Node | null = null;
  for (const prop of decl.value.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) continue;
    const key = prop.key;
    const keyName =
      t.isIdentifier(key) ? key.name :
      t.isStringLiteral(key) ? key.value :
      null;
    if (keyName !== 'docs') continue;
    docsValue = prop.value;
    break;
  }
  if (docsValue === null) return null; // no docs key — the inert control path (Test D)

  if (!t.isObjectExpression(docsValue)) {
    // `docs: 42` / `docs: 'x'` etc. — not an object literal (Test C).
    diagnostics.push({
      code: RozieErrorCode.INVALID_PROP_DOCS_SHAPE,
      severity: 'warning',
      message: `Prop '${entry.name}' has a malformed 'docs:' value — it must be an object literal of the form { description?: string, deprecated?: true | string, example?: string }. The docs have been dropped (no JSDoc will be emitted).`,
      loc: entry.sourceLoc,
      hint: "Use docs: { description: '...', deprecated: true | '...', example: '...' }.",
    });
    return null;
  }

  const docs: PropDocs = {};
  for (const member of docsValue.properties) {
    if (!t.isObjectProperty(member) || member.computed) {
      diagnostics.push({
        code: RozieErrorCode.INVALID_PROP_DOCS_SHAPE,
        severity: 'warning',
        message: `Prop '${entry.name}' has a malformed 'docs:' entry (a spread, computed key, or method) — it has been dropped.`,
        loc: entry.sourceLoc,
        hint: "Allowed docs sub-keys: description (string), deprecated (true | string), example (string).",
      });
      continue;
    }
    const key = member.key;
    const keyName =
      t.isIdentifier(key) ? key.name :
      t.isStringLiteral(key) ? key.value :
      null;
    if (keyName === null || !ALLOWED_DOCS_KEYS.has(keyName)) {
      diagnostics.push({
        code: RozieErrorCode.INVALID_PROP_DOCS_SHAPE,
        severity: 'warning',
        message: `Prop '${entry.name}' has an unknown 'docs:' sub-key '${keyName ?? '<computed>'}' — it has been dropped. Allowed sub-keys: description, deprecated, example.`,
        loc: entry.sourceLoc,
        hint: "Allowed docs sub-keys: description (string), deprecated (true | string), example (string).",
      });
      continue;
    }
    const v = member.value;
    if (keyName === 'description' || keyName === 'example') {
      if (t.isStringLiteral(v)) {
        docs[keyName] = v.value;
      } else {
        diagnostics.push({
          code: RozieErrorCode.INVALID_PROP_DOCS_SHAPE,
          severity: 'warning',
          message: `Prop '${entry.name}' has a non-string 'docs.${keyName}' — it must be a string literal. The '${keyName}' sub-key has been dropped.`,
          loc: entry.sourceLoc,
          hint: `Use docs: { ${keyName}: '...' }.`,
        });
      }
    } else {
      // keyName === 'deprecated': true → bare @deprecated; string → @deprecated <msg>.
      if (t.isBooleanLiteral(v) && v.value === true) {
        docs.deprecated = true;
      } else if (t.isStringLiteral(v)) {
        docs.deprecated = v.value;
      } else {
        diagnostics.push({
          code: RozieErrorCode.INVALID_PROP_DOCS_SHAPE,
          severity: 'warning',
          message: `Prop '${entry.name}' has a malformed 'docs.deprecated' — it must be the boolean 'true' or a string message. The 'deprecated' sub-key has been dropped.`,
          loc: entry.sourceLoc,
          hint: "Use docs: { deprecated: true } or docs: { deprecated: 'Use X instead.' }.",
        });
      }
    }
  }

  // Attach only when at least one sub-key survived — keeps the typed field
  // absent (PropDecl.docs === undefined) for an empty / all-malformed docs.
  return Object.keys(docs).length > 0 ? docs : null;
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
    // Phase 58 (SC-1): lower the prop's `docs:` to the typed PropDocs field.
    // null → omit the field entirely (PropDecl.docs === undefined). Malformed
    // shapes emit ROZ018 (collected) inside findPropDocs and are dropped.
    const docs = findPropDocs(entry, diagnostics);
    out.push({
      type: 'PropDecl',
      name: entry.name,
      typeAnnotation: inferTypeAnnotation(typeExpr),
      defaultValue,
      isModel: entry.isModel,
      required,
      ...(docs !== null ? { docs } : {}),
      sourceLoc: entry.sourceLoc,
    });
  }
  return out;
}
