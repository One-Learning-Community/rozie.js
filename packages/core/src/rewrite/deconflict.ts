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
   */
  trigger: { kind: 'accessor'; accessor: string } | { kind: 'binding' };
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
    if (group.trigger.kind === 'binding') return true;
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
        const ownerScope = path.scope.parent ?? path.scope;
        ownerScope.rename(name, alias(name));
      }
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

  // Conservative curated seed (the members the listbox/Embla/rete findings hit
  // plus the common DOM surface) — guarantees the set is non-empty even in a
  // bare-Node compiler process with no DOM globals. Superset-safe: extra names
  // only ever rename a USER local that collides, never a generated symbol.
  for (const n of [
    // Node
    'nodeType', 'nodeName', 'nodeValue', 'parentNode', 'parentElement',
    'childNodes', 'firstChild', 'lastChild', 'nextSibling', 'previousSibling',
    'textContent', 'ownerDocument', 'appendChild', 'removeChild', 'replaceChild',
    'insertBefore', 'cloneNode', 'contains', 'isConnected', 'getRootNode',
    // EventTarget
    'addEventListener', 'removeEventListener', 'dispatchEvent',
    // Element
    'id', 'className', 'classList', 'tagName', 'attributes', 'innerHTML',
    'outerHTML', 'getAttribute', 'setAttribute', 'removeAttribute',
    'hasAttribute', 'querySelector', 'querySelectorAll', 'closest', 'matches',
    'getBoundingClientRect', 'scrollTo', 'scrollIntoView', 'scrollTop',
    'scrollLeft', 'scrollWidth', 'scrollHeight', 'clientWidth', 'clientHeight',
    'part', 'slot', 'shadowRoot', 'attachShadow',
    // HTMLElement
    'focus', 'blur', 'click', 'title', 'hidden', 'style', 'dataset', 'tabIndex',
    'innerText', 'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft',
    'offsetParent', 'contentEditable', 'isContentEditable', 'lang', 'dir',
    'draggable', 'accessKey', 'autofocus',
  ]) {
    out.add(n);
  }
  return out;
}

export const LIT_DOM_INHERITED_MEMBERS: ReadonlySet<string> = deriveLitDomMembers();

/**
 * The reserved-class-member name set for a class target. Angular gets the
 * `Object.prototype` members; Lit gets those PLUS the inherited DOM members.
 */
export function reservedClassMembers(target: 'angular' | 'lit'): ReadonlySet<string> {
  if (target === 'angular') return OBJECT_PROTOTYPE_MEMBERS;
  const merged = new Set<string>(OBJECT_PROTOTYPE_MEMBERS);
  for (const n of LIT_DOM_INHERITED_MEMBERS) merged.add(n);
  return merged;
}
