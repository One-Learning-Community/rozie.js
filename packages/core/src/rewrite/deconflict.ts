/**
 * Unified target-parameterized collision-aware deconfliction pass (Phase 46,
 * ITEM-5 / D-02).
 *
 * THE END STATE: ONE pass, not N point-fixes. This module subsumes the three
 * collision point-fixes that grew up independently across the targets:
 *
 *   1. React `deconflictRefShadows`        (was rewrite/rewriteScript.ts:446)
 *   2. Svelte `deconflictAccessorShadows`  (was rewrite/rewriteScript.ts:290)
 *   3. React ROZ524 setter collision       (was emit/emitScript.ts:2682, an
 *      ERROR the author had to hand-fix — now an auto-rename of the user side)
 *
 * and ADDS one net-new collision class (D-02):
 *
 *   4. A USER LOCAL that becomes a CLASS FIELD colliding with `Object.prototype`
 *      members (Angular + Lit) or inherited `HTMLElement`/`Element`/`Node`
 *      members (Lit only). This is a DISTINCT predicate (not a bare-ident
 *      shadow) — same `X$local` suffix, same only-on-collision discipline,
 *      different collision trigger.
 *
 * DESIGN INVARIANTS (locked):
 *
 *   - Rename the RENAMEABLE side ONLY (internal state/setter/local/ref). NEVER
 *     an `$expose` key or a prop name — those are PUBLIC CONTRACT (D-02). On a
 *     `$data`-key vs `$expose`-verb collision the renameable side is the
 *     internal `$data` local (`open` → `open$local`), the exposed verb stays.
 *   - ONLY-ON-COLLISION. A name in the generated-symbol set that no user binding
 *     shadows leaves the corpus byte-identical. Two trigger flavours:
 *       (a) accessor-shadow: a user local/param binds `name` AND its scope reads
 *           the corresponding `$accessor.name` (the bare-ident-rewrite-capture
 *           bug). Used by React/Svelte/Solid bare-ident targets.
 *       (b) reserved-member: a user local binds `name` AND `name` is a reserved
 *           class-field member for the class target. Used by Angular/Lit.
 *   - TIMING (Pitfall 2): callers MUST run this on the freshly-cloned,
 *     not-yet-mutated Program, BEFORE the main identifier-rewrite traverse — the
 *     same site the prior point-fixes ran at. The scope cache must be valid;
 *     `scope.rename` is atomic over the binding's declaration/param + every
 *     reference within its scope.
 *
 * The WALK MACHINERY is target-agnostic and lives here. The SYMBOL SET is
 * per-target (each `rewriteScript.ts` builds its set and calls in).
 */

import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import {
  OBJECT_PROTOTYPE_MEMBERS,
  LIT_DOM_MEMBERS,
  LIT_LIFECYCLE_MEMBERS,
  LIT_EMITTER_MEMBERS,
  ANGULAR_CVA_MEMBERS,
  ANGULAR_LIFECYCLE_MEMBERS,
  ANGULAR_EMITTER_MEMBERS,
} from './reservedNames.js';

// Re-export for back-compat with existing importers (deconflict-unified.test.ts
// and any other consumer that imported OBJECT_PROTOTYPE_MEMBERS from here). The
// canonical definition now lives in reservedNames.ts (the single source of
// truth); reservedNames.ts is a pure leaf and deconflict.ts is the consumer —
// one direction, no module-init cycle (see reservedNames.ts header).
export { OBJECT_PROTOTYPE_MEMBERS };

// CJS interop normalization (matches every target's rewriteScript.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The deconfliction suffix. Locked by D-02; matches the prior point-fixes. */
export const DECONFLICT_SUFFIX = '$local';

const alias = (name: string): string => `${name}${DECONFLICT_SUFFIX}`;

/**
 * Returns true if a binding-pattern node introduces a binding for `name`.
 *
 * Extracted verbatim from the React + Svelte targets' identical
 * `patternIntroducesBinding` (the destructuring-aware shape originally ported
 * from React's `hoistModuleLet`). Handles the simple Identifier case plus
 * ObjectPattern / ArrayPattern / AssignmentPattern / RestElement destructured
 * forms.
 */
export function patternIntroducesBinding(pattern: t.Node, name: string): boolean {
  if (t.isIdentifier(pattern)) return pattern.name === name;
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (patternIntroducesBinding(prop.value as t.Node, name)) return true;
      } else if (t.isRestElement(prop)) {
        if (patternIntroducesBinding(prop.argument, name)) return true;
      }
    }
    return false;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el && patternIntroducesBinding(el, name)) return true;
    }
    return false;
  }
  if (t.isAssignmentPattern(pattern)) {
    return patternIntroducesBinding(pattern.left, name);
  }
  if (t.isRestElement(pattern)) {
    return patternIntroducesBinding(pattern.argument, name);
  }
  return false;
}

/**
 * Returns true if the subtree rooted at `node` contains a NON-computed
 * `<accessor>.<name>` read (Member/OptionalMember) — the exact shape the
 * downstream rewrite lowers to a bare `<name>`. The trigger condition for the
 * accessor-shadow bug: a colliding local/param only mis-captures the rewrite
 * when such a read actually exists within its scope.
 *
 * `accessor` is the Rozie sigil object identifier (`$props`, `$refs`, `$data`).
 * `<accessor>['x']` (computed) is excluded — the rewrite skips computed access,
 * so it never lowers to a bare identifier and cannot be captured.
 *
 * Hand-rolled recursive walk (no Program-rooted Babel traverse): a direct walk
 * over own-enumerable child nodes is simpler and has no rooting constraint.
 * Generalized from the React `subtreeReadsRef` / Svelte `subtreeReadsAccessor`
 * twins (identical except for the accessor name they were hard-/soft-coded to).
 */
export function subtreeReads(
  node: t.Node | null | undefined,
  accessor: string,
  name: string,
): boolean {
  if (!node) return false;
  let found = false;
  function walk(n: t.Node | null | undefined): void {
    if (found || !n || typeof n !== 'object' || !('type' in n)) return;
    if (t.isMemberExpression(n) || t.isOptionalMemberExpression(n)) {
      const obj = n.object;
      const prop = n.property;
      if (
        !n.computed &&
        t.isIdentifier(obj) &&
        obj.name === accessor &&
        t.isIdentifier(prop) &&
        prop.name === name
      ) {
        found = true;
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (
        key === 'loc' ||
        key === 'start' ||
        key === 'end' ||
        key === 'leadingComments' ||
        key === 'trailingComments' ||
        key === 'innerComments'
      ) {
        continue;
      }
      const v = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object' && 'type' in item) walk(item as t.Node);
        }
      } else if (v && typeof v === 'object' && 'type' in v) {
        walk(v as t.Node);
      }
    }
  }
  walk(node);
  return found;
}

/**
 * Returns true if the subtree rooted at `node` contains a BARE Identifier READ of
 * `name` — the exact shape the Vue `$computed` lowering wraps to `<name>.value`.
 *
 * The Vue trigger condition for the `$computed` shadow bug: a `$computed` name is
 * read as a BARE identifier in source (there is NO `$computed.<name>` accessor
 * member to gate on), and the downstream Identifier visitor `.value`-wraps every
 * such bare read. A colliding param/local only mis-captures that wrap when it
 * actually performs a bare read of `name` within its scope — so a `binding`
 * trigger (mere existence) would over-apply (renaming an unused same-named param
 * → corpus drift), and the `accessor` trigger cannot fire (no member access).
 *
 * Excludes the SAME non-read positions the Vue Identifier visitor skips, so the
 * gate matches the rewrite exactly: declaration ids, non-computed member
 * properties, object keys (shorthand or not), TS type positions, function names,
 * function params, and import/export specifier ids. A computed member property
 * (`obj[name]`) IS a bare read and counts.
 *
 * Hand-rolled own-child walk (the `subtreeReads` twin): a direct walk with
 * parent-context tracking is simpler than a Program-rooted Babel traverse and
 * has no rooting constraint.
 */
export function subtreeReadsBareIdentifier(
  node: t.Node | null | undefined,
  name: string,
): boolean {
  if (!node) return false;
  let found = false;
  function walk(n: t.Node | null | undefined, parent: t.Node | null): void {
    if (found || !n || typeof n !== 'object' || !('type' in n)) return;

    if (t.isIdentifier(n) && n.name === name) {
      if (isBareRead(n, parent)) {
        found = true;
        return;
      }
    }
    // TS type subtrees never contribute a runtime bare read (mirrors the Vue
    // Identifier visitor's `isInTypePosition` skip). The value-bearing TS wrapper
    // nodes (`x as T`, `x!`, `x satisfies T`, `<T>x`) carry a runtime expression
    // child and must NOT be pruned.
    if (
      n.type.startsWith('TS') &&
      n.type !== 'TSNonNullExpression' &&
      n.type !== 'TSAsExpression' &&
      n.type !== 'TSSatisfiesExpression' &&
      n.type !== 'TSTypeAssertion'
    ) {
      return;
    }

    for (const key of Object.keys(n)) {
      if (
        key === 'loc' ||
        key === 'start' ||
        key === 'end' ||
        key === 'leadingComments' ||
        key === 'trailingComments' ||
        key === 'innerComments'
      ) {
        continue;
      }
      const v = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object' && 'type' in item) {
            walk(item as t.Node, n);
          }
        }
      } else if (v && typeof v === 'object' && 'type' in v) {
        walk(v as t.Node, n);
      }
    }
  }
  // Decide whether an Identifier node named `name` is a genuine bare READ (the
  // position the Vue Identifier visitor would `.value`-wrap) given its parent.
  function isBareRead(id: t.Identifier, parent: t.Node | null): boolean {
    if (!parent) return true;
    // `const name = ...` / declarator id.
    if (t.isVariableDeclarator(parent) && parent.id === id) return false;
    // `name.foo` non-computed member PROPERTY (`x.name`) — not a bare read.
    if (
      (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
      parent.property === id &&
      !parent.computed
    ) {
      return false;
    }
    // Object KEY position (`{ name: ... }`) — a property name, not a read. A
    // shorthand `{ name }` has `key === value === id`; the Vue Identifier visitor
    // SKIPS shorthand (it leaves `{ name }` reading the param as-authored, no
    // `.value` wrap), so it is NOT a triggering read either. Both → false.
    if (t.isObjectProperty(parent) && parent.key === id && !parent.computed) {
      return false;
    }
    // Function NAME (`function name() {}`).
    if (t.isFunctionDeclaration(parent) && parent.id === id) return false;
    if (t.isFunctionExpression(parent) && parent.id === id) return false;
    // Function PARAMETER binding (`(name) => ...`).
    if (t.isFunction(parent) && parent.params.includes(id)) return false;
    // import/export specifier ids.
    if (t.isImportSpecifier(parent)) return false;
    if (t.isImportDefaultSpecifier(parent)) return false;
    if (t.isImportNamespaceSpecifier(parent)) return false;
    if (t.isExportSpecifier(parent)) return false;
    // Labeled-statement / break / continue labels.
    if (t.isLabeledStatement(parent) && parent.label === id) return false;
    return true;
  }
  walk(node, null);
  return found;
}

