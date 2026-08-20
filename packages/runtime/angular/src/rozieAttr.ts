import { rozieDisplay } from './rozieDisplay';

/**
 * `rozieAttr` — whole-value attribute-binding display helper (260608-sya).
 *
 * Unlike interpolation/text (where a nullish value stringifies to `''`), a
 * nullish bound attribute value must DROP the attribute entirely — matching
 * Vue's `:attr` binding and Angular's own `[attr.x]="null"` removal semantics.
 * `false` is NOT dropped (it delegates to `rozieDisplay` → `"false"`),
 * preserving a11y-relevant `aria-*` / `data-*` attributes that are
 * legitimately `false`.
 *
 * Quick task 260819-qo8 — this used to be inlined at module scope in every
 * emitted Angular component (`function __rozieAttr`,
 * `packages/targets/angular/src/emitAngular.ts`). `@rozie/runtime-angular`
 * now ships it as a real export, imported under the `__rozieAttr` alias
 * alongside `rozieDisplay as __rozieDisplay`; a delegating `rozieAttr` CLASS
 * METHOD forwards to it (Angular AOT resolves template identifiers against
 * the component instance, not a module-scope free function).
 *
 * @public — runtime API consumed by emitted Angular .ts files.
 */
export function rozieAttr(v: unknown): string | null {
  return v == null ? null : rozieDisplay(v);
}
