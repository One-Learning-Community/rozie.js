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
