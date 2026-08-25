---
"@rozie/core": minor
---

A single-root `r-match` authored on a **real element** — `<div r-match="…">` rather than a
non-rendering `<template r-match="…">` — now auto-inherits consumer `class`/`style`/attributes/
listeners onto that host element, and no longer reports the `ROZ098`/`ROZ099` gated-root warning.

The host element in that shape renders **unconditionally**; only the content nested inside it varies
per branch:

```
<div class="status-host" r-match="$data.status">
  <template r-case="'loading'">…</template>
  <p r-case="'ready'">…</p>
  <p r-default>…</p>
</div>
```

The previous release classified every `r-match` single root as element-less, so this shape got a
warning whose message ("the template's only root is gated by a conditional, so auto-fallthrough has
no unconditional element to attach the inherited attributes to") was factually wrong for it, and
whose hint ("move the gating condition onto a child so the root element is unconditional") was
inapplicable — the root element already was unconditional. The spread that could have landed on the
host did not, so consumer `class`/`style`/attrs/listeners were dropped.

**This is a behavior change for consumers of any component shaped that way.** A `<div r-match>` root
now receives the consumer's attributes and listeners where before it received nothing. `class` and
`style` merge with the component's own values rather than replacing them, as everywhere else.
Components that do not want the forwarding retain the documented `inherit-attrs="false"
inherit-listeners="false"` opt-out, whose behavior is unchanged.

**What did NOT change:**

- **`<template r-match>` roots still warn and still drop.** A `<template>` host is non-rendering —
  there is genuinely no unconditional element — so `ROZ099`/`ROZ098` keep firing there, and the
  branch-descent repair for that shape remains deferred to a future phase.
- **`r-if`-gated roots still warn and still drop**, unchanged, for the same reason.
- **A loop-gated root (`r-for`) is still deliberately not covered** and stays silent, along with an
  interpolation root and a lone `<slot>` root. This release does not extend diagnostic coverage to
  any of them.
- **Root-arity rules are untouched.** `<div r-match>` alongside a second root element still
  hard-errors `ROZ970`/`ROZ973` — the host really is a second root there. `<div r-match>` plus a
  `<slot>` sibling likewise still errors; the slot-tolerance widening from the previous release
  applies to plain element roots, not to match hosts.
- **A component-tag host is still out of scope.** `<MyComponent r-match="…">` receives no spread,
  exactly as a plain `<MyComponent />` root does — its fallthrough surface is owned by the inner
  component.
