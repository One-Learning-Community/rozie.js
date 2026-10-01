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
import type { EmitCallSite } from '../../semantic/walkEmitCalls.js';

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

/**
 * Names whose `<emits>` entry was malformed (ROZ021) — a `$emit` of such a
 * name is NOT also an undeclared-event error — and names whose payload type
 * failed to parse (ROZ022), whose call arity is therefore not checked.
 * Filled by {@link lowerEmitsBlock}; read by {@link validateEmitCompleteness}.
 *
 * @experimental — added in typed-surface P1 (final fix wave L1)
 */
export interface EmitsLoweringNotes {
  malformed: Set<string>;
  invalidPayload: Set<string>;
}

export function lowerEmitsBlock(
  ast: EmitsAST | null,
  diagnostics: Diagnostic[],
  notes: EmitsLoweringNotes = { malformed: new Set(), invalidPayload: new Set() },
): EmitDecl[] | null {
  if (ast === null) return null;
  const decls: EmitDecl[] = [];
  const seen = new Set<string>();
  const bad = (node: t.Node, message: string) =>
    diagnostics.push({ code: RozieErrorCode.INVALID_EMIT_DECL, severity: 'error', message, loc: babelLocToRozieLoc(node) });
  for (const prop of ast.expression.properties) {
    if (!t.isObjectProperty(prop)) { bad(prop, '<emits> entries must be `name: { payload?, docs? }` — no spreads or methods.'); continue; }
    const name = keyName(prop);
    if (name === null) { bad(prop, '<emits> keys must be static names (identifier or string literal).'); continue; }
    if (seen.has(name)) {
      bad(prop.key, `Duplicate <emits> event \`${name}\` — each event is declared once; this later entry is ignored.`);
      continue;
    }
    seen.add(name);
    if (!t.isObjectExpression(prop.value)) {
      notes.malformed.add(name);
      bad(prop.value, `<emits> \`${name}\` must be an object: \`{}\` or \`{ payload: '<TS type>', docs: {...} }\`.`);
      continue;
    }
    let payload: t.TSType | null = null;
    let docs: PropDocs | null = null;
    const seenSub = new Set<string>();
    for (const inner of prop.value.properties) {
      const k = t.isObjectProperty(inner) ? keyName(inner) : null;
      if (!t.isObjectProperty(inner) || k === null) { bad(inner, `<emits> \`${name}\` accepts only \`payload\` and \`docs\` keys.`); continue; }
      if ((k === 'payload' || k === 'docs') && seenSub.has(k)) {
        bad(inner.key, `<emits> \`${name}\` declares \`${k}\` more than once; only the first is used.`);
        continue;
      }
      seenSub.add(k);
      if (k === 'payload') {
        if (!t.isStringLiteral(inner.value)) {
          notes.invalidPayload.add(name);
          bad(inner.value, `<emits> \`${name}.payload\` must be a string literal holding one TypeScript type.`);
          continue;
        }
        const r = parseAuthoredType(inner.value.value);
        if ('error' in r) {
          notes.invalidPayload.add(name);
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

/**
 * ROZ151/ROZ152 — `<emits>` is the complete list (spec §3.2); ROZ157 — each
 * call's argument count matches the declared payload (final fix wave M6).
 * ROZ151 and ROZ157 are located at the offending `$emit` call (M7); a name in
 * `usedNames` without a located call site falls back to the `<emits>` block.
 */
export function validateEmitCompleteness(
  decls: EmitDecl[] | null,
  usedNames: ReadonlySet<string>,
  emitsLoc: SourceLoc | undefined,
  diagnostics: Diagnostic[],
  callSites: readonly EmitCallSite[] = [],
  notes: EmitsLoweringNotes = { malformed: new Set(), invalidPayload: new Set() },
): void {
  if (decls === null) return;
  const declared = new Map(decls.map((d) => [d.name, d] as const));
  const undeclared = (used: string, loc: SourceLoc) =>
    diagnostics.push({ code: RozieErrorCode.EMIT_UNDECLARED, severity: 'error',
      message: `\`$emit('${used}')\` names an event that <emits> does not declare. When <emits> is present it is the complete event list.`,
      loc, hint: `Add \`${used}: {}\` (or \`${used}: { payload: '<type>' }\`) to <emits>.` });
  const located = new Set<string>();
  for (const site of callSites) {
    located.add(site.name);
    if (notes.malformed.has(site.name)) continue;
    const decl = declared.get(site.name);
    if (decl === undefined) {
      undeclared(site.name, site.loc);
      continue;
    }
    if (site.hasSpread || notes.invalidPayload.has(site.name)) continue;
    const message =
      decl.payload === null && site.argCount > 0
        ? `\`$emit('${site.name}')\` passes ${site.argCount} argument${site.argCount === 1 ? '' : 's'}, but <emits> declares \`${site.name}\` with no payload.`
        : decl.payload !== null && site.argCount === 0
          ? `\`$emit('${site.name}')\` passes no payload, but <emits> declares one for \`${site.name}\`.`
          : decl.payload !== null && site.argCount > 1
            ? `\`$emit('${site.name}')\` passes ${site.argCount} arguments, but an event carries exactly one payload.`
            : null;
    if (message !== null) {
      diagnostics.push({ code: RozieErrorCode.EMIT_PAYLOAD_ARITY, severity: 'warning', message, loc: site.loc,
        hint: decl.payload === null
          ? `Declare a payload (\`${site.name}: { payload: '<type>' }\`) or drop the argument.`
          : 'Pass exactly one payload argument (wrap several values in an object).' });
    }
  }
  for (const used of usedNames) {
    if (located.has(used) || declared.has(used) || notes.malformed.has(used)) continue;
    undeclared(used, emitsLoc ?? { start: 0, end: 0 });
  }
  for (const d of decls) {
    if (usedNames.has(d.name)) continue;
    diagnostics.push({ code: RozieErrorCode.EMIT_DECLARED_UNUSED, severity: 'warning',
      message: `<emits> declares \`${d.name}\` but nothing ever emits it.`, loc: d.sourceLoc });
  }
}