/**
 * One generated-symbol group: a set of names the EMITTER will mint as a binding,
 * plus the predicate that decides whether a user binding actually collides.
 */
export interface GeneratedSymbolGroup {
  /** The generated symbol names (the collision set). */
  names: ReadonlySet<string>;
  /**
   * Collision trigger flavour:
   *   - `{ kind: 'accessor', accessor }` — the bare-ident-rewrite-capture bug:
   *     a user binding for `name` collides ONLY when its scope reads
   *     `<accessor>.name` (gated via `subtreeReads`). This is the React/Svelte/
   *     Solid bare-ident case.
   *   - `{ kind: 'binding' }` — a user binding for `name` collides as soon as
   *     it exists (no accessor read required). This is the React `setX` setter
   *     case (a user helper named `setX` clashes with the generated `useState`
   *     destructure binding) AND the Angular/Lit reserved-class-member case (a
   *     user local that becomes a colliding class field). The renameable side is
   *     always the user binding; the generated symbol is the contract.
   *
   *     OPTIONAL `programOnly: true` — restrict the rename to PROGRAM/setup-scope
   *     (top-level) bindings ONLY; a function PARAMETER or a function-LOCAL
   *     `const`/`let` named `name` is NOT renamed. Used by the Vue
   *     generated-binding group (Plan 61-07): a top-level `const slots = ref(...)`
   *     genuinely REDECLARES the generated `const slots = useSlots()` (TS2451), but
   *     a function-local `const h = portals.body(...)` or a param `(w, h) => …` is
   *     a LEGAL nested shadow of the `import { h }` / generated binding (no
   *     redeclare error) — renaming it would be byte-identity drift. Mirrors the
   *     `deconflictReservedClassFields` "program-level only" discipline.
   *   - `{ kind: 'bare-read' }` — a user binding for `name` collides ONLY when
   *     its scope contains a BARE Identifier READ of `name` (gated via
   *     `subtreeReadsBareIdentifier`). This is the Vue `$computed` case: a
   *     computed name has NO `$computed.<name>` accessor member (so the
   *     `accessor` trigger cannot fire), yet the Vue Identifier visitor
   *     `.value`-wraps every bare read of the name — a same-named param/local
   *     would capture that wrap. A `binding` trigger would over-apply (rename a
   *     same-named param that never reads the computed → corpus drift), so the
   *     actual bare read is the gate. Consumed ONLY by Vue's computed group.
   */
  trigger:
    | { kind: 'accessor'; accessor: string }
    | { kind: 'binding'; programOnly?: boolean }
    | { kind: 'bare-read' };
}

/**
 * THE UNIFIED PASS. Renames any USER binding (function param or
 * `const`/`let`/`var` declarator) that collides with a generated symbol to
 * `<name>$local`, atomically across its binding scope, gated only-on-collision
 * per the group's trigger flavour.
 *
 * Callers pass one or more `GeneratedSymbolGroup`s. The pass is idempotent on a
 * non-colliding corpus (byte-identical) and order-independent across groups
 * because each rename targets a distinct name (target symbol sets are disjoint
 * by construction — refs ⟂ data ⟂ props ⟂ setters ⟂ reserved-members).
 *
 * MUST run on the freshly-cloned, not-yet-mutated Program (scope cache valid).
 */
export function deconflictGeneratedSymbols(
  program: File,
  groups: readonly GeneratedSymbolGroup[],
  /**
   * PUBLIC-CONTRACT names that must NEVER be renamed even on a collision
   * (`$expose` verb names + prop names — D-02). Guards against renaming a user
   * binding that is itself the public handle (e.g. an exposed `open()` function
   * that also reads `$data.open`).
   */
  protectedNames: ReadonlySet<string> = new Set(),
): void {
  const active = groups.filter((g) => g.names.size > 0);
  if (active.length === 0) return;

  // A binding for `name` collides with this group iff the group's trigger says
  // so for the given scope-defining node (the function body / declarator owner
  // scope block). For `accessor` triggers we require an actual offending read;
  // for `binding` triggers the mere existence of the colliding binding is the
  // trigger (the generated symbol is unconditionally minted).
  const collides = (
    group: GeneratedSymbolGroup,
    name: string,
    scopeBlock: t.Node | null | undefined,
  ): boolean => {
    if (!group.names.has(name)) return false;
    if (protectedNames.has(name)) return false; // public contract — never rename
    if (group.trigger.kind === 'binding') return true;
    if (group.trigger.kind === 'bare-read') {
      return subtreeReadsBareIdentifier(scopeBlock, name);
    }
    return subtreeReads(scopeBlock, group.trigger.accessor, name);
  };

  traverse(program, {
    // Function PARAMETERS shadowing a generated symbol.
    Function(path) {
      const body = path.node.body;
      for (const param of path.node.params) {
        for (const group of active) {
          // `programOnly` binding groups (Vue generated-binding) NEVER rename a
          // function parameter — a param is a legal nested shadow, never a
          // top-level redeclare. Skip the whole group for params.
          if (group.trigger.kind === 'binding' && group.trigger.programOnly) continue;
          for (const name of group.names) {
            if (patternIntroducesBinding(param, name) && collides(group, name, body)) {
              // `path.scope` for a Function path is the scope it INTRODUCES
              // (binds its params). rename() updates the param + every reference
              // in the body.
              path.scope.rename(name, alias(name));
            }
          }
        }
      }
    },
    // `const`/`let`/`var` DECLARATORS shadowing a generated symbol. For the
    // canonical self-reference (`const open = $data.open`) the offending read is
    // the declarator's own initializer; the owner scope block is searched. The
    // initializer is still `<accessor>.X` at this point (not yet rewritten), so
    // renaming the declared local to `X$local` leaves `<accessor>.X` untouched —
    // the later rewrite then emits `const X$local = X` reading the real symbol.
    VariableDeclarator(path) {
      const id = path.node.id;
      for (const group of active) {
        for (const name of group.names) {
          if (!patternIntroducesBinding(id, name)) continue;
          const binding = path.scope.getBinding(name);
          const ownerScope = binding ? binding.scope : path.scope;
          // `bare-read` (Vue `$computed`) is the ONLY trigger whose generated
          // symbol is itself DECLARED in the source program (`const <name> =
          // $computed(...)`). A program-scope declarator for that name therefore
          // IS the generated symbol — never a user shadow (a second top-level
          // `const <name>` would be a duplicate-binding error). Renaming it would
          // tamper the generated computed (T-57-01). A genuine bare-read shadow
          // only arises in a NESTED scope (a function-local `const`/param), which
          // is still handled below. Accessor/binding triggers do NOT declare their
          // symbol in source (defineModel/$data/setX are emitter-minted), so a
          // program-scope `const <name> = $accessor.<name>` self-shadow is a real
          // user binding and stays renameable.
          if (group.trigger.kind === 'bare-read' && t.isProgram(ownerScope.block)) {
            continue;
          }
          // `programOnly` binding groups rename ONLY a PROGRAM/setup-scope
          // declarator (a genuine top-level redeclare); a function-LOCAL `const`
          // named the symbol is a legal nested shadow → skip.
          if (
            group.trigger.kind === 'binding' &&
            group.trigger.programOnly &&
            !t.isProgram(ownerScope.block)
          ) {
            continue;
          }
          if (collides(group, name, ownerScope.block)) {
            ownerScope.rename(name, alias(name));
          }
        }
      }
    },
    // `function setX() {}` DECLARATIONS shadowing a generated symbol. This is the
    // React ROZ524 fold: a user helper authored as a function declaration whose
    // name equals a generated `setX` setter. The collision is a pure binding
    // collision (`binding` trigger — the setter is unconditionally minted), so
    // `subtreeReads` does NOT gate it. The function's own NAME binding lives in
    // the ENCLOSING scope (`path.scope.parent`).
    FunctionDeclaration(path) {
      const fnId = path.node.id;
      if (!fnId) return;
      const name = fnId.name;
      for (const group of active) {
        if (group.trigger.kind !== 'binding') continue;
        if (!group.names.has(name)) continue;
        if (protectedNames.has(name)) continue; // public contract — never rename
        const ownerScope = path.scope.parent ?? path.scope;
        // `programOnly` (Vue generated-binding): only a TOP-LEVEL `function X(){}`
        // (declared in Program scope) genuinely redeclares the generated binding;
        // a nested function declaration named the symbol is a legal shadow.
        if (group.trigger.programOnly && !t.isProgram(ownerScope.block)) continue;
        ownerScope.rename(name, alias(name));
      }
    },
  });
}

