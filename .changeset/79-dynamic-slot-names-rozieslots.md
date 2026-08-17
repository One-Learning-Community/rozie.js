---
"@rozie/core": minor
"@rozie/cli": minor
"@rozie/unplugin": minor
"@rozie/babel-plugin": minor
---

Producer-side dynamic slot names: a `.rozie` producer can now declare a slot whose
name is computed at runtime — `<slot :name="`cell-${column.key}`">` — and consumers
fill the resulting family with ordinary static named fills (`#cell-status`,
`#cell-score`) that carry real, narrowed param types. All six targets (React, Vue,
Svelte, Angular, Solid, Lit) support this. Lit additionally gains a `rozieSlots`
record property (`Record<string, (scope) => unknown>`), closing the last remaining
gap in slot support across the six targets; its pre-existing
`data-rozie-params` / `observeRozieSlotCtx` light-DOM path is retained unchanged for
the cases that don't need the record.

(The six `@rozie/target-*` emitter packages are private workspace packages, never
published on their own — `@rozie/core`'s emitters are what's inlined into every
public entry point that compiles `.rozie` source: this CLI, the unplugin build-tool
adapter, and the Babel plugin. All six targets' emit output changes with this
release regardless of which entry point you compile through; the version bump lives
on the public packages that actually ship it.)

**Breaking (semantic, `<slot>` authoring only): `:name` is now reserved on
`<slot>`.** Following Vue's own `<slot>` semantics, a bound `:name` attribute means
"this slot's name is computed at runtime" — it no longer contributes an ordinary
scope-param value. Concretely: if you previously wrote

```rozie
<slot :name="somePresentationalValue">...</slot>
```

intending `name` to be a normal scope param a consumer could destructure
(`#mySlot="{ name }"`), that `name` param will no longer appear in the consumer's
scope object — `:name`'s value is now read as the slot's dynamic name instead. If you
hit this, rename the scope param to anything other than `name`
(e.g. `:label="..."` or `:itemName="..."`). The compiler will not silently accept the
old meaning: a `<slot :name="...">` that also declares a scope param literally named
`name` is a hard compile error, **ROZ091**
(`<slot :name="..."> also declares a scope param named 'name' — 'name' is reserved on
<slot> as of Phase 79 and can no longer be used as a scope-param key`).

We audited every `.rozie` file across this repo (toolchain examples, all shipped
`@rozie-ui` components, and every internal regression fixture) for this exact
pattern. The blast radius is four internal regression fixtures — no shipped
`@rozie-ui` component and no `examples/` file declares a `name` scope param on a
`<slot>`. (One other repo-wide `:name` hit is on an `<input>` element, an unrelated
and unaffected binding.) We're not aware of any external usage of this pattern, but
because we can't audit code outside this repo, this ships as a **minor**, not a
patch, specifically so it's visible in your changelog if you're bound to a caret
range on any of these packages.

We chose minor over major because the toolchain is still pre-1.0 (semver's "anything
may change" allowance applies), the internal blast radius is small and already
fixed, and no shipped component is affected — but the note above exists precisely so
an external author who never saw this phase's internal audit still gets the warning.

Three smaller related changes ship in the same wave:

- **Non-identifier slot names are now legal on all six targets.** A slot named
  `cell-total` (not a valid JS identifier) used to fail to compile on some targets;
  it now compiles cleanly everywhere and routes through the same record-property
  mechanism as dynamic names. As a consequence, **ROZ127** (a slot name colliding
  with a prop name) has returned to its original, single documented meaning — it no
  longer also fires for non-identifier names, which was never its intent.
- **A `<props>` key that collides with a target's slot-record property name
  (`slots`, `snippets`, `templates`, or `rozieSlots`) is now a hard compile error**
  with a rename hint (**ROZ095**) — previously the emitted component would have
  silently declared that identifier twice.
- Two more new diagnostics round out the feature: **ROZ090** (a `<slot>` can't carry
  both a static `name=` and a bound `:name` at once) and **ROZ096** (a bound `:name`
  expression that fails to parse as JavaScript is now a compile error, never a
  silent `undefined` fallback).
