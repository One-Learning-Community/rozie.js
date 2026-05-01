/**
 * Collect declarations from a `<data>` block into the BindingsTable.
 *
 * Walks `data.expression.properties` (Babel ObjectProperty[]). For each
 * property, captures:
 *   - name
 *   - initializer (the `value` AST node)
 *   - sourceLoc
 *
 * Same prototype-pollution guard as collectPropDecls (T-2-01-01).
 *
 * Per D-08 collected-not-thrown: this function NEVER throws.
 */
import * as t from '@babel/types';
import type { DataAST } from '../../ast/blocks/DataAST.js';
import type { BindingsTable, DataDeclEntry } from '../types.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function getPropertyKeyName(prop: t.ObjectProperty): string | null {
  if (prop.computed) return null;
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

export function collectDataDecls(data: DataAST, bindings: BindingsTable): void {
  for (const prop of data.expression.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const name = getPropertyKeyName(prop);
    if (!name) continue;
    if (FORBIDDEN_KEYS.has(name)) continue;
    if (!t.isExpression(prop.value)) continue;

    const entry: DataDeclEntry = {
      name,
      decl: prop,
      initializer: prop.value,
      sourceLoc: { start: prop.start ?? 0, end: prop.end ?? 0 },
    };
    bindings.data.set(name, entry);
  }
}
