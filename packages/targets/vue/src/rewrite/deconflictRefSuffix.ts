/**
 * deconflictVueRefSuffix — Spike-012 R5 (C4-rename-collision, Vue "make it
 * work" half).
 *
 * On Vue a template ref UNCONDITIONALLY lowers to the SUFFIXED binding
 * `<name>Ref` (`ref="box"` → `const boxRef = useTemplateRef('boxRef')`, and
 * every `$refs.box` read → `boxRef.value`) — see rewriteScript.ts's Pitfall 4.
 * If the author ALSO has a top-level `<script>` binding literally named
 * `boxRef` (a `const`/`let`/`function`/`class` — the historical gap this pass
 * closes) or a `<data>`/`$computed`/prop of that name, the emitted `boxRef`
 * DUPLICATES it → invalid Vue output (two `const boxRef` declarations,
 * TS2451). This shape compiles fine on react/angular/svelte (there the ref
 * name itself, not a suffixed derivative, is what collides, and THOSE targets
 * already rename the ref via the shared `deconflictRefsAgainstUserBindings`
 * core pass) — so the correct Vue resolution is to MAKE IT WORK, not error.
 *
 * DISTINCT from the shared `deconflictRefsAgainstUserBindings` (@rozie/core):
 * that pass renames a colliding ref to a fresh `<name>Ref` because on
 * React/Svelte/Angular a ref's BASE name (unsuffixed) is what occupies the
 * module/class scope. On Vue the base name is ALREADY going to be suffixed
 * unconditionally, so the collision is on the SUFFIXED name — the fix here
 * instead renames the ref's SOURCE name `<name>` → a fresh `<base>N` such
 * that `<base>NRef` is unoccupied (e.g. `box` → `box2`, landing the suffix on
 * the free `box2Ref`). The walk that propagates the rename across the IR
 * (`$refs.<old>` member reads + the static template `ref="<old>"` attribute)
 * mirrors `deconflictRefsAgainstUserBindings` exactly — see that function's
 * step 2 in packages/core/src/rewrite/deconflict.ts.
 *
 * Only-on-collision: a ref whose `<name>Ref` is not taken keeps `<name>` →
 * `<name>Ref` unchanged, so the non-colliding corpus stays byte-identical.
 *
 * Callers invoke this from `emitVue` on the target's OWN fresh IR (each
 * `compile()` call lowers a fresh IR per target — no cross-target leakage),
 * AFTER `deconflictVueGeneratedBindingNames` (so the taken set reflects any
 * already-renamed `<data>`/`$computed`/`$inject` names) and BEFORE `emitScript`
 * reads any ref name.
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

/**
 * Collect TOP-LEVEL `<script>` binding names from a Program: `const`/`let`/
 * `var` declarators, `function X() {}` declarations, and `class X {}`
 * declarations. Deliberately shallow (Program.body only, no descent into
 * nested scopes) — a function-local/param same-named binding is a legal
 * nested shadow of the ref's module-scope binding, never a redeclare.
 *
 * No `$computed` special-casing is needed: a `const label = $computed(...)`
 * declarator name is already covered separately via `ir.computed`, so
 * including it here too is redundant but harmless (a Set dedupes).
 */
export function collectVueTopLevelBindingNames(program: File): Set<string> {
  const names = new Set<string>();
  for (const stmt of program.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (t.isIdentifier(d.id)) names.add(d.id.name);
      }
      continue;
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
    if (t.isClassDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
  }
  return names;
}

/**
 * Rename any `ir.refs[]` entry whose EMITTED Vue binding (`<name>Ref`) collides
 * with a name already occupying the Vue `<script setup>` module scope. Mutates
 * `ir` in place (ref name field + every `$refs.<old>` reference + every
 * template static `ref="<old>"` attribute). Returns the rename map (old ref
 * source name → new ref source name) for diagnostics/tests; empty when
 * nothing collided.
 *
 * @param ir                     the component IR (colliding `refs[].name` renamed).
 * @param topLevelBindingNames   names from `collectVueTopLevelBindingNames` run
 *                               on `ir.setupBody.scriptProgram` (the ORIGINAL,
 *                               not-yet-cloned Program — collected before any
 *                               per-target clone/rewrite mutates it).
 */