/**
 * SHARED IR-LEVEL state-key deconfliction (Phase 46 ITEM-5 / D-02).
 *
 * The `$data`-key == `$expose`-verb collision (the listbox `open` footgun): a
 * `<data>` key `open` and an `$expose` verb `open` BOTH want the bare identifier
 * `open` on the bare-ident targets (React `useState` value, Svelte/Solid signal
 * local) and a `this.open` member on the class targets — colliding with the
 * exposed `open()` function/method. Five of six targets emit a duplicate `open`
 * binding (or bind the exposed handle to the state value); only Lit escapes via
 * its `_`-prefixed state field.
 *
 * The renameable side is the INTERNAL STATE (D-02 — the `$expose` verb is public
 * contract). Because EVERY target lowers `$data.X` from `ir.state[].name`, the
 * single uniform fix is to rename the colliding STATE KEY itself — `open` →
 * `open$local` — at the IR level, BEFORE per-target lowering. This is the
 * generated-symbol analog of the user-side rename pass: here the renamed binding
 * is the one the EMITTER will mint, so renaming the IR source-of-truth (the
 * state name + every `$data.<key>` reference + every `{scope:'data', path:[key]}`
 * SignalRef dep) fixes all six targets at once with no per-target edit.
 *
 * Mutates `ir` in place. Runs once in `lowerToIR` (shared by compile() AND
 * unplugin). Only-on-collision: a state key that is NOT an expose verb is
 * byte-identical (zero corpus drift). `$data.X` member references are renamed by
 * a deep IR walk (every embedded Babel `MemberExpression{$data.<key>}`); the
 * `setupBody.scriptProgram` is the SAME node every emitter clones, so the rename
 * propagates. Also covers the user-side `$data` self-shadow (`const open =
 * $data.open`) — after the state key becomes `open$local`, the rewrite reads the
 * renamed key, and the user's `const open` (if any) no longer collides.
 *
 * Phase 61 Plan 06 (SC-2, collision-solid §"NEW risks" 5) — ALSO walks
 * `ir.computed`. A `$computed value` const collides with an `$expose({ value })`
 * verb the same way a `<data> value` does: the synthesized handle `{ value }` (re-
 * built from `ir.expose[].name` on every target — the raw `$expose(...)` call is
 * STRIPPED everywhere) would reference the bare memo accessor instead of the
 * author's intended exposed binding. A `$computed` name is read as a BARE
 * identifier (there is NO `$computed.<name>` member to gate on — unlike `$data.X`),
 * so its references are renamed via a BARE-IDENTIFIER IR walk with position guards
 * (member-property / object-key / specifier slots skipped). The renameable side is
 * the INTERNAL computed; the `$expose` verb stays. The bare reference inside the
 * (about-to-be-stripped) `$expose(...)` call argument is skipped explicitly so the
 * public-handle synthesis is provably untouched regardless of per-target stripping.
 */
export function deconflictStateExposeCollision(ir: {
  state: { name: string }[];
  computed?: { name: string }[];
  expose?: { name: string }[];
}): void {
  const exposeVerbs = new Set((ir.expose ?? []).map((e) => e.name));
  if (exposeVerbs.size === 0) return;

  // State renames go through the `$data.<key>` MEMBER path; computed renames go
  // through the BARE-identifier path. Kept in separate maps because the two
  // reference shapes are disjoint (a `$data.X` member vs a bare `X` read).
  const stateRenames = new Map<string, string>();
  for (const s of ir.state) {
    if (exposeVerbs.has(s.name)) {
      stateRenames.set(s.name, `${s.name}${DECONFLICT_SUFFIX}`);
    }
  }
  const computedRenames = new Map<string, string>();
  for (const c of ir.computed ?? []) {
    if (exposeVerbs.has(c.name)) {
      computedRenames.set(c.name, `${c.name}${DECONFLICT_SUFFIX}`);
    }
  }
  if (stateRenames.size === 0 && computedRenames.size === 0) return;

  // 1. Rename the state / computed declarations themselves.
  for (const s of ir.state) {
    const renamed = stateRenames.get(s.name);
    if (renamed) s.name = renamed;
  }
  for (const c of ir.computed ?? []) {
    const renamed = computedRenames.get(c.name);
    if (renamed) c.name = renamed;
  }

  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  // 2a. Bare-identifier rename of every `$computed`-name reference across the IR.
  //     A `$computed c` is read bare (`c`, `c + 1`, `{{ c }}`), so renaming the
  //     declaration is not enough — every reference must move too. Position guards
  //     skip non-reference identifier slots; the `$expose(...)` call argument is
  //     skipped wholesale so the public handle synthesis is untouched.
  const renameComputedBareRefs = (root: unknown): void => {
    if (computedRenames.size === 0) return;
    const seenNodes = new WeakSet<object>();
    const isExposeCall = (n: { type: string }): boolean => {
      const call = n as {
        type: string;
        callee?: { type?: string; name?: string };
      };
      return (
        (call.type === 'CallExpression' || call.type === 'OptionalCallExpression') &&
        call.callee?.type === 'Identifier' &&
        call.callee.name === '$expose'
      );
    };
    const renameIn = (node: { type: string }, parent: { type: string } | null, parentKey: string | null): void => {
      if (seenNodes.has(node)) return;
      seenNodes.add(node);

      if (node.type === 'Identifier') {
        const id = node as { type: string; name: string };
        const renamed = computedRenames.get(id.name);
        if (renamed && parent) {
          const p = parent as Record<string, unknown> & { type: string };
          const skip =
            // `obj.c` / `obj?.c` non-computed member PROPERTY (not a bare read).
            ((p.type === 'MemberExpression' || p.type === 'OptionalMemberExpression') &&
              p['property'] === node && p['computed'] !== true) ||
            // `{ c: x }` non-shorthand key OR `{ get c() {} }` method key.
            (p.type === 'ObjectProperty' && p['key'] === node &&
              p['computed'] !== true && p['shorthand'] !== true) ||
            ((p.type === 'ObjectMethod' || p.type === 'ClassMethod') &&
              p['key'] === node && p['computed'] !== true) ||
            // import/export specifier name slots are module bindings, not refs.
            p.type === 'ImportSpecifier' || p.type === 'ImportDefaultSpecifier' ||
            p.type === 'ImportNamespaceSpecifier' || p.type === 'ExportSpecifier';
          if (!skip) id.name = renamed;
        }
        return;
      }

      // Do NOT descend into the `$expose(...)` call argument — its `{ verb }`
      // shorthand is PUBLIC contract (key === verb name); the handle is
      // re-synthesized from `ir.expose[].name` on every target.
      if (isExposeCall(node)) return;

      const rec = node as unknown as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' ||
            key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
          continue;
        }
        const child = rec[key];
        if (Array.isArray(child)) {
          for (const item of child) if (isNode(item)) renameIn(item, node, key);
        } else if (isNode(child)) {
          renameIn(child, node, key);
        }
      }
    };
    const irSeen = new WeakSet<object>();
    const walkRoot = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (irSeen.has(value)) return;
      irSeen.add(value);
      if (isNode(value)) { renameIn(value, null, null); return; }
      if (Array.isArray(value)) { for (const item of value) walkRoot(item); return; }
      for (const k of Object.keys(value as Record<string, unknown>)) {
        walkRoot((value as Record<string, unknown>)[k]);
      }
    };
    walkRoot(root);
  };
  renameComputedBareRefs(ir);

  // 2b. Deep-walk the ENTIRE IR. For every embedded Babel node, rename a
  //    non-computed `$data.<oldKey>` MemberExpression property to the new key.
  //    For every SignalRef `{ scope: 'data', path: [oldKey, ...] }`, rename
  //    path[0]. A WeakSet guards against re-visiting shared nodes / cycles.
  const seen = new WeakSet<object>();

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    // SignalRef data-dep rename: { scope: 'data', path: [key, ...] }.
    const asDep = value as { scope?: unknown; path?: unknown };
    if (asDep.scope === 'data' && Array.isArray(asDep.path) && asDep.path.length > 0) {
      const head = asDep.path[0];
      const renamed = typeof head === 'string' ? stateRenames.get(head) : undefined;
      if (renamed) asDep.path[0] = renamed;
    }

    // `$data.<key>` MemberExpression / OptionalMemberExpression property rename.
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
        node.object.name === '$data' &&
        node.property?.type === 'Identifier' &&
        typeof node.property.name === 'string'
      ) {
        const renamed = stateRenames.get(node.property.name);
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
}

