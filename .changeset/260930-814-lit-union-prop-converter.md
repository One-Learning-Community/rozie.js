---
"@rozie/core": patch
"@rozie/runtime-lit": patch
---

Lit now converts a union prop's HTML attribute using the whole union, not just its first member. The order of the members in `type: [...]` no longer changes anything.

- A `[Number, String]` prop, in either order, turns a numeric attribute such as `height="600"` into the number `600` and keeps `height="auto"` as the string `'auto'`. Before, `[Number, String]` turned `'auto'` into `NaN`, and `[String, Number]` never produced a number.
- A union of `String` with complex members only (for example `[Object, String]`) reads the attribute as a string in any order. Before, an `Object`-first union JSON-parsed the attribute, so a plain string became `null`.
- `model: true` props follow the same rules. A `[Number, String]` model prop no longer turns `'auto'` into `NaN`, and a `[Boolean, String]` model prop no longer collapses every string attribute to `true`; it now matches the non-model `[Boolean, String]` behavior (`'true'`, `'false'` and a bare attribute are booleans, any other string stays a string).
- New `@rozie/runtime-lit` export `rozieNumberOrStringAttr`, the attribute converter the regenerated Lit output uses for a Number+String union. Shipped as `patch` like earlier additive runtime-lit exports: it is consumed by generated leaf code, and `@rozie/runtime-lit` versions in lockstep with the fixed toolchain group.

Unchanged: the non-model `[Boolean, String]` converter, unions without a `String` member (such as `[Element, Object]` or `[Object, Boolean]`), property bindings (which never pass through an attribute converter), and the React, Vue, Svelte, Angular and Solid targets.
