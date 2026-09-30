import * as t from '@babel/types';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { EmitDecl, PropDocs, TypesBlockIR } from '../types.js';
import type { SourceLoc } from '../../ast/types.js';
import type { TypesAST } from '../../ast/blocks/TypesAST.js';
import type { EmitsAST } from '../../ast/blocks/EmitsAST.js';
import { parseAuthoredType } from '../../codegen/renderAuthoredType.js';
import { parsePublicDocs } from './lowerProps.js';
import { babelLocToRozieLoc } from '../../parsers/parserPosition.js';

export function lowerTypesBlock(ast: TypesAST | null): TypesBlockIR | null {
  if (ast === null) return null;
  const exportedNames: string[] = [];
  for (const s of ast.program.body) {
    if (!t.isExportNamedDeclaration(s)) continue;
    if (s.declaration && (t.isTSInterfaceDeclaration(s.declaration) || t.isTSTypeAliasDeclaration(s.declaration))) {
      exportedNames.push(s.declaration.id.name);
    }
    for (const sp of s.specifiers) {
      if (t.isExportSpecifier(sp)) exportedNames.push(t.isIdentifier(sp.exported) ? sp.exported.name : sp.exported.value);
    }
  }
  return { statements: ast.program.body, exportedNames, sourceLoc: ast.loc };
}

function keyName(p: t.ObjectProperty): string | null {
  if (p.computed) return null;
  if (t.isIdentifier(p.key)) return p.key.name;
  if (t.isStringLiteral(p.key)) return p.key.value;
  return null;
}

export function lowerEmitsBlock(ast: EmitsAST | null, diagnostics: Diagnostic[]): EmitDecl[] | null {
  if (ast === null) return null;
  const decls: EmitDecl[] = [];
  const bad = (node: t.Node, message: string) =>
    diagnostics.push({ code: RozieErrorCode.INVALID_EMIT_DECL, severity: 'error', message, loc: babelLocToRozieLoc(node) });
  for (const prop of ast.expression.properties) {
    if (!t.isObjectProperty(prop)) { bad(prop, '<emits> entries must be `name: { payload?, docs? }` — no spreads or methods.'); continue; }
    const name = keyName(prop);
    if (name === null) { bad(prop, '<emits> keys must be static names (identifier or string literal).'); continue; }
    if (!t.isObjectExpression(prop.value)) { bad(prop.value, `<emits> \`${name}\` must be an object: \`{}\` or \`{ payload: '<TS type>', docs: {...} }\`.`); continue; }
    let payload: t.TSType | null = null;
    let docs: PropDocs | null = null;
    for (const inner of prop.value.properties) {
      const k = t.isObjectProperty(inner) ? keyName(inner) : null;
      if (!t.isObjectProperty(inner) || k === null) { bad(inner, `<emits> \`${name}\` accepts only \`payload\` and \`docs\` keys.`); continue; }
      if (k === 'payload') {
        if (!t.isStringLiteral(inner.value)) { bad(inner.value, `<emits> \`${name}.payload\` must be a string literal holding one TypeScript type.`); continue; }
        const r = parseAuthoredType(inner.value.value);
        if ('error' in r) {
          diagnostics.push({ code: RozieErrorCode.INVALID_AUTHORED_TYPE, severity: 'error',
            message: `<emits> \`${name}.payload\` is not a valid TypeScript type: ${r.error}`, loc: babelLocToRozieLoc(inner.value) });
          continue;
        }
        payload = r.type;
      } else if (k === 'docs') {
        docs = parsePublicDocs(inner.value as t.Expression, `<emits> \`${name}\``, babelLocToRozieLoc(inner), RozieErrorCode.INVALID_EMIT_DOCS_SHAPE, diagnostics);
      } else {
        bad(inner, `<emits> \`${name}\` has unknown key \`${k}\` — only \`payload\` and \`docs\` are allowed.`);
      }
    }
    decls.push({ name, payload, docs, sourceLoc: babelLocToRozieLoc(prop) });
  }
  return decls;
}

/** ROZ151/ROZ152 — `<emits>` is the complete list (spec §3.2). */
export function validateEmitCompleteness(
  decls: EmitDecl[] | null,
  usedNames: ReadonlySet<string>,
  emitsLoc: SourceLoc | undefined,
  diagnostics: Diagnostic[],
): void {
  if (decls === null) return;
  const declared = new Set(decls.map((d) => d.name));
  for (const used of usedNames) {
    if (declared.has(used)) continue;
    diagnostics.push({ code: RozieErrorCode.EMIT_UNDECLARED, severity: 'error',
      message: `\`$emit('${used}')\` names an event that <emits> does not declare. When <emits> is present it is the complete event list.`,
      loc: emitsLoc ?? { start: 0, end: 0 }, hint: `Add \`${used}: {}\` (or \`${used}: { payload: '<type>' }\`) to <emits>.` });
  }
  for (const d of decls) {
    if (usedNames.has(d.name)) continue;
    diagnostics.push({ code: RozieErrorCode.EMIT_DECLARED_UNUSED, severity: 'warning',
      message: `<emits> declares \`${d.name}\` but nothing ever emits it.`, loc: d.sourceLoc });
  }
}
