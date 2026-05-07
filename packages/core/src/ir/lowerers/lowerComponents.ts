/**
 * lowerComponents — Phase 06.2 P1 Task 2.
 *
 * Lowers a parsed ComponentsAST into a `Map<string, ComponentDecl>`. The Map
 * preserves insertion (source) order per D-129, which lets downstream
 * emitters synthesize `import` statements deterministically.
 *
 * Validation:
 *   - Non-Identifier keys (e.g., computed, numeric) — silently skipped at
 *     this layer (Task 4 may layer a code on top if needed).
 *   - Non-PascalCase keys — silently skipped at this layer (Task 4 lands
 *     ROZ922 LOWERCASE_LIKELY_TYPO at the template lookup side instead).
 *   - Non-StringLiteral values — already filtered by parseComponents
 *     (ROZ921 in Task 4 / ROZ011 placeholder in Task 1).
 *   - Duplicate keys — Babel parses the last as the surviving ObjectProperty;
 *     the Map.set semantic naturally drops the earlier one.
 *
 * D-08 collected-not-thrown: never throws on user input; pushes diagnostics.
 *
 * @experimental — shape may change before v1.0
 */
import type { ComponentsAST } from '../../ast/blocks/ComponentsAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { ComponentDecl } from '../types.js';
import { babelLocToRozieLoc } from '../../parsers/parserPosition.js';
import { isPascalCase } from '../utils/isPascalCase.js';

export function lowerComponents(
  ast: ComponentsAST | null,
  diagnostics: Diagnostic[],
): Map<string, ComponentDecl> {
  // diagnostics is intentionally unused in Task 2 (Task 4 layers on ROZ923 etc.).
  void diagnostics;
  const out = new Map<string, ComponentDecl>();
  if (!ast) return out;

  for (const prop of ast.expression.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    if (prop.computed) continue;
    const key = prop.key;
    const value = prop.value;
    let keyName: string | null = null;
    if (key.type === 'Identifier') {
      keyName = key.name;
    } else if (key.type === 'StringLiteral') {
      keyName = key.value;
    } else {
      continue;
    }
    if (!isPascalCase(keyName)) {
      // Task 4 may emit a structural diagnostic; Task 2 silently skips so the
      // Map only contains valid PascalCase entries.
      continue;
    }
    if (value.type !== 'StringLiteral') {
      // Already covered by parseComponents (ROZ011/ROZ921). Skip silently here.
      continue;
    }
    const decl: ComponentDecl = {
      type: 'ComponentDecl',
      localName: keyName,
      importPath: value.value,
      sourceLoc: babelLocToRozieLoc(prop),
    };
    out.set(keyName, decl);
  }
  return out;
}