/**
 * IR-LEVEL reserved-member deconfliction for `$computed` names + `$inject`
 * local bindings (Phase 61 Plan 03 — SC-2, R-NEW-1 + R-NEW-5).
 *
 * DISTINCT from `deconflictReservedClassFields` (which walks `<script>`
 * top-level declarators on a per-target CLONED Program): a `$computed` const
 * and a `$inject` local binding are NOT renamed by that pass on the class
 * targets, for two different reasons:
 *
 *   - `$computed`: the colliding declarator IS reached by the program-clone
 *     rename, but the getter-emission + template-binding sites read the name
 *     back from the IR (`ir.computed[].name` / the IR template-expression
 *     subtrees), NOT from the renamed clone — so the rename does NOT propagate
 *     (the getter falls through to a broken plain field, and `{{ X }}` still
 *     reads the old name). `methodNames.ts` additionally SKIPS `$computed`.
 *   - `$inject`: the declarator rename produces a renamed `get X$local()`
 *     accessor, but every template/script read of the bound local still reads
 *     the OLD name (the rename never propagates to the IR template subtrees).
 *
 * Both names are INTERNAL (template/method-referenced, never consumer-facing
 * public contract) → safe to auto-rename to `X$local`. The single uniform fix
 * is to rename at the IR LEVEL — `ir.computed[].name` / `ir.injects[].localBinding`
 * + every BARE-identifier reference across the ENTIRE IR (the shared
 * `setupBody.scriptProgram` declarator/refs AND every template-expression
 * subtree) — BEFORE the per-target lowering reads any of them. Because the
 * caller passes a target-specific reserved set, this stays only-on-collision:
 * a non-reserved computed/inject name is byte-identical.
 *
 * Mutates `ir` in place. Callers invoke it from their per-target emit
 * orchestrator (Lit: `emitLit`) on the target's OWN IR (each `compile()` call
 * lowers a fresh IR per target — no cross-target leakage). Returns the rename
 * map (old → new) for diagnostics/tests; empty when nothing collided.
 *
 * @param ir         the component IR (computed[].name + injects[].localBinding renamed).
 * @param reserved   the target's reserved class-member set (e.g. reservedClassMembers('lit')).
 * @param protectedNames PUBLIC-CONTRACT names never renamed (prop names + $expose verbs).
 */
export function deconflictReservedComputedInjectNames(
  ir: {
    computed: { name: string }[];
    injects?: { localBinding: string }[];
    props?: { name: string }[];
    expose?: { name: string }[];
  },
  reserved: ReadonlySet<string>,
  protectedNames: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const renames = new Map<string, string>();
  if (reserved.size === 0) return renames;

  // Collect the colliding renameable names. A name that is ALSO a public
  // contract name (prop / $expose verb) is NEVER renamed (D-02). Defensively
  // also fold in any IR-level props/expose the caller didn't pass via
  // protectedNames so the public-contract guard is total.
  const protectedAll = new Set<string>([
    ...protectedNames,
    ...(ir.props ?? []).map((p) => p.name),
    ...(ir.expose ?? []).map((e) => e.name),
  ]);
  const consider = (name: string): void => {
    if (renames.has(name)) return;
    if (reserved.has(name) && !protectedAll.has(name)) {
      renames.set(name, alias(name));
    }
  };
  for (const c of ir.computed) consider(c.name);
  for (const inj of ir.injects ?? []) consider(inj.localBinding);
  if (renames.size === 0) return renames;

  // 1. Rename the IR declaration fields themselves (source of truth for the
  //    getter-emission + ContextConsumer-accessor sites).
  for (const c of ir.computed) {
    const renamed = renames.get(c.name);
    if (renamed) c.name = renamed;
  }
  for (const inj of ir.injects ?? []) {
    const renamed = renames.get(inj.localBinding);
    if (renamed) inj.localBinding = renamed;
  }

  // 2. Deep-walk the ENTIRE IR. Rename every BARE-IDENTIFIER reference / binding
  //    matching a renamed name in every embedded Babel subtree (the shared
  //    scriptProgram declarators + refs AND each template-expression subtree).
  //    Position guards skip the non-reference identifier slots:
  //      - MemberExpression/OptionalMemberExpression `.property` (non-computed)
  //        — `foo.id` must not rename the `id` PROPERTY (only a bare `id`).
  //      - ObjectProperty `key` (non-computed, non-shorthand) — `{ id: x }`.
  //      - ObjectMethod/ClassMethod `key` (non-computed) — `{ get id() {} }`.
  //      - import/export specifier name slots.
  //    A declarator id / shorthand-property / object-value / function-param IS a
  //    reference-or-binding of the renamed local and SHOULD be renamed (these
  //    are top-level consts; the `$local` suffix keeps decl + refs consistent).
  const seen = new WeakSet<object>();
  const isNode = (v: unknown): v is t.Node =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  const renameIdentifiersIn = (node: t.Node, parent: t.Node | null, parentKey: string | null): void => {
    if (seen.has(node)) return;
    seen.add(node);

    if (node.type === 'Identifier') {
      const renamed = renames.get((node as t.Identifier).name);
      if (renamed && parent) {
        // Skip non-reference identifier slots (see position-guard list above).
        const skip =
          // `obj.id` / `obj?.id` — the property name, not a reference.
          ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') &&
            (parent as t.MemberExpression).property === node &&
            !(parent as t.MemberExpression).computed) ||
          // `{ id: x }` non-shorthand key OR `{ get id() {} }` method key.
          ((parent.type === 'ObjectProperty') &&
            (parent as t.ObjectProperty).key === node &&
            !(parent as t.ObjectProperty).computed &&
            !(parent as t.ObjectProperty).shorthand) ||
          ((parent.type === 'ObjectMethod' || parent.type === 'ClassMethod') &&
            (parent as t.ObjectMethod).key === node &&
            !(parent as t.ObjectMethod).computed) ||
          // import/export specifier name slots are module bindings, not refs.
          parent.type === 'ImportSpecifier' ||
          parent.type === 'ImportDefaultSpecifier' ||
          parent.type === 'ImportNamespaceSpecifier' ||
          parent.type === 'ExportSpecifier';
        if (!skip) {
          (node as t.Identifier).name = renamed;
        }
      }
      return;
    }

    // Recurse into child node fields (skip non-AST bookkeeping keys).
    const rec = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' ||
          key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
        continue;
      }
      const child = rec[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isNode(item)) renameIdentifiersIn(item, node, key);
        }
      } else if (isNode(child)) {
        renameIdentifiersIn(child, node, key);
      }
    }
  };

  // Walk the IR object graph; whenever we hit a Babel node, run the
  // identifier-renaming descent from there (the descent has its own WeakSet
  // guard so shared subtrees are visited once).
  const irSeen = new WeakSet<object>();
  const walkIr = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (irSeen.has(value)) return;
    irSeen.add(value);
    if (isNode(value)) {
      renameIdentifiersIn(value, null, null);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walkIr(item);
      return;
    }
    for (const key of Object.keys(value as Record<string, unknown>)) {
      walkIr((value as Record<string, unknown>)[key]);
    }
  };
  walkIr(ir);

  return renames;
}

/**
 * IR-LEVEL reserved-member deconfliction for `<data>` state names + `$refs`
 * names (Phase 61 Plan 04 — SC-2 Angular leg, risks 1-4 + 6).
 *
 * DISTINCT from BOTH `deconflictReservedClassFields` (the per-target cloned-
 * Program top-level-declarator walk) AND `deconflictReservedComputedInjectNames`
 * (which renames BARE identifiers): a `<data>` field and a `$refs` name lower on
 * the class targets via `signal()` / `viewChild()` CODEGEN that reads the name
 * back from the IR — NOT from the cloned `<script>` declarators (a `<data>` key
 * has no top-level declarator; a `$refs` name appears only as the
 * `$refs.<name>` member-PROPERTY, which the bare-identifier pass deliberately
 * skips). So neither existing pass renames them.
 *
 * Both are INTERNAL (template/method-referenced, never consumer-facing public
 * contract) → safe to auto-rename to `X$local`. This pass renames at the IR
 * LEVEL — the source-of-truth fields + every reference site:
 *
 *   - `ir.state[].name` / `ir.refs[].name` (the codegen reads these directly:
 *     `<name> = signal(...)` / `<name> = viewChild<...>('<name>')`, so renaming
 *     the IR field renames BOTH the class field AND the viewChild SELECTOR
 *     string in lockstep — they are the same `r.name`).
 *   - every `$data.<name>` / `$refs.<name>` non-computed MemberExpression /
 *     OptionalMemberExpression property across the ENTIRE IR (the shared
 *     scriptProgram subtrees AND each template-expression subtree).
 *   - every SignalRef `{ scope: 'data', path: [name, ...] }` dep (refs are not
 *     reactive deps, so there is no `scope: 'ref'` to rename).
 *   - every template `ref="<name>"` STATIC attribute value (a plain string, not
 *     a Babel node) — the template emitter reads `attr.value` to produce the
 *     `#<name>` template-ref variable, which must match the renamed
 *     `viewChild('<name>$local')` selector.
 *
 * Mutates `ir` in place. Callers invoke it from their per-target emit
 * orchestrator (Angular: `emitAngular`) on the target's OWN IR (each `compile()`
 * call lowers a fresh IR per target — no cross-target leakage). Returns the
 * rename map (old → new) for diagnostics/tests; empty when nothing collided.
 * Only-on-collision: a non-reserved state/ref name is byte-identical.
 *
 * @param ir         the component IR (state[].name + refs[].name renamed).
 * @param reserved   the target's reserved class-member set (e.g.
 *                   `reservedClassMembers('angular', { singleModel })`).
 * @param protectedNames PUBLIC-CONTRACT names never renamed (prop names + $expose verbs).
 */
