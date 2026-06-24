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
  LIT_DOM_MEMBERS,
  LIT_LIFECYCLE_MEMBERS,
  LIT_EMITTER_MEMBERS,
  ANGULAR_CVA_MEMBERS,
  ANGULAR_LIFECYCLE_MEMBERS,
  ANGULAR_EMITTER_MEMBERS,
} from './reservedNames.js';

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
    | { kind: 'binding' }
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
 */
export function deconflictStateExposeCollision(ir: {
  state: { name: string }[];
  expose?: { name: string }[];
}): void {
  const exposeVerbs = new Set((ir.expose ?? []).map((e) => e.name));
  if (exposeVerbs.size === 0) return;
  const renames = new Map<string, string>();
  for (const s of ir.state) {
    if (exposeVerbs.has(s.name)) {
      const renamed = `${s.name}${DECONFLICT_SUFFIX}`;
      renames.set(s.name, renamed);
    }
  }
  if (renames.size === 0) return;

  // 1. Rename the state declarations themselves.
  for (const s of ir.state) {
    const renamed = renames.get(s.name);
    if (renamed) s.name = renamed;
  }

  // 2. Deep-walk the ENTIRE IR. For every embedded Babel node, rename a
  //    non-computed `$data.<oldKey>` MemberExpression property to the new key.
  //    For every SignalRef `{ scope: 'data', path: [oldKey, ...] }`, rename
  //    path[0]. A WeakSet guards against re-visiting shared nodes / cycles.
  const seen = new WeakSet<object>();
  const isNode = (v: unknown): v is { type: string } =>
    !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    // SignalRef data-dep rename: { scope: 'data', path: [key, ...] }.
    const asDep = value as { scope?: unknown; path?: unknown };
    if (asDep.scope === 'data' && Array.isArray(asDep.path) && asDep.path.length > 0) {
      const head = asDep.path[0];
      const renamed = typeof head === 'string' ? renames.get(head) : undefined;
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

/**
 * `Object.prototype` member names — reserved on BOTH class targets (Angular +
 * Lit) because every emitted component class inherits them. A user LOCAL that
 * becomes a class field with one of these names overrides the inherited member;
 * on Lit the legacy `@property` decorator's `Object`-assignability check then
 * cascades TS1240/TS1271 to EVERY decorator on the class (the listbox `valueOf`
 * finding — 38 errors from one name).
 *
 * Derived from `Object.getOwnPropertyNames(Object.prototype)` (the enumerable +
 * non-enumerable own members of `Object.prototype`), filtered to the
 * identifier-shaped members (excludes the symbol-keyed `__proto__` accessor
 * pair, which cannot collide with a JS identifier binding).
 */
export const OBJECT_PROTOTYPE_MEMBERS: ReadonlySet<string> = new Set(
  Object.getOwnPropertyNames(Object.prototype).filter(
    (n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n),
  ),
);

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
