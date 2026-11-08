/**
 * `rozieClass` — Vue/clsx-style class-value normalizer for Angular.
 *
 * Angular's native `[class]` / `[ngClass]` bindings accept `string | string[] |
 * Set | Record<string, boolean>`, but the entries of an array must be strings:
 * an object (or a nested array) inside an array is dropped by `[class]` and
 * rejected by `[ngClass]`. The other five targets follow Vue's `:class`
 * semantics — a class value is a string, an object of `{ name: truthy }`, or an
 * array whose entries are any of these, recursively — so the Angular emitter
 * routes every `:class` value whose runtime shape may hold such entries
 * through this helper, which flattens it to ONE space-joined class string.
 *
 * Same algorithm as the `rozieClass` shipped by `@rozie/runtime-lit` /
 * `-solid` / `-svelte` (and the npm `clsx` the React target uses): recurse
 * arrays, keep object keys whose value is truthy, drop every falsy entry
 * (`null`, `undefined`, `false`, `true`, `''`, `0`). Object keys are read via
 * `Object.keys` (own-enumerable only), so no prototype walk.
 *
 * The emitted component imports it under the `__rozieClass` alias and a
 * delegating `rozieClass` CLASS METHOD forwards to it, because Angular AOT
 * resolves template identifiers against the component instance, not a
 * module-scope function. Parameters are `unknown` so any author-typed value
 * passes Angular's `strictTemplates` check.
 *
 * @public — runtime API consumed by emitted Angular .ts files.
 */
export function rozieClass(...args: unknown[]): string {
  const tokens: string[] = [];
  const push = (arg: unknown): void => {
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
