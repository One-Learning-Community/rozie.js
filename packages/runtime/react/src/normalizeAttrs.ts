/**
 * normalizeAttrs — Phase 14 (attribute fallthrough) runtime helper.
 *
 * The D-03 hybrid: a `.rozie` author's `r-bind="<expr>"` object-spread is
 * key-normalized to React-DOM naming so HTML-shape attribute names work on a
 * React host element.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   r-bind="{ class: 'btn', for: 'x' }"  is a LITERAL — the React emitter
 *   walks the ObjectExpression and renames keys at compile time, emitting
 *   `{...{ className: 'btn', htmlFor: 'x' }}` directly.
 *
 * Runtime path (this helper — used only when the compile-time walk can't
 * apply, i.e. the `r-bind` expression is NOT an object literal):
 *   r-bind="someObj"          →  {...normalizeAttrs(someObj)}
 *   r-bind="cond ? a : b"     →  {...normalizeAttrs(cond ? a : b)}
 *
 * The `$attrs` magic accessor is EXEMPT (D-04): a `$attrs` cluster already
 * carries target-native keys (the consumer wrote `className`, not `class`),
 * so the React emitter spreads it WITHOUT a normalizeAttrs wrap.
 *
 * SECURITY (T-14-05 — prototype pollution): the keys of a dynamic `r-bind`
 * object may be consumer- or data-controlled. Keys matching `__proto__`,
 * `constructor`, or `prototype` are SKIPPED — never copied to the output —
 * and the output is built on a null-prototype object. Mirrors the Phase 02
 * `collectPropDecls` write-time guard.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */

/** Keys whose presence in attacker-controllable input is a pollution vector. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * HTML attribute name → React-DOM property name. Covers the long-tail of DOM
 * attrs whose React JSX prop name does NOT match the lowercased HTML name 1:1.
 * `aria-*` and `data-*` keys are NOT listed — React accepts them lowercased
 * and hyphenated, so they pass through verbatim.
 *
 * @public — paired with `normalizeAttrs`, mirroring `parseInlineStyle` +
 * `toStyleObjectKey`. Exported so tooling / tests can introspect the table.
 */
export const REACT_ATTR_KEY_MAP: Readonly<Record<string, string>> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autocapitalize: 'autoCapitalize',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
  srcset: 'srcSet',
  enctype: 'encType',
  novalidate: 'noValidate',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  referrerpolicy: 'referrerPolicy',
  usemap: 'useMap',
  acceptcharset: 'acceptCharset',
  hreflang: 'hrefLang',
  datetime: 'dateTime',
};

/**
 * Key-remap a dynamic `r-bind` object to React-DOM naming.
 *
 * - HTML-shape keys in `REACT_ATTR_KEY_MAP` are renamed (`class`→`className`, …).
 * - All other keys pass through verbatim (including `aria-*` / `data-*`).
 * - `__proto__` / `constructor` / `prototype` keys are SKIPPED (T-14-05).
 *
 * Returns a plain object suitable for a React JSX `{...obj}` spread.
 */
export function normalizeAttrs(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Build on a null-prototype object so a remapped key can never collide with
  // an inherited Object.prototype member.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    // SECURITY (T-14-05) — never copy a pollution-vector key.
    if (FORBIDDEN_KEYS.has(key)) continue;
    const mapped = REACT_ATTR_KEY_MAP[key] ?? key;
    out[mapped] = obj[key];
  }
  return out;
}

/**
 * Quick 260804-f15 — the COMPONENT-tag counterpart of `normalizeAttrs`.
 *
 * WHY IT EXISTS: a `<Component>` tag does not receive DOM attribute names — it
 * receives the child's DECLARED prop names. A Rozie React child's props
 * interface is generated from its `<props>` block, so it declares `readonly`,
 * `tabindex`, `for` exactly as authored. Running the DOM alias table over a
 * dynamic `r-bind` object bound for such a child renames those keys to
 * `readOnly` / `tabIndex` / `htmlFor` and the props SILENTLY NEVER ARRIVE.
 * This is the runtime twin of the compile-time component branch
 * `rbindKeyToJsxName` (`targets/react/src/emit/emitTemplateAttribute.ts:531-540`,
 * quick 260804-4cy) — so the LITERAL and DYNAMIC `r-bind` paths are now
 * semantically identical on a component tag.
 *
 * SECURITY: the `FORBIDDEN_KEYS` strip is deliberately IDENTICAL to
 * `normalizeAttrs` and shares the same module-level const, so the prototype-
 * pollution semantics of the two functions CANNOT drift (T-14-05). This is the
 * entire reason an emitter-only gate was impossible: emitting a bare
 * `{...obj}` on a component tag would have traded a naming bug for a
 * pollution regression.
 *
 * `class`→`className` IS STILL APPLIED, and it is the one deliberate exception
 * (D-02, quick 260804-4cy `ccc2225a`). `className` is React's universal
 * class-prop name, not an HTML-attribute alias: a Rozie-compiled React child
 * reads its class through `attrs.className`
 * (`packages/ui/switch/packages/react/src/Switch.tsx:47,97`) while its props
 * interface declares the raw authored names (`Switch.d.ts:21`), and a raw
 * `class` reaching a DOM node makes React warn `Invalid DOM property 'class'`.
 * Do not "simplify" this rename away — `normalizeComponentAttrs` is a ROLE
 * name, not a mechanism name, precisely so this clause has somewhere to live.
 *
 * The Solid twin has NO such exception: `class` is absent from
 * `SOLID_ATTR_KEY_MAP` by design and Solid JSX takes `class` natively.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export function normalizeComponentAttrs(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Build on a null-prototype object so a copied key can never collide with an
  // inherited Object.prototype member — same invariant as `normalizeAttrs`.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    // SECURITY (T-14-05) — never copy a pollution-vector key. Shared const.
    if (FORBIDDEN_KEYS.has(key)) continue;
    // D-02 — the ONE rename kept on a component tag. Case-insensitive, to
    // preserve the lookup semantics of the map path this branch replaces.
    out[key.toLowerCase() === 'class' ? 'className' : key] = obj[key];
  }
  return out;
}