export function deconflictReservedDataRefNames(
  ir: {
    state: { name: string }[];
    refs: { name: string }[];
    props?: { name: string }[];
    expose?: { name: string }[];
  },
  reserved: ReadonlySet<string>,
  protectedNames: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const renames = new Map<string, string>();
  if (reserved.size === 0) return renames;

  // Public-contract names are NEVER renamed (D-02). Fold in IR-level props/expose
  // the caller may not have passed, so the guard is total.
  const protectedAll = new Set<string>([
    ...protectedNames,
    ...(ir.props ?? []).map((p) => p.name),
    ...(ir.expose ?? []).map((e) => e.name),
  ]);
  const consider = (name: string): void => {
    if (renames.has(name)) return;
    if (reserved.has(name) && !protectedAll.has(name)) {
      renames.set(name, alias(name));
    }
  };
  for (const s of ir.state) consider(s.name);
  for (const r of ir.refs) consider(r.name);
  if (renames.size === 0) return renames;

  // 1. Rename the IR declaration fields (codegen source of truth for the
  //    `signal()` field AND the `viewChild('<name>')` selector string).
  for (const s of ir.state) {
    const renamed = renames.get(s.name);
    if (renamed) s.name = renamed;
  }
  for (const r of ir.refs) {
    const renamed = renames.get(r.name);
    if (renamed) r.name = renamed;
  }

  // 2. Deep-walk the ENTIRE IR. For every embedded Babel node, rename a
  //    non-computed `$data.<old>` / `$refs.<old>` MemberExpression property.
  //    For every SignalRef `{ scope: 'data', path: [old, ...] }`, rename path[0].
  //    For every template static `{ kind: 'static', name: 'ref', value: <old> }`
  //    AttributeBinding, rename `value`. A WeakSet guards shared nodes / cycles.
  const seen = new WeakSet<object>();
  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    // SignalRef data-dep rename: { scope: 'data', path: [key, ...] }. (Refs are
    // not reactive deps — no scope: 'ref'.)
    const asDep = value as { scope?: unknown; path?: unknown };
    if (asDep.scope === 'data' && Array.isArray(asDep.path) && asDep.path.length > 0) {
      const head = asDep.path[0];
      const renamed = typeof head === 'string' ? renames.get(head) : undefined;
      if (renamed) asDep.path[0] = renamed;
    }

    // Template static `ref="<name>"` attribute value rename. A static
    // AttributeBinding is a plain object `{ kind:'static', name, value }` — NOT a
    // Babel node — so it is matched structurally, not via the isNode branch.
    const asAttr = value as { kind?: unknown; name?: unknown; value?: unknown };
    if (
      asAttr.kind === 'static' &&
      asAttr.name === 'ref' &&
      typeof asAttr.value === 'string'
    ) {
      const renamed = renames.get(asAttr.value);
      if (renamed) (value as { value: string }).value = renamed;
    }

    // `$data.<key>` / `$refs.<key>` MemberExpression / OptionalMemberExpression
    // property rename.
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
        (node.object.name === '$data' || node.object.name === '$refs') &&
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

/**
 * IR-LEVEL ref-vs-user-binding deconfliction for the ANGULAR target
 * (Spike-012 R3-5).
 *
 * DISTINCT from `deconflictReservedDataRefNames` (ref name collides with a
 * reserved CLASS MEMBER): here a `ref="X"` name collides with a TOP-LEVEL user
 * `<script>` binding of the same name (`const box = 0` / `let box = 1` /
 * `function box(){}`) that the Angular emitter promotes to a class field/method.
 * Both mint a `box` class member → duplicate declaration (TS2300), and the user
 * binding's bare references are wrongly lowered to the ref's `this.box()` signal
 * accessor. Neither the reserved-member pass nor the per-target clone rename sees
 * this: the ref name is not a reserved member, and it appears in the clone only as
 * the `$refs.box` member PROPERTY (which the bare-identifier pass skips).
 *
 * The renameable side is the REF (its class field, `viewChild()` selector, and
 * component-internal `#X` template-ref var are ALL internal — never consumer
 * contract), NOT the user binding: the user binding may itself be a public
 * `$expose` verb (`function box` + `$expose({ box })`), which is why the trigger
 * ignores `protectedNames` — renaming the internal ref is always safe. The ref is
 * renamed to a fresh `<name>Ref` (a `Ref` suffix rather than `$local`: it stays a
 * plain identifier, valid as an Angular `#template-ref` variable). This mirrors
 * what Solid already does UNCONDITIONALLY (every `$refs.X` lowers to a `<name>Ref`
 * local) — here it is applied only-on-collision so the non-colliding corpus is
 * byte-identical.
 *
 * Renames the ref IR field (`ir.refs[].name` — the codegen source of truth for
 * the field, the `viewChild('<name>')` selector, and the `$refs.<name>` rewrite),
 * every `$refs.<old>` non-computed MemberExpression property across the IR (script
 * + template subtrees), and every template static `ref="<old>"` attribute value
 * (which becomes the `#<name>` template-ref the selector must match). Refs are not
 * reactive deps, so there is no `scope:'ref'` to rename, and STATE is never touched.
 *
 * Mutates `ir` in place. Invoked from `emitAngular` on the target's OWN fresh IR
 * (each `compile()` lowers a fresh IR per target — no cross-target leakage), BEFORE
 * any emitter reads a ref name. Returns the rename map (old → new) for
 * tests/diagnostics; empty when nothing collided.
 *
 * @param ir                the component IR (colliding `refs[].name` renamed).
 * @param userBindingNames  top-level `<script>` binding names that become class
 *                          fields/methods (const/let/function ids; $computed
 *                          excluded — it is a getter, not a plain field).
 */
/**
 * Collect TOP-LEVEL `function X() {}` declaration names from a `<script>`
 * Program. Used by the React/Svelte ref-collision fix (Spike-012 R3-5): a
 * top-level function that shadows a `ref="X"` name is the ONE ref-collision the
 * bare-ident accessor-shadow pass cannot repair — a `const`/`let X` is renamed to
 * `X$local`, but a `function X` is skipped by the accessor group AND may be a
 * public `$expose` verb (whose name is fixed by the emitted handle). The
 * renameable side is therefore the internal ref, triggered on the function name.
 */
export function collectTopLevelFunctionNames(program: File): Set<string> {
  const names = new Set<string>();
  for (const stmt of program.program.body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) names.add(stmt.id.name);
  }
  return names;
}

