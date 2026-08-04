/**
 * normalizeAttrs — Phase 14 (attribute fallthrough) runtime helper, Solid.
 *
 * The D-03 hybrid: a `.rozie` author's `r-bind="<expr>"` object-spread is
 * key-normalized to Solid-JSX naming so HTML-shape attribute names work on a
 * Solid host element.
 *
 * Compile-time path (preferred — zero runtime cost):
 *   r-bind="{ for: 'x', class: 'btn' }"  is a LITERAL — the Solid emitter
 *   walks the ObjectExpression and renames keys at compile time.
 *
 * Runtime path (this helper — used only when the compile-time walk can't
 * apply, i.e. the `r-bind` expression is NOT an object literal):
 *   r-bind="someObj"          →  {...normalizeAttrs(someObj)}
 *
 * SOLID DIFFERENCE: Solid JSX supports `class` natively — it is NOT remapped
 * to `className`. Only `for`→`htmlFor` and the other shared React-DOM property
 * names that Solid honors are remapped.
 *
 * The `$attrs` magic accessor is EXEMPT (D-04): a `$attrs` cluster already
 * carries target-native keys, so the Solid emitter spreads it WITHOUT a wrap.
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
 * HTML attribute name → Solid-JSX property name. Covers the long-tail of DOM
 * attrs whose Solid JSX prop name does NOT match the lowercased HTML name 1:1.
 *
 * UNLIKE the React map, `class` is ABSENT — Solid keeps `class` as `class`.
 * `aria-*` and `data-*` keys are NOT listed — they pass through verbatim.
 *
 * @public — paired with `normalizeAttrs`, mirroring `parseInlineStyle` +
 * `toStyleObjectKey`. Exported so tooling / tests can introspect the table.
 */
export const SOLID_ATTR_KEY_MAP: Readonly<Record<string, string>> = {
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
 * Key-remap a dynamic `r-bind` object to Solid-JSX naming.
 *
 * - HTML-shape keys in `SOLID_ATTR_KEY_MAP` are renamed (`for`→`htmlFor`, …).
 * - `class` is KEPT as `class` (Solid difference).
 * - All other keys pass through verbatim (including `aria-*` / `data-*`).
 * - `__proto__` / `constructor` / `prototype` keys are SKIPPED (T-14-05).
 *
 * Returns a plain object suitable for a Solid JSX `{...obj}` spread.
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
    const mapped = SOLID_ATTR_KEY_MAP[key] ?? key;
    out[mapped] = obj[key];
  }
  return out;
}

/**
 * Quick 260804-f15 — the COMPONENT-tag counterpart of `normalizeAttrs`.
 *
 * WHY IT EXISTS: a `<Component>` tag does not receive DOM attribute names — it
 * receives the child's DECLARED prop names. A Rozie Solid child's `splitProps`
 * key list is built from its `ir.props`, so it declares `readonly`, `tabindex`,
 * `for` exactly as authored. Running the DOM alias table over a dynamic
 * `r-bind` object bound for such a child renames those keys to `readOnly` /
 * `tabIndex` / `htmlFor` and the props SILENTLY NEVER ARRIVE. This is the
 * runtime twin of the compile-time component branch in `remapObjectKeysSolid`
 * (`targets/solid/src/emit/emitTemplateAttribute.ts:427-434`, quick 260804-4cy)
 * — so the LITERAL and DYNAMIC `r-bind` paths are now semantically identical on
 * a component tag.
 *
 * SECURITY: the `FORBIDDEN_KEYS` strip is deliberately IDENTICAL to
 * `normalizeAttrs` and shares the same module-level const, so the prototype-
 * pollution semantics of the two functions CANNOT drift (T-14-05). This is the
 * entire reason an emitter-only gate was impossible: emitting a bare
 * `{...obj}` on a component tag would have traded a naming bug for a
 * pollution regression.
 *
 * EVERY key passes through verbatim — Solid needs no rename exception at all.
 * `class` is deliberately absent from `SOLID_ATTR_KEY_MAP` and Solid JSX takes
 * `class` natively on component and DOM tags alike. (The React twin DOES keep
 * `class`→`className` here; see D-02 / quick 260804-4cy `ccc2225a`.)
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
    out[key] = obj[key];
  }
  return out;
}