export function deconflictVueRefSuffix(
  ir: {
    state: { name: string }[];
    refs: { name: string }[];
    computed?: { name: string }[];
    props?: { name: string }[];
  },
  topLevelBindingNames: ReadonlySet<string>,
): Map<string, string> {
  const renames = new Map<string, string>();
  if (ir.refs.length === 0) return renames;

  // TAKEN = every name already occupying the Vue module top-level scope,
  // expressed as the BARE identifier binding it mints: <data> keys, $computed
  // names, and model props all lower to a bare `<name>`/`<name>.value`
  // binding; a non-model prop is namespaced (`props.<name>`) and never
  // occupies a bare top-level slot, but is included anyway (matches the
  // shared core pass's conservative `ir.props` inclusion — harmless, since a
  // namespaced prop can never BE the fresh candidate we pick either). Every
  // OTHER ref's own emitted `<name>Ref` binding is also taken.
  const taken = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...(ir.computed ?? []).map((c) => c.name),
    ...(ir.props ?? []).map((p) => p.name),
    ...topLevelBindingNames,
    ...ir.refs.map((r) => `${r.name}Ref`),
  ]);

  const collidesWithDeclared = (emittedRefBinding: string): boolean =>
    ir.state.some((s) => s.name === emittedRefBinding) ||
    (ir.computed ?? []).some((c) => c.name === emittedRefBinding) ||
    (ir.props ?? []).some((p) => p.name === emittedRefBinding) ||
    topLevelBindingNames.has(emittedRefBinding);

  const freshBase = (base: string): string => {
    let i = 2;
    let candidate = `${base}${i}`;
    while (taken.has(candidate) || taken.has(`${candidate}Ref`)) {
      i++;
      candidate = `${base}${i}`;
    }
    taken.add(candidate);
    taken.add(`${candidate}Ref`);
    return candidate;
  };

  for (const ref of ir.refs) {
    const emittedRefBinding = `${ref.name}Ref`;
    const collidesWithOtherRef = ir.refs.some(
      (other) => other !== ref && `${other.name}Ref` === emittedRefBinding,
    );
    if (!collidesWithDeclared(emittedRefBinding) && !collidesWithOtherRef) continue;
    const newBase = freshBase(ref.name);
    renames.set(ref.name, newBase);
    ref.name = newBase;
  }
  if (renames.size === 0) return renames;

  // Deep-walk the ENTIRE IR: rename every `$refs.<old>` non-computed member
  // property + every template static `ref="<old>"` attribute value. Mirrors
  // `deconflictRefsAgainstUserBindings` step 2 (@rozie/core deconflict.ts).
  // STATE and `$data.<key>` members are deliberately untouched.
  const seen = new WeakSet<object>();
  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    const asAttr = value as { kind?: unknown; name?: unknown; value?: unknown };
    if (asAttr.kind === 'static' && asAttr.name === 'ref' && typeof asAttr.value === 'string') {
      const renamed = renames.get(asAttr.value);
      if (renamed) (value as { value: string }).value = renamed;
    }

    if (isNode(value)) {
      const node = value as {
        type: string;
        computed?: boolean;
        object?: { type?: string; name?: string };
        property?: { type?: string; name?: string };
      };
      if (
        (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') &&
        node.computed !== true &&
        node.object?.type === 'Identifier' &&
        node.object.name === '$refs' &&
        node.property?.type === 'Identifier' &&
        typeof node.property.name === 'string'
      ) {
        const renamed = renames.get(node.property.name);
        if (renamed) node.property.name = renamed;
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const key of Object.keys(value)) {
      walk((value as Record<string, unknown>)[key]);
    }
  };
  walk(ir);

  return renames;
}
