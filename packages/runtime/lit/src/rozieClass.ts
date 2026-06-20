/**
 * `rozieClass` — clsx-style class-value normalizer (quick task 260620-kby).
 *
 * Mirrors the npm `clsx` semantics (the React reference) so a `:class` binding
 * lowers to the SAME normalized single space-joined class string on every
 * compile target. Accepts the union Vue's `normalizeClass` accepts —
 * `string | number | array | object | nested` — recurses arrays, keeps object
 * keys whose value is truthy, and drops every falsy entry.
 *
 * This fixes the latent silent-garbage bug where an array/object class value
 * delivered via a prop (or an array literal) previously rendered `class="a,b"`,
 * `class="[object Object]"`, or JSON on the non-Vue targets.
 *
 * Pure and stateless: re-evaluating the call at a reactive binding site always
 * yields the current class string for the current inputs (the runtime half of
 * the reactivity guarantee — the compile-time inline-placement half lives in the
 * emitter, which keeps `rozieClass(...)` as the DIRECT binding-site value, never
 * a hoisted const).
 *
 * Object keys are iterated via `Object.keys` (own-enumerable only) so a
 * `__proto__`/`constructor` literal key on a plain object is non-enumerable and
 * never emits a token — prototype-pollution-safe, no prototype walk.
 *
 * Dependency-free by design: this package must stay self-contained, so we do NOT
 * import the npm `clsx` here (only `@rozie/runtime-react` uses the npm package).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | ClassValue[];

export function rozieClass(...args: ClassValue[]): string {
  const tokens: string[] = [];
  const push = (arg: ClassValue): void => {
    if (arg == null || arg === false || arg === true || arg === '') return;
    if (typeof arg === 'string') {
      tokens.push(arg);
    } else if (typeof arg === 'number') {
      if (arg !== 0) tokens.push(String(arg));
    } else if (Array.isArray(arg)) {
      for (const item of arg) push(item);
    } else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) {
        if ((arg as Record<string, unknown>)[key]) tokens.push(key);
      }
    }
  };
  for (const arg of args) push(arg);
  return tokens.join(' ');
}
