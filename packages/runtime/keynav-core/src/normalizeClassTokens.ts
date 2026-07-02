/**
 * `normalizeClassTokens` — the shape->token-list normalizer SPEC §9
 * requires (Landmine 4 anti-drift): the SAME normalization semantics the
 * triplicated `rozieClass` (`packages/runtime/{svelte,lit,solid}/src/
 * rozieClass.ts`) uses for `:class` bindings, factored out as the ARRAY
 * step rather than the final joined string.
 *
 * `r-keynav`'s imperative active-class toggle calls this, then does
 * `classList.add(...tokens)` / `classList.remove(...tokens)` directly — so
 * the imperative path can never drift from `:class` semantics (falsy
 * object values dropped, nested arrays flattened, etc.).
 *
 * One semantic difference from `rozieClass` is REQUIRED here, not
 * optional: `classList.add/remove` throws a `DOMException` on any token
 * containing whitespace, so a whitespace-separated string argument (e.g.
 * `'is-active ring'`) must split into individual tokens — `rozieClass`
 * itself never needed to do this because it only ever produces a single
 * joined `class="..."` string, where embedded spaces are harmless.
 *
 * Per the plan's own instruction: the existing `rozieClass.ts` files are
 * NOT modified by this task (avoids byte drift on shipped `:class` output).
 * `normalizeClassTokens` is a fresh, standalone implementation.
 *
 * @public — runtime API consumed by all six per-target keynav controllers.
 */
type ClassValue = string | number | boolean | null | undefined | Record<string, unknown> | ClassValue[];

export function normalizeClassTokens(...args: ClassValue[]): string[] {
  const tokens: string[] = [];

  const pushTokenString = (str: string): void => {
    for (const token of str.split(/\s+/)) {
      if (token) tokens.push(token);
    }
  };

  const push = (arg: ClassValue): void => {
    if (arg == null || arg === false || arg === true || arg === '') return;
    if (typeof arg === 'string') {
      pushTokenString(arg);
    } else if (typeof arg === 'number') {
      if (arg !== 0) pushTokenString(String(arg));
    } else if (Array.isArray(arg)) {
      for (const item of arg) push(item);
    } else if (typeof arg === 'object') {
      // Object.keys — own-enumerable only, so a literal `__proto__`/
      // `constructor` key (which the object-literal grammar special-cases
      // onto [[Prototype]], never an own property) is never iterated.
      for (const key of Object.keys(arg)) {
        if ((arg as Record<string, unknown>)[key]) pushTokenString(key);
      }
    }
  };

  for (const arg of args) push(arg);
  return tokens;
}
