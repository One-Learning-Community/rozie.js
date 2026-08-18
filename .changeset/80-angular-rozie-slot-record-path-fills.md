---
"@rozie/core": minor
"@rozie/cli": minor
"@rozie/unplugin": minor
"@rozie/babel-plugin": minor
"@rozie/runtime-angular": minor
---

Angular consumers filling a producer's **record-path** slot — a dynamically-named
slot (`<slot :name="...">`), a non-identifier statically-named slot
(`<slot name="cell-status">`), or a `matchedFamily`-routed slot — now do it with a
keyed `[rozieSlot]` marker directive on the fill's own `<ng-template>`, instead of
the old `@ViewChild(..., { static: true })` + class-body `templates` getter path.

This closes two silent-wrong-render bugs the old mechanism could not express
correctly:

- **A fill inside a conditional or a loop** (`r-if` / `r-for`) used to be silently
  dropped — a static `@ViewChild` query resolves once, before change detection, and
  never sees a `<ng-template>` that only exists inside an `@if`/`@for` block.
- **Two sibling producers on one page** used to collide — the emitter's synthetic
  template-reference-variable naming reset per producer tag, so both producers'
  fills shared the same reference name and the class-body `templates` getter only
  ever emitted an entry for the first producer, silently dropping the second.

Both are now correct: the producer collects keyed fills via a signal
`contentChildren(RozieSlot, { descendants: true })` content query, which — unlike a
static view query — re-evaluates on every change-detection pass and sees content
regardless of which conditional or loop iteration it lives inside.

**Hand-written Angular consumers get the same capability in one line of markup, no
class-body code required:**

```html
<my-producer>
  <ng-template [rozieSlot]="'cell-status'">...</ng-template>
</my-producer>
```

with `RozieSlot` imported from the new `@rozie/runtime-angular` package. The
`templates` input survives unchanged as the documented programmatic escape hatch —
nothing that used it needs to change.

**`@rozie/runtime-angular` is a new published package.** Emitted Angular output
imports it only when a component actually uses a record-path slot; a component with
none gets no new runtime dependency. It ships Ivy partial-compilation output (the
standard library-authoring format, linked into your app by the Angular CLI's own
build pipeline) and joins the `fixed` changesets group with the other five
`@rozie/runtime-*` packages, so it versions in lockstep.

(As with prior releases, the six `@rozie/target-*` emitter packages are private
workspace packages, never published on their own — `@rozie/core`'s emitters are
what's inlined into every public entry point that compiles `.rozie` source: this
CLI, the unplugin build-tool adapter, and the Babel plugin. Only the Angular target
changes with this release; the other five targets are byte-identical.)