export function deconflictRefsAgainstUserBindings(
  ir: {
    state: { name: string }[];
    refs: { name: string }[];
    computed?: { name: string }[];
    props?: { name: string }[];
  },
  userBindingNames: ReadonlySet<string>,
): Map<string, string> {
  const renames = new Map<string, string>();
  if (userBindingNames.size === 0 || ir.refs.length === 0) return renames;

  // Names already occupied across the class surface — the fresh `<name>Ref` must
  // avoid every ref/state/computed/prop AND every user binding.
  const taken = new Set<string>([
    ...ir.refs.map((r) => r.name),
    ...ir.state.map((s) => s.name),
    ...(ir.computed ?? []).map((c) => c.name),
    ...(ir.props ?? []).map((p) => p.name),
    ...userBindingNames,
  ]);
  const freshName = (base: string): string => {
    let candidate = `${base}Ref`;
    let i = 2;
    while (taken.has(candidate)) candidate = `${base}Ref${i++}`;
    taken.add(candidate);
    return candidate;
  };

  for (const r of ir.refs) {
    if (renames.has(r.name)) continue;
    // Trigger: a top-level user binding of the ref's name exists. `protectedNames`
    // is intentionally NOT consulted — we rename the INTERNAL ref, never the user
    // (possibly public `$expose`) binding, so a protected name is still a valid
    // trigger (the `function box` + `$expose({ box })` + `ref="box"` case).
    if (userBindingNames.has(r.name)) {
      renames.set(r.name, freshName(r.name));
    }
  }
  if (renames.size === 0) return renames;

  // 1. Rename the ref IR fields (field name + viewChild selector source of truth
  //    + `$refs.<name>` rewrite key — all read back from `ir.refs[].name`).
  for (const r of ir.refs) {
    const renamed = renames.get(r.name);
    if (renamed) r.name = renamed;
  }

  // 2. Deep-walk the ENTIRE IR: rename every `$refs.<old>` non-computed member
  //    property + every template static `ref="<old>"` attribute value. STATE and
  //    `$data.<key>` members are deliberately untouched.
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

/**
 * IR-LEVEL generated-binding / vue-import deconfliction for the VUE target
 * (Phase 61 Plan 07 — SC-2, collision-vue §3 risks 2 + 3).
 *
 * The Vue arm of the systemic "author flat namespace ∩ hidden generated symbols"
 * problem. THREE of the five internal author kinds lower on Vue via CODEGEN that
 * reads the name back from the IR — NOT from the cloned `<script>` Program — so
 * the per-target `deconflictGeneratedSymbols` program-walk (run inside
 * `rewriteRozieIdentifiers`) cannot reach them:
 *
 *   - `<data> X`      → `const X = ref(...)`           (emitted from `ir.state[].name`)
 *   - `$computed X`   → `const X = computed(...)`      (emitted from `ir.computed[].name`)
 *   - `$inject(...) X` → `const X = inject('k', f?)`   (emitted from `ir.injects[].localBinding`;
 *                          the `$inject` binder is STRIPPED from the residual body and
 *                          re-emitted by emitContext)
 *
 * Each collides with a GENERATED `<script setup>` binding
 * (`props`/`emit`/`slots`/`portals`/`portalContainers`) or a `'vue'`/runtime-vue
 * import (`ref`/`computed`/`watch`/`h`/`render`/`Fragment`/`debounce`/…): e.g. a
 * `<data> slots` → `const slots = ref(...)` after the generated `const slots =
 * useSlots()` → TS2451 redeclare; a `<data> ref` → `const ref = ref(...)` after
 * `import { ref } from 'vue'` → TS2440 import shadow.
 *
 * The OTHER two internal kinds — `<script>` HELPERS and `<script>` IMPORTS (+
 * function params) — ARE top-level declarators/specifiers in the cloned program,
 * so they ARE renamed by the `{ kind: 'binding' }` group added to `vueGroups`
 * (rewriteScript.ts). This pass closes the IR-sourced trio that the program-walk
 * structurally cannot see. Together they cover all five kinds.
 *
 * Distinct from `deconflictReservedDataRefNames` (Angular): that pass ALSO
 * renames `$refs` names. On Vue, `$refs.X` lowers to a SUFFIXED `XRef.value`
 * local (never a bare `const X`), so a `$refs` name can NEVER collide with one of
 * these generated bindings — and the rewriteScript `vueGroups` comment EXCLUDES
 * refs by design. So this pass deliberately renames state + computed + inject
 * ONLY, never refs (no `ref="X"` attribute rename, no `$refs.X` member rename).
 *
 * All three kinds are INTERNAL (template/script-referenced, never consumer-facing
 * public contract) → safe to auto-rename to `X$local`. References:
 *   - `<data> X`    → `$data.X` MEMBER expressions + `{ scope:'data', path:[X] }` deps
 *   - `$computed X` → BARE-identifier reads (no `$computed.X` member)
 *   - `$inject X`   → BARE-identifier reads (the `const X` binder + every read)
 * The bare-identifier kinds reuse the same position-guarded bare walk as the
 * computed/inject pass.
 *
 * Mutates `ir` in place. Invoked from `emitVue` on the target's OWN fresh IR
 * (each `compile()` lowers a fresh IR per target — no cross-target leakage),
 * BEFORE `emitScript` reads any name. Only-on-collision: a non-colliding
 * name is byte-identical (zero corpus drift). Returns the rename map for
 * tests/diagnostics; empty when nothing collided.
 *
 * @param ir       the component IR (state/computed/inject `.name`/`.localBinding` renamed).
 * @param reserved the Vue generated-binding set: VUE_EMITTER_BINDINGS ∪
 *                 VUE_IMPORT_NAMES ∪ VUE_RUNTIME_IMPORTS.
 * @param protectedNames PUBLIC-CONTRACT names never renamed (prop names + $expose verbs).
 */
export function deconflictVueGeneratedBindingNames(
  ir: {
    state: { name: string }[];
    computed: { name: string }[];
    injects?: { localBinding: string }[];
    props?: { name: string }[];
    expose?: { name: string }[];
  },
  reserved: ReadonlySet<string>,
  protectedNames: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const renames = new Map<string, string>();
  if (reserved.size === 0) return renames;

  // Public-contract names are NEVER renamed (D-02). Fold in IR-level props/expose
  // the caller may not have passed, so the guard is total.
  const protectedAll = new Set<string>([
    ...protectedNames,
    ...(ir.props ?? []).map((p) => p.name),
    ...(ir.expose ?? []).map((e) => e.name),
  ]);

  // `<data>` references are `$data.X` MEMBER expressions; `$computed` + `$inject`
  // references are BARE identifiers. Kept in separate maps because the two
  // reference shapes are disjoint and renamed by different walks.
  const dataRenames = new Map<string, string>();
  const bareRenames = new Map<string, string>();

  const considerInto = (map: Map<string, string>, name: string): void => {
    if (renames.has(name) || dataRenames.has(name) || bareRenames.has(name)) return;
    if (reserved.has(name) && !protectedAll.has(name)) {
      const renamed = alias(name);
      map.set(name, renamed);
      renames.set(name, renamed);
    }
  };
  for (const s of ir.state) considerInto(dataRenames, s.name);
  for (const c of ir.computed) considerInto(bareRenames, c.name);
  for (const inj of ir.injects ?? []) considerInto(bareRenames, inj.localBinding);
  if (renames.size === 0) return renames;

  // 1. Rename the IR declaration fields (codegen source of truth).
  for (const s of ir.state) {
    const renamed = dataRenames.get(s.name);
    if (renamed) s.name = renamed;
  }
  for (const c of ir.computed) {
    const renamed = bareRenames.get(c.name);
    if (renamed) c.name = renamed;
  }
  for (const inj of ir.injects ?? []) {
    const renamed = bareRenames.get(inj.localBinding);
    if (renamed) inj.localBinding = renamed;
  }

  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  // 2a. BARE-identifier rename of every `$computed` / `$inject` reference across
  //     the ENTIRE IR (these names are read bare — no member to gate on).
  //     Position guards skip the non-reference identifier slots (member-property,
  //     object-key, specifier ids). A declarator id / shorthand value / param IS
  //     a binding-or-reference of the renamed local and SHOULD be renamed.
  if (bareRenames.size > 0) {
    const seenNodes = new WeakSet<object>();
    const renameIn = (node: { type: string }, parent: { type: string } | null): void => {
      if (seenNodes.has(node)) return;
      seenNodes.add(node);
      if (node.type === 'Identifier') {
        const id = node as { type: string; name: string };
        const renamed = bareRenames.get(id.name);
        if (renamed && parent) {
          const p = parent as Record<string, unknown> & { type: string };
          const skip =
            ((p.type === 'MemberExpression' || p.type === 'OptionalMemberExpression') &&
              p['property'] === node && p['computed'] !== true) ||
            (p.type === 'ObjectProperty' && p['key'] === node &&
              p['computed'] !== true && p['shorthand'] !== true) ||
            ((p.type === 'ObjectMethod' || p.type === 'ClassMethod') &&
              p['key'] === node && p['computed'] !== true) ||
            p.type === 'ImportSpecifier' || p.type === 'ImportDefaultSpecifier' ||
            p.type === 'ImportNamespaceSpecifier' || p.type === 'ExportSpecifier';
          if (!skip) id.name = renamed;
        }
        return;
      }
      const rec = node as unknown as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' ||
            key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
          continue;
        }
        const child = rec[key];
        if (Array.isArray(child)) {
          for (const item of child) if (isNode(item)) renameIn(item, node);
        } else if (isNode(child)) {
          renameIn(child, node);
        }
      }
    };
    const bSeen = new WeakSet<object>();
    const bWalk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (bSeen.has(value)) return;
      bSeen.add(value);
      if (isNode(value)) { renameIn(value, null); return; }
      if (Array.isArray(value)) { for (const item of value) bWalk(item); return; }
      for (const k of Object.keys(value as Record<string, unknown>)) {
        bWalk((value as Record<string, unknown>)[k]);
      }
    };
    bWalk(ir);
  }

  // 2b. `$data.<key>` MEMBER rename + SignalRef `{ scope:'data', path:[key] }`
  //     dep rename across the ENTIRE IR (the `<data>` member-reference shape).
  //     NO `ref="X"` attribute rename and NO `$refs.X` member rename — refs are
  //     out of scope on Vue (they lower to a suffixed `XRef.value`).
  if (dataRenames.size > 0) {
    const seen = new WeakSet<object>();
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);

      const asDep = value as { scope?: unknown; path?: unknown };
      if (asDep.scope === 'data' && Array.isArray(asDep.path) && asDep.path.length > 0) {
        const head = asDep.path[0];
        const renamed = typeof head === 'string' ? dataRenames.get(head) : undefined;
        if (renamed) asDep.path[0] = renamed;
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
          node.object.name === '$data' &&
          node.property?.type === 'Identifier' &&
          typeof node.property.name === 'string'
        ) {
          const renamed = dataRenames.get(node.property.name);
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
  }

  return renames;
}

/**
 * IR-LEVEL generated-name deconfliction for the SOLID target (Phase 61 Plan 06 —
 * SC-2, collision-solid §"NEW risks" 1/2).
 *
 * Solid emits a plain function. `emitScript` mints the `<data>` getter, the
 * `$computed` memo const, and the `$refs.<name>` → `<name>Ref` ref local as
 * STRING lines built directly from the IR (`ir.state[].name` / `ir.computed[].name`
 * / `ir.refs[].name`) — NOT as declarators in the cloned `<script>` Program. So the
 * per-target `deconflictGeneratedSymbols` clone-walk (which renames USER `<script>`
 * helpers/params) cannot reach these GENERATED names. They collide:
 *
 *   - `<data>` / `$computed` name == a bare solid-js / runtime IMPORT
 *     (`children`/`on`/`For`/`createSignal`/…) → `const children = createSignal`
 *     after `import { children }` → TS2440/TS2451. (A default-slot component
 *     imports `children` + emits `const resolved = children(...)`.)
 *   - `<data>` / `$computed` name == an emitter LOCAL (`local`/`attrs`/`_merged`/
 *     `resolved`/`portals`/…) → TS2451.
 *   - `<data> x` == `$computed x` == model-prop `x` (cross-kind siblings) → two
 *     top-level `const x` → TS2451.
 *
 * All three GENERATED names are INTERNAL (template/script-referenced, never the
 * consumer-facing public contract) → safe to auto-rename to `X$local`. Renaming
 * the IR source-of-truth field renames the emitted const, the `<name>Ref` ref
 * local (the `Ref` suffix is appended by the rewrite from `ir.refs[].name`), the
 * `viewChild`-free Solid ref callback, AND every reference (script + template
 * subtrees) in lockstep. `<data>`/`$refs` references are `$data.X` / `$refs.X`
 * MEMBER expressions; `$computed` references are BARE identifiers — both shapes are
 * renamed. Cross-kind collisions rename the LATER kind (computed before data before
 * model-prop is the priority — model-prop name is closest to public contract among
 * the three INTERNAL kinds, so it wins the bare name; the `$expose` verbs + prop
 * names passed in `protectedNames` are NEVER renamed).
 *
 * Mutates `ir` in place. Invoked from `emitSolid` on the target's OWN fresh IR
 * (each `compile()` lowers a fresh IR per target — no cross-target leakage), BEFORE
 * any rewrite reads a name. Only-on-collision: a non-colliding name is
 * byte-identical (zero corpus drift). Returns the rename map for tests/diagnostics.
 *
 * @param ir       the component IR (state/computed/refs `.name` renamed).
 * @param reserved the Solid reserved set: SOLID_EMITTER_LOCALS ∪ SOLID_IMPORT_NAMES.
 * @param protectedNames PUBLIC-CONTRACT names never renamed (prop names + $expose verbs).
 */
