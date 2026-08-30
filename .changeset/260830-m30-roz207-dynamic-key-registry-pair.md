---
'@rozie/core': patch
'@rozie/target-react': patch
'@rozie/target-solid': patch
'@rozie/target-angular': patch
'@rozie/target-lit': patch
---

ROZ207: the id-keyed registry pair now compiles reactively, and uncovered nested `delete` is no longer silent

**The registry pair works now.** `$data.reg[id] = spec` (register/update) and
`delete $data.reg[id]` (unregister) — where `<data>` declares `reg: {}` — now
lower to a reactive whole-key replace on React, Solid, Angular and Lit, and raise
no ROZ207. Vue and Svelte already worked via deep reactivity, so the idiom is now
correct on all six targets. This is the one real-world shape the previous covered
subset could not reach; you no longer need to hand-write the whole-object-replace
workaround for it.

A dynamic index into an array-declared key (`$data.arr[i] = v` with `arr: []`) is
covered too. The key expression must be a plain identifier, string literal or
number literal — a call or a computed chain stays flagged, because the array
lowering re-evaluates the key once per element.

**Behavior change you can hit (1):** a nested `delete` on a `<data>` key that is
NOT covered is now a compile ERROR. It previously compiled clean and was silently
non-reactive on React/Solid/Angular/Lit — the key was removed but no re-render
fired. The validator simply had no `delete` visitor. Newly flagged:
`delete $data.arr[i]` on an array-declared key (deleting an array element leaves a
hole, which is a different semantic from an immutable replace),
`delete $data.obj.field` (non-computed), `delete $data.a.b[k]` (depth 3), a
`delete` whose result is consumed as an expression, and a `delete` on a key whose
declared value is not a literal object. The diagnostic carries a clone-then-delete
hint: `const next = { ...$data.reg }; delete next[id]; $data.reg = next;`.

**Behavior change you can hit (2):** `$data.k[0] = v` where `k`'s declared value
is neither a literal array nor a literal object is now a compile error. It
previously emitted an array `.map(...)` operation unconditionally, so
`$data.obj[0] = v` with `obj: {}` shipped `{}.map(...)` — a runtime TypeError.
An object-declared key now takes the object lowering instead, and the
genuinely-unresolvable case fails loud rather than emitting broken code.

**Note on semantics:** a dynamic key written through the new object lowering
becomes an OWN property, because the compiler emits a computed property in an
object literal (`{ ...prev, [id]: v }`) rather than a bracket assignment. A key of
`"__proto__"` therefore adds an own property instead of setting the prototype.
This matches the whole-object-replace workaround this shape supersedes, and is
strictly safer than the in-place bracket write it replaces.
