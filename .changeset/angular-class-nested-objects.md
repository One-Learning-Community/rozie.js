---
"@rozie/runtime-angular": patch
"@rozie/target-angular": patch
"@rozie/core": patch
"@rozie-ui/sortable-list-angular": patch
---

Angular: an object or nested array inside a `:class` list is now applied, matching the other targets. `:class="['card', { active: isActive }]"`, or a list holding a prop whose value is an object or array, used to lose those classes on Angular, because Angular's own `[class]` binding only takes plain strings inside a list (and `[ngClass]` rejected them). Such values are now flattened to one class string by the new `rozieClass` helper in `@rozie/runtime-angular`. Plain strings, plain `{ ... }` objects and lists of plain strings bind as before.

`@rozie-ui/sortable-list-angular`: an object or array `itemClass` / `listClass` (for example `{ 'is-flagged': true }`) now lands on the rows and the list.
