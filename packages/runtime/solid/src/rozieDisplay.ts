/**
 * `rozieDisplay` — portable interpolation display helper (SPEC-2, Phase 26).
 *
 * Stringifies a `{{ }}` / attribute-binding / class-interpolation value the same
 * way on every non-Vue target so a non-primitive renders identical pretty-printed
 * JSON (eliminating React's "Objects are not valid as a React child" crash and the
 * `[object Object]` divergence on Svelte/Solid/Lit/Angular).
 *
 * Algorithm (identical across all four non-Vue runtime packages):
 *   - `v == null`            → `''`            (null / undefined → empty string)
 *   - `typeof v === 'string'`→ `v`             (string passthrough, no quoting)
 *   - `typeof v === 'object'`→ 2-space JSON     (plain objects AND arrays)
 *   - otherwise              → `String(v)`     (number/boolean/bigint/symbol coercion)
 *
 * Vue is deliberately NOT wrapped — its native `toDisplayString` already JSON-prints
 * plain Array/Object. Date/Map/Set/class-instances follow `JSON.stringify` semantics
 * here, an accepted documented divergence from Vue's native handling.
 *
 * The same body is INLINED at module scope in the Angular emitter (`function
 * __rozieDisplay`) because there is no `@rozie/runtime-angular` package and project
 * convention forbids one (RESEARCH Pitfall 4).
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export function rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}
