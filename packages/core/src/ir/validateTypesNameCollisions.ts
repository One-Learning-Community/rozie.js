/**
 * validateTypesNameCollisions — ROZ025 (typed public surface P1, final wave I3).
 *
 * Every target places the `<types>` block in the component module next to
 * names the compiler generates (`<Name>Props`, `<Name>Handle`, slot ctx
 * interfaces, …) and next to the top-level `<script>` declarations that share
 * the module scope (imports everywhere; lang="ts" type declarations and, on
 * Angular, classes are hoisted there). A same-named `<types>` binding used to
 * compile cleanly and then fail the leaf build with TS2300/TS2395/TS2440, or
 * silently merge into the published interface. Both are a located error here.
 *
 * The generated-name list comes from `reservedGeneratedTypeNames`, built on the
 * SAME name builders the emitters use — no second copy of the naming rules.
 * `<types>` vs `<script>` IMPORT pairs are ROZ024's (see typesScriptImports.ts)
 * and are skipped here.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { babelLocToRozieLoc } from '../parsers/parserPosition.js';
import { reservedGeneratedTypeNames } from '../codegen/generatedTypeNames.js';
import type { IRComponent } from './types.js';

type TypesKind = 'import' | 'interface' | 'type' | 'export';
type ScriptKind = 'import' | 'value' | 'class' | 'interface' | 'type' | 'enum';

interface TypesBinding {
  name: string;
  kind: TypesKind;
  node: t.Node;
}

function typesBindings(statements: readonly t.Statement[]): TypesBinding[] {
  const out: TypesBinding[] = [];
  const decl = (d: t.Node | null | undefined): void => {
    if (t.isTSInterfaceDeclaration(d)) out.push({ name: d.id.name, kind: 'interface', node: d.id });
    else if (t.isTSTypeAliasDeclaration(d)) out.push({ name: d.id.name, kind: 'type', node: d.id });
  };
  for (const s of statements) {
    if (t.isImportDeclaration(s)) {
      for (const sp of s.specifiers) out.push({ name: sp.local.name, kind: 'import', node: sp.local });
    } else if (t.isExportNamedDeclaration(s)) {
      decl(s.declaration);
      for (const sp of s.specifiers) {
        if (!t.isExportSpecifier(sp)) continue;
        const exported = sp.exported;
        const name = t.isIdentifier(exported) ? exported.name : exported.value;
        out.push({ name, kind: 'export', node: exported });
      }
    } else {
      decl(s);
    }
  }
  return out;
}

function scriptBindings(body: readonly t.Statement[]): Map<string, ScriptKind> {
  const out = new Map<string, ScriptKind>();
  const add = (name: string, kind: ScriptKind): void => {
    if (!out.has(name)) out.set(name, kind);
  };
  const decl = (d: t.Node | null | undefined): void => {
    if (t.isVariableDeclaration(d)) {
      for (const v of d.declarations) {
        for (const name of Object.keys(t.getBindingIdentifiers(v.id))) add(name, 'value');
      }
    } else if (t.isFunctionDeclaration(d) && d.id) add(d.id.name, 'value');
    else if (t.isClassDeclaration(d) && d.id) add(d.id.name, 'class');
    else if (t.isTSInterfaceDeclaration(d)) add(d.id.name, 'interface');
    else if (t.isTSTypeAliasDeclaration(d)) add(d.id.name, 'type');
    else if (t.isTSEnumDeclaration(d)) add(d.id.name, 'enum');
  };
  for (const s of body) {
    if (t.isImportDeclaration(s)) {
      for (const sp of s.specifiers) add(sp.local.name, 'import');
    } else if (t.isExportNamedDeclaration(s) || t.isExportDefaultDeclaration(s)) {
      decl(s.declaration);
    } else {
      decl(s);
    }
  }
  return out;
}

/**
 * Does a `<types>` binding of `typesKind` clash with a `<script>` top-level
 * binding of `scriptKind` in one TypeScript module scope? Import-vs-import is
 * ROZ024's job (false here). A type-space name next to a value-only name
 * (`interface Foo` + `const Foo`) is legal TS and stays allowed.
 */
function clashes(typesKind: TypesKind, scriptKind: ScriptKind): boolean {
  if (typesKind === 'export') return false;
  if (typesKind === 'import') return scriptKind !== 'import';
  // interface / type alias
  return scriptKind !== 'value';
}

const KIND_LABEL: Record<ScriptKind, string> = {
  import: 'import',
  value: 'declaration',
  class: 'class',
  interface: 'interface',
  type: 'type alias',
  enum: 'enum',
};

/** @experimental — added in typed-surface P1 */
export function validateTypesNameCollisions(
  ir: Pick<IRComponent, 'name' | 'slots' | 'types'>,
  scriptBody: readonly t.Statement[] | null | undefined,
  diagnostics: Diagnostic[],
): void {
  if (ir.types == null) return;
  const reserved = reservedGeneratedTypeNames(ir);
  const script = scriptBindings(scriptBody ?? []);
  for (const b of typesBindings(ir.types.statements)) {
    const generated = reserved.get(b.name);
    if (generated !== undefined) {
      diagnostics.push({
        code: RozieErrorCode.TYPES_NAME_COLLISION,
        severity: 'error',
        message: `<types> name \`${b.name}\` collides with a name the compiler generates: ${generated}. Both would be declared in the same module.`,
        loc: babelLocToRozieLoc(b.node),
        hint: `Rename the <types> name (e.g. \`${b.name}Type\`)${b.kind === 'import' ? ` — \`import type { ${b.name} as ${b.name}Type }\`` : ''}.`,
      });
      continue;
    }
    const scriptKind = script.get(b.name);
    if (scriptKind !== undefined && clashes(b.kind, scriptKind)) {
      diagnostics.push({
        code: RozieErrorCode.TYPES_NAME_COLLISION,
        severity: 'error',
        message: `<types> ${b.kind === 'import' ? 'import' : b.kind === 'interface' ? 'interface' : 'type alias'} \`${b.name}\` collides with the <script> ${KIND_LABEL[scriptKind]} \`${b.name}\` — the <types> block and <script> share one module scope.`,
        loc: babelLocToRozieLoc(b.node),
        hint: `Rename one of them${b.kind === 'import' ? ` (e.g. \`import type { ${b.name} as ${b.name}Type }\`)` : ''}.`,
      });
    }
  }
}
