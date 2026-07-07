/**
 * deconflictSolidRefSuffix — Spike-012 R5 (C4-rename-collision, Solid "make it
 * work" half).
 *
 * On Solid a template ref UNCONDITIONALLY lowers to the SUFFIXED binding
 * `<name>Ref` (`ref="box"` → `let boxRef: HTMLElement | null = null;`, and
 * every `$refs.box` read/write → bare `boxRef`) — see rewriteScript.ts's
 * `refNamesSuffixed` (~line 474) and the parallel suffix sites in
 * rewriteTemplateExpression.ts (~254, ~337) and emitTemplateAttribute.ts
 * (~690). If the author ALSO has a top-level `<script>` binding literally
 * named `boxRef` (a `const`/`let`/`function`/`class`), the EXISTING
 * `deconflictReservedClassFields` pass (wired via `solidReservedBindings` in
 * rewriteScript.ts) renames the colliding USER const to `boxRef$local` — but
 * that pass only walks the cloned top-level `<script>` Program, NOT the
 * separately-threaded `ir.lifecycle[].setup`/`.cleanup` bodies (rewriteScript.ts's
 * own doc comment: "`$onMount`/`$onUnmount`/`$onUpdate` — NOT mutated;
 * consumed structurally from ir.lifecycle"). A read of the user's `boxRef`
 * INSIDE a lifecycle hook is therefore left bare while the declaration gets
 * renamed out from under it → the bare read silently re-binds to the REF
 * instead of the (now-renamed) user const: wrong type (TS2365/TS18047) AND a
 * wrong runtime value. This shape compiles fine on react/angular (there the
 * ref's UNSUFFIXED name is what would collide, and those targets already
 * rename the colliding ref via the shared `deconflictRefsAgainstUserBindings`
 * core pass) — so the correct Solid resolution is to MAKE IT WORK, not error.
 *
 * Mirrors the Vue fix (`packages/targets/vue/src/rewrite/deconflictRefSuffix.ts`,
 * `deconflictVueRefSuffix`) for the analogous collision class: rather than
 * patch the downstream `$local` rename to also reach into `ir.lifecycle`
 * bodies, rename the ref's SOURCE name (`box` → `box2`) so the `Ref` suffix
 * lands on a free binding (`box2Ref`) BEFORE any per-target rewrite reads a
 * ref name. Since `boxRef` (the user's const) no longer collides with any
 * emitted ref binding, `deconflictReservedClassFields`'s `$local` rename never
 * fires for it — the user's const and every read of it (including inside
 * `ir.lifecycle` bodies) stay untouched. The walk that propagates the rename
 * across the IR (`$refs.<old>` member reads + the static template
 * `ref="<old>"` attribute) mirrors `deconflictRefsAgainstUserBindings` /
 * `deconflictVueRefSuffix` exactly, and — because `ir.lifecycle[].setup`/
 * `.cleanup` are AST subtrees reachable directly off `ir` — the SAME generic
 * walk also reaches `$refs.<old>` reads inside lifecycle hook bodies (the
 * exact spot the downstream `$local` rename could not reach).
 *
 * DISTINCT from `deconflictSolidGeneratedNames` (@rozie/core): that IR-level
 * pass already resolves a ref's `<name>Ref` colliding with a RESERVED name /
 * model-prop / `<data>` / `$computed` (using the `$local` suffix, since those
 * are all GENERATED bindings with no "public contract" numbering concern).
 * This pass instead targets collisions with a genuine USER top-level
 * `<script>` binding (or another ref) — the numeric `<base>N` suffix keeps
 * the renamed side visually distinct from the `$local`-suffixed GENERATED-name
 * collisions and matches the Vue fix's convention exactly.
 *
 * Only-on-collision: a ref whose `<name>Ref` is not taken keeps `<name>` →
 * `<name>Ref` unchanged, so the non-colliding corpus stays byte-identical.
 *
 * Callers invoke this from `emitSolid` on the target's OWN fresh IR (each
 * `compile()` call lowers a fresh IR per target — no cross-target leakage),
 * AFTER `deconflictSolidGeneratedNames` (so the taken set reflects any
 * already-renamed `<data>`/`$computed`/`$refs` name) and BEFORE `emitScript` /
 * `emitTemplate` / `rewriteScript` reads any ref name.
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

/**
 * Collect TOP-LEVEL `<script>` binding names from a Program: `const`/`let`/
 * `var` declarators, `function X() {}` declarations, and `class X {}`
 * declarations. Deliberately shallow (Program.body only, no descent into
 * nested scopes) — a function-local/param same-named binding is a legal
 * nested shadow of the ref's module-scope binding, never a redeclare.
 */
export function collectSolidTopLevelBindingNames(program: File): Set<string> {
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
 * Rename any `ir.refs[]` entry whose EMITTED Solid binding (`<name>Ref`)
 * collides with a name already occupying the Solid component-body scope.
 * Mutates `ir` in place (ref name field + every `$refs.<old>` reference + every
 * template static `ref="<old>"` attribute). Returns the rename map (old ref
 * source name → new ref source name) for diagnostics/tests; empty when
 * nothing collided.
 *
 * @param ir                     the component IR (colliding `refs[].name` renamed).
 * @param topLevelBindingNames   names from `collectSolidTopLevelBindingNames` run
 *                               on `ir.setupBody.scriptProgram` (the ORIGINAL,
 *                               not-yet-cloned Program — collected before any
 *                               per-target clone/rewrite mutates it).
 */
export function deconflictSolidRefSuffix(
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

  // TAKEN = every name already occupying the Solid component-body top-level
  // scope, expressed as the BARE identifier binding it mints: `<data>` keys /
  // `$computed` names / model props all lower to a bare `<name>()` accessor
  // call, and a non-model prop is namespaced (`local.<name>`) and never
  // occupies a bare top-level slot — included anyway for parity with the
  // shared core pass's conservative inclusion (harmless: a namespaced prop can
  // never BE the fresh candidate we pick either). Every OTHER ref's own
  // emitted `<name>Ref` binding is also taken. In practice a ref-vs-state/
  // computed/prop collision is already resolved upstream by
  // `deconflictSolidGeneratedNames` (with the `$local` suffix) before this
  // pass runs, so these entries are a defensive no-op mirroring Vue's taken
  // set, not the primary collision this pass exists to catch.
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
  // `deconflictVueRefSuffix` / `deconflictRefsAgainstUserBindings` step 2.
  // Because `ir.lifecycle[].setup`/`.cleanup` are AST subtrees reachable
  // directly off `ir`, this walk also reaches `$refs.<old>` reads inside
  // lifecycle hook bodies — the exact spot the downstream `$local` rename
  // (which only walks the cloned top-level `<script>` Program) cannot reach.
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
