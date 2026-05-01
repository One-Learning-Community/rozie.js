/**
 * Collect declarations from a `<props>` block into the BindingsTable.
 *
 * Walks `props.expression.properties` (Babel ObjectProperty[]). For each
 * property, extracts:
 *   - name (Identifier or StringLiteral key)
 *   - typeIdentifier (the value of the inner `type` field, if it's an
 *     Identifier)
 *   - defaultExpression (the inner `default` field, if any)
 *   - isModel (true iff inner `model: true` BooleanLiteral pair)
 *
 * **PROTOTYPE-POLLUTION GUARD (T-2-01-01):** entries whose key matches
 * `__proto__` / `constructor` / `prototype` are SKIPPED — never added to
 * `bindings.props`. Map<string, ...> is already safe at the storage layer,
 * but downstream consumers may iterate keys via `Object.fromEntries(map)`
 * for snapshots; this guard keeps those snapshots clean too.
 *
 * Per D-08 collected-not-thrown: this function NEVER throws. Malformed
 * properties (computed keys, spreads, getters) are silently skipped —
 * Plan 02 validators are responsible for emitting diagnostics on bad
 * shapes; Plan 02-01 collectors are silent.
 */
import * as t from '@babel/types';
import type { PropsAST } from '../../ast/blocks/PropsAST.js';
import type { BindingsTable, PropDeclEntry } from '../types.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function getPropertyKeyName(prop: t.ObjectProperty): string | null {
  if (prop.computed) return null;
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

function findInnerProperty(obj: t.ObjectExpression, fieldName: string): t.ObjectProperty | null {
  for (const member of obj.properties) {
    if (!t.isObjectProperty(member)) continue;
    if (member.computed) continue;
    if (t.isIdentifier(member.key) && member.key.name === fieldName) return member;
    if (t.isStringLiteral(member.key) && member.key.value === fieldName) return member;
  }
  return null;
}

export function collectPropDecls(props: PropsAST, bindings: BindingsTable): void {
  for (const prop of props.expression.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const name = getPropertyKeyName(prop);
    if (!name) continue;
    // T-2-01-01 prototype-pollution guard.
    if (FORBIDDEN_KEYS.has(name)) continue;

    const value = prop.value;
    let typeIdentifier: string | null = null;
    let defaultExpression: t.Expression | null = null;
    let isModel = false;

    if (t.isObjectExpression(value)) {
      const typeProp = findInnerProperty(value, 'type');
      if (typeProp && t.isIdentifier(typeProp.value)) {
        typeIdentifier = typeProp.value.name;
      }
      const defaultProp = findInnerProperty(value, 'default');
      if (defaultProp && t.isExpression(defaultProp.value)) {
        defaultExpression = defaultProp.value;
      }
      const modelProp = findInnerProperty(value, 'model');
      if (
        modelProp &&
        t.isBooleanLiteral(modelProp.value) &&
        modelProp.value.value === true
      ) {
        isModel = true;
      }
    }

    const entry: PropDeclEntry = {
      name,
      decl: prop,
      typeIdentifier,
      defaultExpression,
      isModel,
      sourceLoc: { start: prop.start ?? 0, end: prop.end ?? 0 },
    };
    bindings.props.set(name, entry);
  }
}
