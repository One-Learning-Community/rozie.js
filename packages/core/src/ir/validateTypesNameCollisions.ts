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
 *
 * P1 follow-up — the module scope also holds every name the emitters IMPORT:
 * each `<components>` local name (and the `<Local>Handle` type React/Solid
 * import alongside a ref'd composed component), plus every framework /
 * `@rozie/runtime-*` import in the `targetModuleImports.ts` catalog (the same
 * catalog the emitters' import collectors and literal import lines are typed
 * against). Those names are reserved on EVERY target and even when the import
 * is conditional — `<types>` is target-neutral, so this stays stricter than TS.
 * An `export { X as Y }` alias binds no module-scope local, so it is checked
 * against generated names only.
 * `<types>` vs `<script>` IMPORT pairs are ROZ024's (see typesScriptImports.ts)
 * and are skipped here.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { babelLocToRozieLoc } from '../parsers/parserPosition.js';
import { handleInterfaceName, reservedGeneratedTypeNames } from '../codegen/generatedTypeNames.js';
import { reservedTargetImportNames } from '../codegen/targetModuleImports.js';
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
/**
 * Names the emitters import for the `<components>` entries — the local name
 * itself on every target, plus `<Local>Handle` (React/Solid, for a composed
 * component targeted by `$refs`). Name → description.
 */
function reservedComponentImportNames(ir: Pick<IRComponent, 'name' | 'components'>): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of ir.components ?? []) {
    if (c.localName === ir.name) continue; // self-reference: the component name is already reserved
    if (!out.has(c.localName)) {
      out.set(c.localName, `the \`<components>\` entry \`${c.localName}\` (imported into the compiled module on every target)`);
    }
    const handle = handleInterfaceName(c.localName);
    if (!out.has(handle)) {
      out.set(handle, `\`${handle}\`, which React and Solid import for the \`<components>\` entry \`${c.localName}\``);
    }
  }
  return out;
}

export function validateTypesNameCollisions(
  ir: Pick<IRComponent, 'name' | 'slots' | 'types' | 'components'>,
  scriptBody: readonly t.Statement[] | null | undefined,
  diagnostics: Diagnostic[],
): void {
  if (ir.types == null) return;
  const reserved = reservedGeneratedTypeNames(ir);
  const componentImports = reservedComponentImportNames(ir);
  const targetImports = reservedTargetImportNames();
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
    if (b.kind !== 'export') {
      const component = componentImports.get(b.name);
      if (component !== undefined) {
        diagnostics.push({
          code: RozieErrorCode.TYPES_NAME_COLLISION,
          severity: 'error',
          message: `<types> name \`${b.name}\` collides with ${component}. Both would be bound in the same module.`,
          loc: babelLocToRozieLoc(b.node),
          hint: `Rename the <types> name (e.g. \`${b.name}Type\`)${b.kind === 'import' ? ` — \`import type { ${b.name} as ${b.name}Type }\`` : ''}, or rename the <components> key.`,
        });
        continue;
      }
      const imported = targetImports.get(b.name);
      if (imported !== undefined) {
        diagnostics.push({
          code: RozieErrorCode.TYPES_NAME_COLLISION,
          severity: 'error',
          message: `<types> name \`${b.name}\` collides with ${imported}, which the compiled module (or its type sidecar) may import. Both would be bound in the same module.`,
          loc: babelLocToRozieLoc(b.node),
          hint: `Rename the <types> name (e.g. \`${b.name}Type\`)${b.kind === 'import' ? ` — \`import type { ${b.name} as ${b.name}Type }\`` : ''}. The name is reserved on every target, even where that import is only added when a feature is used.`,
        });
        continue;
      }
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
