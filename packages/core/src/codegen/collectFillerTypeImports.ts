/**
 * Producer-`<types>` names referenced by a consumer fill's threaded
 * `:param-types` (`filler.paramTypeImports`).
 *
 * A composed child's slot may declare `:param-types="{ group: 'ComboboxGroup' }"`
 * where `ComboboxGroup` lives in the CHILD's `<types>` block. `threadParamTypes`
 * copies that TSType onto the consumer's `SlotFillerDecl.paramTypes`; any target
 * that PRINTS it into consumer code (today: Lit's `(scope: { group: … })`
 * filler annotation) must also bring the name into scope. These helpers compute
 * which names need importing and from which child module.
 *
 * @experimental — shape may change before v1.0
 */
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { IRComponent, TemplateNode } from '../ir/types.js';

/**
 * Exported names of a `<types>` block given as SOURCE TEXT (the
 * `rozie-manifest.json` `types` field). Unparseable text ⇒ `[]` (silent
 * degrade — the consumer simply gets no extra import).
 */
export function exportedTypeNamesFromSource(source: string): string[] {
  let program: t.Program;
  try {
    program = babelParse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
    }).program;
  } catch {
    return [];
  }
  const names: string[] = [];
  for (const stmt of program.body) {
    if (!t.isExportNamedDeclaration(stmt)) continue;
    const decl = stmt.declaration;
    if (decl && 'id' in decl && decl.id && t.isIdentifier(decl.id)) {
      names.push(decl.id.name);
    }
    for (const spec of stmt.specifiers) {
      if (t.isExportSpecifier(spec)) {
        names.push(t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value);
      }
    }
  }
  return names;
}

/**
 * Root identifiers of every type reference inside `types`, filtered to
 * `candidates`, in first-seen order. `A.B` contributes `A`.
 */
export function referencedTypeNames(
  types: readonly t.TSType[],
  candidates: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string): void => {
    if (!candidates.has(name) || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  for (const ty of types) {
    t.traverseFast(ty, (n) => {
      let ref: t.TSEntityName | null = null;
      if (t.isTSTypeReference(n)) ref = n.typeName;
      else if (t.isTSExpressionWithTypeArguments(n) && t.isTSEntityName(n.expression)) ref = n.expression;
      else if (t.isTSTypeQuery(n) && t.isTSEntityName(n.exprName)) ref = n.exprName;
      if (ref === null) return;
      while (t.isTSQualifiedName(ref)) ref = ref.left;
      if (t.isIdentifier(ref)) add(ref.name);
    });
  }
  return out;
}

function walk(node: TemplateNode | null, visit: (n: TemplateNode) => void): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const c of node.children) walk(c, visit);
      for (const f of node.slotFillers ?? []) for (const c of f.body) walk(c, visit);
      break;
    case 'TemplateConditional':
      for (const b of node.branches) for (const c of b.body) walk(c, visit);
      break;
    case 'TemplateLoop':
      for (const c of node.body) walk(c, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const c of node.fallback) walk(c, visit);
      break;
    case 'TemplateFragment':
      for (const c of node.children) walk(c, visit);
      break;
    default:
      break;
  }
}

/**
 * Group every component-tag fill's `paramTypeImports` by the child's AUTHORED
 * `<components>` import path, in template order. Names the consumer declares
 * itself (its own `<types>` exports or its own component name) are skipped —
 * importing them would collide. Empty map ⇒ nothing to import (the common
 * case; callers must stay byte-identical then).
 */
export function collectFillerTypeImports(ir: IRComponent): Map<string, string[]> {
  const own = new Set<string>([ir.name, ...(ir.types?.exportedNames ?? [])]);
  // Names the consumer already binds via its own `<script>` / `<types>`
  // imports — importing them again would be a duplicate identifier.
  const ownStatements: t.Statement[] = [
    ...(ir.setupBody?.scriptProgram?.program.body ?? []),
    ...(ir.types?.statements ?? []),
  ];
  for (const stmt of ownStatements) {
    if (!t.isImportDeclaration(stmt)) continue;
    for (const spec of stmt.specifiers) own.add(spec.local.name);
  }
  const byPath = new Map<string, string[]>();
  walk(ir.template, (n) => {
    if (n.type !== 'TemplateElement' || n.tagKind !== 'component') return;
    const path = n.componentRef?.importPath;
    if (path === undefined) return;
    for (const filler of n.slotFillers ?? []) {
      for (const name of filler.paramTypeImports ?? []) {
        if (own.has(name)) continue;
        const list = byPath.get(path) ?? [];
        if (!list.includes(name)) list.push(name);
        byPath.set(path, list);
      }
    }
  });
  return byPath;
}
