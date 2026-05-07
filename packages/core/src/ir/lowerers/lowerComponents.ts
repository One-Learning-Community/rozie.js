/**
 * lowerComponents — Phase 06.2 P1 Task 2 + Task 4.
 *
 * Lowers a parsed ComponentsAST into a `Map<string, ComponentDecl>`. The Map
 * preserves insertion (source) order per D-129, which lets downstream
 * emitters synthesize `import` statements deterministically.
 *
 * Validation:
 *   - Non-Identifier keys (computed/numeric) — silently skipped here.
 *   - Non-PascalCase keys — silently skipped (Task 4's ROZ922 covers the
 *     template-side lowercase-typo case at lookup time).
 *   - Non-StringLiteral values — already filtered by parseComponents (ROZ921).
 *   - Duplicate keys — Babel keeps the last ObjectProperty; Map.set semantics
 *     naturally drop earlier duplicates.
 *
 * Task 4: emit ROZ923 DUPLICATE_COMPONENT_IMPORT_PATH (warning) once per
 * group of `<components>` entries that point at the same `.rozie` path.
 *
 * D-08 collected-not-thrown: never throws; pushes diagnostics.
 *
 * @experimental — shape may change before v1.0
 */
import type { ComponentsAST } from '../../ast/blocks/ComponentsAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { ComponentDecl } from '../types.js';
import { babelLocToRozieLoc } from '../../parsers/parserPosition.js';
import { isPascalCase } from '../utils/isPascalCase.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export function lowerComponents(
  ast: ComponentsAST | null,
  diagnostics: Diagnostic[],
): Map<string, ComponentDecl> {
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
      // Silent skip — Task 4's ROZ922 covers the template-side lowercase typo.
      continue;
    }
    if (value.type !== 'StringLiteral') {
      // Already filtered by parseComponents (ROZ921).
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

  // Task 4 — ROZ923: warn when two declared entries share the same import path.
  // Group entries by importPath; emit once per group with size > 1.
  const byPath = new Map<string, ComponentDecl[]>();
  for (const decl of out.values()) {
    const list = byPath.get(decl.importPath);
    if (list) {
      list.push(decl);
    } else {
      byPath.set(decl.importPath, [decl]);
    }
  }
  for (const [importPath, group] of byPath) {
    if (group.length <= 1) continue;
    const names = group.map((d) => d.localName);
    diagnostics.push({
      code: RozieErrorCode.DUPLICATE_COMPONENT_IMPORT_PATH,
      severity: 'warning',
      message: `<components> entries ${names.map((n) => `'${n}'`).join(', ')} all point at '${importPath}'.`,
      // Anchor on the first declaration; the related field could carry the rest.
      loc: group[0]!.sourceLoc,
      hint: 'Duplicate import paths emit redundant target-framework imports — consider declaring the alias once.',
    });
  }

  return out;
}