export function deconflictSolidGeneratedNames(
  ir: {
    state: { name: string }[];
    computed: { name: string }[];
    refs: { name: string }[];
    props?: { name: string }[];
    expose?: { name: string }[];
  },
  reserved: ReadonlySet<string>,
  protectedNames: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const protectedAll = new Set<string>([
    ...protectedNames,
    ...(ir.props ?? []).map((p) => p.name),
    ...(ir.expose ?? []).map((e) => e.name),
  ]);
  const modelPropNames = new Set<string>(
    (ir.props ?? []).filter((p) => (p as { isModel?: boolean }).isModel).map((p) => p.name),
  );

  // dataRenames go through the `$data.X` MEMBER path; computedRenames through the
  // BARE-identifier path; refRenames through the `$refs.X` MEMBER + `ref="X"` attr
  // path. Kept separate because the reference shapes are disjoint.
  const dataRenames = new Map<string, string>();
  const computedRenames = new Map<string, string>();
  const refRenames = new Map<string, string>();

  // Synthesized-internal names (the `$el` root ref `__rozieRoot`, etc.) are minted
  // by the lowering passes themselves and have dedicated rewrite handling
  // (`$refs.__rozieRoot` → `__rozieRootRef`). They are NOT author bindings and must
  // never be renamed. NOTE `__rozieRoot` is intentionally ALSO in
  // SOLID_EMITTER_LOCALS (so a USER ref/data/computed literally named `__rozieRoot`
  // would still collide with the emitter local) — so guard by the reserved `__rozie`
  // prefix, which a normal author name never carries.
  const isSynthesizedInternal = (name: string): boolean => name.startsWith('__rozie');

  // `taken` tracks every name already claimed at module/function scope so a rename
  // does not re-collide. Seed with the reserved set + model-prop names (these are
  // emitted regardless and are never renamed by this pass) + the public-contract
  // names. As each INTERNAL kind is processed it claims its (possibly renamed) name.
  const taken = new Set<string>([...reserved, ...modelPropNames, ...protectedAll]);
  const freshName = (base: string): string => {
    let candidate = `${base}${DECONFLICT_SUFFIX}`;
    while (taken.has(candidate)) candidate = `${candidate}${DECONFLICT_SUFFIX}`;
    return candidate;
  };

  // Process order: model-prop names already in `taken` (win the bare name). Then
  // `<data>` (renames on reserve/model collision), then `$computed` (renames on
  // reserve/model/data collision) — so a `<data> x` + `$computed x` pair renames
  // the COMPUTED side, leaving exactly one top-level `const x`.
  for (const s of ir.state) {
    if (protectedAll.has(s.name) || isSynthesizedInternal(s.name)) { taken.add(s.name); continue; }
    if (taken.has(s.name)) {
      dataRenames.set(s.name, freshName(s.name));
      taken.add(dataRenames.get(s.name)!);
    } else {
      taken.add(s.name);
    }
  }
  for (const c of ir.computed) {
    if (protectedAll.has(c.name) || isSynthesizedInternal(c.name)) { taken.add(c.name); continue; }
    if (taken.has(c.name)) {
      computedRenames.set(c.name, freshName(c.name));
      taken.add(computedRenames.get(c.name)!);
    } else {
      taken.add(c.name);
    }
  }
  for (const r of ir.refs) {
    if (protectedAll.has(r.name) || isSynthesizedInternal(r.name)) { taken.add(`${r.name}Ref`); continue; }
    // The ref lands as `<name>Ref` — collision is only with a reserved/taken
    // `<name>Ref` string. Use the suffixed form for the collision check.
    const refLocal = `${r.name}Ref`;
    if (taken.has(refLocal) || taken.has(r.name)) {
      refRenames.set(r.name, freshName(r.name));
      taken.add(`${refRenames.get(r.name)!}Ref`);
    } else {
      taken.add(refLocal);
    }
  }

  const renames = new Map<string, string>([
    ...dataRenames,
    ...computedRenames,
    ...refRenames,
  ]);
  if (renames.size === 0) return renames;

  // 1. Rename the IR declaration fields themselves (codegen source of truth).
  for (const s of ir.state) {
    const renamed = dataRenames.get(s.name);
    if (renamed) s.name = renamed;
  }
  for (const c of ir.computed) {
    const renamed = computedRenames.get(c.name);
    if (renamed) c.name = renamed;
  }
  for (const r of ir.refs) {
    const renamed = refRenames.get(r.name);
    if (renamed) r.name = renamed;
  }

  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  // 2a. BARE-identifier rename of every `$computed`-name reference (a `$computed`
  //     is read bare). Position guards skip non-reference identifier slots.
  if (computedRenames.size > 0) {
    const seenNodes = new WeakSet<object>();
    const renameIn = (node: { type: string }, parent: { type: string } | null): void => {
      if (seenNodes.has(node)) return;
      seenNodes.add(node);
      if (node.type === 'Identifier') {
        const id = node as { type: string; name: string };
        const renamed = computedRenames.get(id.name);
        if (renamed && parent) {
          const p = parent as Record<string, unknown> & { type: string };
          const skip =
            ((p.type === 'MemberExpression' || p.type === 'OptionalMemberExpression') &&
              p['property'] === node && p['computed'] !== true) ||
            (p.type === 'ObjectProperty' && p['key'] === node &&
              p['computed'] !== true && p['shorthand'] !== true) ||
            ((p.type === 'ObjectMethod' || p.type === 'ClassMethod') &&
              p['key'] === node && p['computed'] !== true) ||
            p.type === 'ImportSpecifier' || p.type === 'ImportDefaultSpecifier' ||
            p.type === 'ImportNamespaceSpecifier' || p.type === 'ExportSpecifier';
          if (!skip) id.name = renamed;
        }
        return;
      }
      const rec = node as unknown as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' ||
            key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
          continue;
        }
        const child = rec[key];
        if (Array.isArray(child)) {
          for (const item of child) if (isNode(item)) renameIn(item, node);
        } else if (isNode(child)) {
          renameIn(child, node);
        }
      }
    };
    const cSeen = new WeakSet<object>();
    const cWalk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (cSeen.has(value)) return;
      cSeen.add(value);
      if (isNode(value)) { renameIn(value, null); return; }
      if (Array.isArray(value)) { for (const item of value) cWalk(item); return; }
      for (const k of Object.keys(value as Record<string, unknown>)) {
        cWalk((value as Record<string, unknown>)[k]);
      }
    };
    cWalk(ir);
  }

  // 2b. MEMBER rename of every `$data.<old>` / `$refs.<old>` reference + SignalRef
  //     data dep + template `ref="<old>"` static attribute value.
  const memberRenames = new Map<string, string>([...dataRenames, ...refRenames]);
  if (memberRenames.size > 0) {
    const seen = new WeakSet<object>();
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);

      const asDep = value as { scope?: unknown; path?: unknown };
      if (asDep.scope === 'data' && Array.isArray(asDep.path) && asDep.path.length > 0) {
        const head = asDep.path[0];
        const renamed = typeof head === 'string' ? dataRenames.get(head) : undefined;
        if (renamed) asDep.path[0] = renamed;
      }

      const asAttr = value as { kind?: unknown; name?: unknown; value?: unknown };
      if (asAttr.kind === 'static' && asAttr.name === 'ref' && typeof asAttr.value === 'string') {
        const renamed = refRenames.get(asAttr.value);
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
          node.property?.type === 'Identifier' &&
          typeof node.property.name === 'string'
        ) {
          if (node.object.name === '$data') {
            const renamed = dataRenames.get(node.property.name);
            if (renamed) node.property.name = renamed;
          } else if (node.object.name === '$refs') {
            const renamed = refRenames.get(node.property.name);
            if (renamed) node.property.name = renamed;
          }
        }
      }

      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      for (const key of Object.keys(value)) walk((value as Record<string, unknown>)[key]);
    };
    walk(ir);
  }

  return renames;
}

/**
 * CLASS-TARGET reserved-member deconfliction (Phase 46 ITEM-5 / D-02 — the NEW
 * collision class). DISTINCT from the bare-ident accessor-shadow above: the
 * trigger here is "a USER TOP-LEVEL `<script>` binding becomes a CLASS FIELD
 * whose name is in the target's reserved set" — overriding an inherited
 * `Object.prototype` member (Angular + Lit) or `HTMLElement`/`Element`/`Node`
 * member (Lit) breaks assignability (the listbox `valueOf` cascade → TS1240/
 * TS1271 on every decorator; the Embla `scrollTo` / rete `nodeType` findings).
 *
 * Scoped to PROGRAM-LEVEL bindings ONLY: only top-level `<script>` declarations
 * (`const`/`let`/`var` declarators + `function` declarations) become class
 * fields/methods on Angular/Lit. A function-LOCAL named `id`/`style`/`focus`
 * stays a plain local and must NOT be renamed. Same `X$local` suffix, same
 * only-on-collision discipline (a top-level binding whose name is NOT reserved
 * is byte-identical).
 *
 * MUST run on the freshly-cloned, not-yet-mutated Program (scope cache valid),
 * the same timing as the accessor-shadow pass.
 */
