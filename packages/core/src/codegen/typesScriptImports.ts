/**
 * typesScriptImports — typed public surface P1 (R16). The ONE place that
 * reconciles `<types>` imports with `<script>` imports.
 *
 * Every target hoists the `<types>` block into the SAME module scope as the
 * component's `<script>` imports (React/Solid/Lit/Angular: one module; Vue's
 * module `<script>` + `<script setup>` and Svelte's `<script module>` + instance
 * script compile to one module too). So `import type { X } from 'm'` in
 * `<types>` next to `import { X } from 'm'` in `<script>` is TS2300 "Duplicate
 * identifier" — yet authors must write the type import, because `<script>`
 * names are not in scope for authored type strings.
 *
 *   - same LOCAL name, same source, same imported binding ⇒ the `<types>`
 *     specifier is a duplicate: the script import already provides the type
 *     (a class/value import is also a type), so the module placement drops it
 *     (and drops the whole declaration when nothing is left);
 *   - same LOCAL name, different source or imported binding ⇒ a real conflict
 *     (ROZ024, reported at lowering).
 *
 * The sidecar `.d.ts` / manifest renders have no script imports and keep the
 * `<types>` imports verbatim. A component without `<types>` is untouched.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';

type Spec = t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier;

/** `default`, `*`, or the imported name — the binding identity within a source. */
function importedKey(s: Spec): string {
  if (t.isImportDefaultSpecifier(s)) return 'default';
  if (t.isImportNamespaceSpecifier(s)) return '*';
  return t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
}

/** @experimental */
export interface TypesScriptImportConflict {
  /** The `<types>` specifier whose local name is already bound by `<script>`. */
  specifier: Spec;
  local: string;
  typesSource: string;
  scriptSource: string;
  scriptImported: string;
}

/** @experimental */
export interface TypesScriptImportAnalysis {
  /** `<types>` specifiers duplicated by an identical `<script>` import. */
  duplicates: Set<Spec>;
  conflicts: TypesScriptImportConflict[];
}

/** @experimental */
export function analyzeTypesScriptImports(
  typesStatements: readonly t.Statement[],
  scriptBody: readonly t.Statement[] | null | undefined,
): TypesScriptImportAnalysis {
  const duplicates = new Set<Spec>();
  const conflicts: TypesScriptImportConflict[] = [];
  if (!scriptBody || scriptBody.length === 0) return { duplicates, conflicts };
  const scriptLocals = new Map<string, { source: string; imported: string }>();
  for (const s of scriptBody) {
    if (!t.isImportDeclaration(s)) continue;
    for (const sp of s.specifiers) {
      scriptLocals.set(sp.local.name, { source: s.source.value, imported: importedKey(sp) });
    }
  }
  if (scriptLocals.size === 0) return { duplicates, conflicts };
  for (const s of typesStatements) {
    if (!t.isImportDeclaration(s)) continue;
    for (const sp of s.specifiers) {
      const hit = scriptLocals.get(sp.local.name);
      if (!hit) continue;
      if (hit.source === s.source.value && hit.imported === importedKey(sp)) {
        duplicates.add(sp);
      } else {
        conflicts.push({
          specifier: sp,
          local: sp.local.name,
          typesSource: s.source.value,
          scriptSource: hit.source,
          scriptImported: hit.imported,
        });
      }
    }
  }
  return { duplicates, conflicts };
}

/**
 * The `<types>` statements as they belong in the component MODULE: duplicated
 * import specifiers removed (an emptied import declaration is removed whole).
 * Returns the input array unchanged when nothing is duplicated.
 *
 * @experimental
 */
export function typesStatementsForModule(
  typesStatements: readonly t.Statement[],
  scriptBody: readonly t.Statement[] | null | undefined,
): readonly t.Statement[] {
  const { duplicates } = analyzeTypesScriptImports(typesStatements, scriptBody);
  if (duplicates.size === 0) return typesStatements;
  const out: t.Statement[] = [];
  // Leading comments of a declaration that is dropped WHOLE (e.g. a block
  // header comment above the first import) move to the next statement.
  let carried: t.Comment[] = [];
  const withCarried = (s: t.Statement): t.Statement => {
    if (carried.length === 0) return s;
    const own = s.leadingComments ?? [];
    const merged = [...carried.filter((c) => !own.includes(c)), ...own];
    carried = [];
    return { ...s, leadingComments: merged };
  };
  // A dropped local is no longer bound by `<types>`; a local re-export of it
  // (`export type { X }`) becomes a re-export FROM its source, so it needs no
  // binding at all. (Vue's compiler-sfc requires a module-`<script>` export to
  // name a binding declared IN that script — the setup import does not count.)
  const droppedFrom = new Map<string, { source: string; imported: string; sourceNode: t.StringLiteral }>();
  for (const s of typesStatements) {
    if (!t.isImportDeclaration(s)) continue;
    for (const sp of s.specifiers) {
      if (duplicates.has(sp)) droppedFrom.set(sp.local.name, { source: s.source.value, imported: importedKey(sp), sourceNode: s.source });
    }
  }
  for (const s of typesStatements) {
    if (
      t.isExportNamedDeclaration(s) &&
      s.source == null &&
      s.declaration == null &&
      s.specifiers.some((sp) => t.isExportSpecifier(sp) && droppedFrom.has(sp.local.name))
    ) {
      const keep: t.ExportNamedDeclaration['specifiers'] = [];
      const bySource = new Map<string, { node: t.StringLiteral; specs: t.ExportSpecifier[] }>();
      for (const sp of s.specifiers) {
        const from = t.isExportSpecifier(sp) ? droppedFrom.get(sp.local.name) : undefined;
        if (!from || from.imported === '*') {
          keep.push(sp);
          continue;
        }
        const entry = bySource.get(from.source) ?? { node: from.sourceNode, specs: [] };
        entry.specs.push(t.exportSpecifier(t.identifier(from.imported), sp.exported));
        bySource.set(from.source, entry);
      }
      let first = true;
      const emitDecl = (d: t.ExportNamedDeclaration): void => {
        d.exportKind = 'type';
        // `export type { type A }` is TS2207 — the declaration-level `type`
        // already covers every specifier, so drop an inline modifier.
        d.specifiers = d.specifiers.map((sp) =>
          t.isExportSpecifier(sp) && sp.exportKind === 'type' ? { ...sp, exportKind: 'value' } : sp,
        );
        out.push(first ? withCarried({ ...d, leadingComments: s.leadingComments ?? null } as t.Statement) : d);
        first = false;
      };
      if (keep.length > 0) emitDecl(t.exportNamedDeclaration(null, keep));
      for (const { node, specs } of bySource.values()) {
        // Reuse the import's source literal so its quote style is kept.
        emitDecl(t.exportNamedDeclaration(null, specs, { ...node, leadingComments: null, trailingComments: null }));
      }
      continue;
    }
    if (!t.isImportDeclaration(s) || !s.specifiers.some((sp) => duplicates.has(sp))) {
      out.push(withCarried(s));
      continue;
    }
    const kept = s.specifiers.filter((sp) => !duplicates.has(sp));
    if (kept.length > 0) {
      out.push(withCarried({ ...s, specifiers: kept }));
    } else {
      carried = [...carried, ...(s.leadingComments ?? [])];
    }
  }
  return out;
}