export function deconflictReservedClassFields(
  program: File,
  reserved: ReadonlySet<string>,
  /**
   * PUBLIC-CONTRACT names that must NEVER be renamed even when they collide with
   * a reserved member: `$expose` verb names and prop names (D-02). A top-level
   * `focus` helper that is the EXPOSED `focus()` method stays `focus` — the
   * public handle is the contract, and the inherited-member override is the
   * intended Lit/Angular behavior for a deliberately-exposed element method.
   */
  protectedNames: ReadonlySet<string> = new Set(),
): void {
  if (reserved.size === 0) return;
  const programBody = program.program.body;

  // Collect the top-level binding names that would become class fields/methods.
  const renameTargets = new Set<string>();
  for (const stmt of programBody) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        const id = decl.id;
        // Only simple Identifier declarators become a single named class field.
        // (Destructured top-level declarators are not a Rozie class-field idiom;
        // leave them untouched.)
        if (t.isIdentifier(id) && reserved.has(id.name) && !protectedNames.has(id.name)) {
          renameTargets.add(id.name);
        }
      }
    } else if (
      t.isFunctionDeclaration(stmt) &&
      stmt.id &&
      reserved.has(stmt.id.name) &&
      !protectedNames.has(stmt.id.name)
    ) {
      renameTargets.add(stmt.id.name);
    }
  }
  if (renameTargets.size === 0) return;

  // Rename via the binding's OWN (program) scope so the declaration + every
  // reference is updated atomically. We traverse so Babel builds the scope graph.
  traverse(program, {
    Program(path) {
      for (const name of renameTargets) {
        // Only rename if the binding is actually program-scoped (a top-level
        // declaration). A binding shadowed deeper is handled by its own scope.
        const binding = path.scope.getBinding(name);
        if (binding && binding.scope === path.scope) {
          path.scope.rename(name, alias(name));
        }
      }
      path.stop();
    },
  });
}

/** The import-binding deconfliction suffix (Phase 61). Distinct from `$local`
 *  so the two collision classes are visually separable in emitted output. */
export const IMPORT_DECONFLICT_SUFFIX = '$import';

/**
 * IMPORT-BINDING deconfliction (Phase 61 Plan 04 — SC-2, the floating-ui
 * `offset`/`arrow` catalogue case).
 *
 * A `<script>` value-import LOCAL whose name collides with an author PROP (which
 * the class targets rewrite to `this.<name>()`) or with a reserved class member
 * is INTERNAL-ish — the imported binding is the renameable side; the EXPORT name
 * and the PROP are public contract and untouched. The collision manifests on
 * Angular as a bare `{ offset }` object-shorthand resolving to `this.offset()`
 * (the prop signal) instead of the imported value → TS2322 at ng-packagr (gate
 * 4); the imported `offset` is also tree-shaken because nothing references it.
 *
 * The fix AUTO-ALIASES the import binding to `<name>$import` (e.g.
 * `import { offset as offset$import } from '@floating-ui/dom'`) and rewrites
 * every reference in the program scope in lockstep, via `scope.rename` (atomic
 * over the specifier + all references — Babel inserts the `as` alias on a named
 * specifier automatically and preserves the export name). The author prop
 * `offset` is never renamed; its `this.offset()` lowering is unaffected.
 *
 * Scoped to top-level `ImportDeclaration` specifiers ONLY (default, namespace,
 * named — value imports; type-only specifiers are skipped because they erase).
 * Runs on the freshly-cloned, not-yet-mutated Program (scope cache valid),
 * BEFORE the import-partition + the identifier rewrite. Only-on-collision: an
 * import whose local name collides with no prop / reserved member is
 * byte-identical. Mutates `program` in place; returns the rename map for tests.
 *
 * @param program     the cloned `<script>` Program (imports still in body).
 * @param collisionSet author prop names ∪ the target's reserved class-member set.
 */
export function deconflictReservedImportBindings(
  program: File,
  collisionSet: ReadonlySet<string>,
): Map<string, string> {
  const renames = new Map<string, string>();
  if (collisionSet.size === 0) return renames;

  // Collect colliding VALUE-import local names from top-level ImportDeclarations.
  const targets = new Set<string>();
  for (const stmt of program.program.body) {
    if (!t.isImportDeclaration(stmt)) continue;
    // A whole `import type … from …` declaration erases — no runtime binding.
    if (stmt.importKind === 'type') continue;
    for (const spec of stmt.specifiers) {
      // `import { type X }` named specifiers are type-only — skip.
      if (t.isImportSpecifier(spec) && spec.importKind === 'type') continue;
      const local = spec.local.name;
      if (collisionSet.has(local)) {
        targets.add(local);
        renames.set(local, `${local}${IMPORT_DECONFLICT_SUFFIX}`);
      }
    }
  }
  if (targets.size === 0) return renames;

  // Rename atomically via the program scope (declaration alias + every reference).
  traverse(program, {
    Program(path) {
      for (const name of targets) {
        const binding = path.scope.getBinding(name);
        if (binding && binding.scope === path.scope) {
          path.scope.rename(name, `${name}${IMPORT_DECONFLICT_SUFFIX}`);
        }
      }
      path.stop();
    },
  });

  return renames;
}

/**
 * Inherited `HTMLElement` / `Element` / `Node` instance members — reserved on
 * LIT ONLY (its component class `extends LitElement` → `HTMLElement`). A user
 * local that becomes a Lit class field named e.g. `focus`/`scrollTo`/`nodeType`
 * overrides the inherited member and breaks assignability (the Embla `scrollTo`
 * and rete `nodeType` findings).
 *
 * Per RESEARCH A2 / Pitfall 4 the set is DERIVED from the prototype chain at
 * runtime rather than hand-listed, so it stays complete as the DOM evolves:
 * `Node`/`Element`/`HTMLElement` are present in the Node 20+ test/runtime
 * environment via the same JS engine globals the compiler runs under. We walk
 * the own-property names up the three prototypes. A pure-Node environment
 * without DOM globals falls back to a conservative curated seed so the reserved
 * set is never empty (Pitfall 4 — an incomplete set lets a collision slip).
 */
function deriveLitDomMembers(): Set<string> {
  const out = new Set<string>();
  const idShaped = (n: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n);
  const collect = (proto: object | null | undefined): void => {
    let p: object | null = (proto as object) ?? null;
    while (p && p !== Object.prototype) {
      for (const n of Object.getOwnPropertyNames(p)) {
        if (idShaped(n) && n !== 'constructor') out.add(n);
      }
      p = Object.getPrototypeOf(p) as object | null;
    }
  };
  // Walk HTMLElement → Element → Node → EventTarget prototypes when the DOM
  // globals exist (jsdom / happy-dom / browser); otherwise the seed below is
  // the floor.
  const g = globalThis as unknown as Record<string, { prototype?: object }>;
  collect(g.HTMLElement?.prototype);
  collect(g.Element?.prototype);
  collect(g.Node?.prototype);
  collect(g.EventTarget?.prototype);

  // Conservative curated seed — guarantees the set is COMPLETE (the full Group A
  // DOM chain) even in a bare-Node compiler process with no DOM globals.
  // Phase 61-01: seeded from the hardcoded `LIT_DOM_MEMBERS` table
  // (reservedNames.ts, transcribed verbatim from collision-lit §2 Group A) so a
  // bare-Node compile still covers `popover`/`inert`/`aria*`/`enterKeyHint`/… —
  // closes R-NEW-6 (those names previously slipped the auto-rename when no DOM
  // globals filled the runtime walk). Superset-safe: an extra name only ever
  // renames a USER local that collides, never a generated symbol.
  for (const n of LIT_DOM_MEMBERS) {
    out.add(n);
  }
  return out;
}

export const LIT_DOM_INHERITED_MEMBERS: ReadonlySet<string> = deriveLitDomMembers();

/**
 * The reserved-class-member name set for a class target.
 *
 * Phase 61-01 widened both targets to consume the shared `reservedNames.ts`
 * tables (the single source of truth — Half B's lint validator reads the same
 * tables, so the two halves never drift):
 *
 *   - Lit: `Object.prototype` ∪ inherited DOM members (full Group A via the
 *     completed `deriveLitDomMembers()` seed) ∪ Lit lifecycle members (Group C —
 *     `render`/`requestUpdate`/`updated`/… — closes R-NEW-2) ∪ Lit emitter
 *     members (Group D unconditional names).
 *   - Angular: `Object.prototype` ∪ lifecycle hooks + `constructor`
 *     (`ANGULAR_LIFECYCLE_MEMBERS`) ∪ emitter internals
 *     (`ANGULAR_EMITTER_MEMBERS`). The CVA quartet
 *     (`ANGULAR_CVA_MEMBERS`) is folded in ONLY behind the single-model gate —
 *     pass `{ singleModel: true }` (it is reserved only when the component has
 *     exactly one `model:true` prop and `cva !== false`). With no opts the
 *     Angular set is a SUPERSET of the pre-61 set (which was Object.prototype
 *     only); the only-on-collision discipline (above, lines 27-29) keeps the
 *     corpus byte-identical for any component whose author names none of the
 *     newly-added reserved members.
 */
export function reservedClassMembers(
  target: 'angular' | 'lit',
  opts?: { singleModel?: boolean },
): ReadonlySet<string> {
  if (target === 'angular') {
    const merged = new Set<string>(OBJECT_PROTOTYPE_MEMBERS);
    for (const n of ANGULAR_LIFECYCLE_MEMBERS) merged.add(n);
    for (const n of ANGULAR_EMITTER_MEMBERS) merged.add(n);
    if (opts?.singleModel) {
      for (const n of ANGULAR_CVA_MEMBERS) merged.add(n);
    }
    return merged;
  }
  const merged = new Set<string>(OBJECT_PROTOTYPE_MEMBERS);
  for (const n of LIT_DOM_INHERITED_MEMBERS) merged.add(n);
  for (const n of LIT_LIFECYCLE_MEMBERS) merged.add(n);
  for (const n of LIT_EMITTER_MEMBERS) merged.add(n);
  return merged;
}
