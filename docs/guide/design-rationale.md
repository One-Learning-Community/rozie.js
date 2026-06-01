# Why Rozie looks the way it does

Rozie's syntax makes a few choices that look unusual on first read — blocks instead of one `<script setup>`, a `$model.` write sigil, a `<listeners>` block full of `<listener>` elements. None of them are accidents, and none are decoration. Each one is the price of the actual product: **deterministic, idiomatic emission to six frameworks from one source.** This page explains the reasoning so the choices read as principled rather than surprising.

If you want the *mechanics* of any feature named below, [Features & design choices](/guide/features) has the per-target tables. This page is the *why*.

## The one idea everything follows from

A Rozie file is compiled, never run. The compiler has to statically extract enough structure from your source to generate native React, Vue, Svelte, Angular, Solid, and Lit — including each target's typed prop signature and (for React) its `useEffect` dependency arrays — **without executing your code**. Every syntax choice that looks unusual is there to keep some piece of the component statically legible to the compiler.

That gives a single test for "why is it this way?": *what does the compiler need to see, and where?*

## Why blocks, not one `<script setup>`

The most common first reaction from a Vue or React developer is "why is this split into `<props>`, `<data>`, `<script>` blocks — isn't that the Options API the ecosystem moved away from?"

The blocks are not an organizational preference. They are **format boundaries**, and the format of each block is chosen for what the compiler must do with its contents:

- **`<props>` and `<data>` are object literals** because the compiler reads them *without running them*. Prop types, defaults, and `model`/`required` flags are extracted statically to synthesize each target's typed prop signature and `.d.ts` — six different ones — at compile time. If props lived in executable `<script setup>` like `defineProps()`, the compiler would have to partially evaluate your setup function to recover the prop contract. Keeping them as literals makes the contract a thing the compiler can simply *look at*.
- **`<script>` is JavaScript** because that's your actual component logic — preserved and rewritten per target (`$props.x` → React `props.x`, Vue `props.x`, etc.) without re-parsing.
- **`<template>` and `<listeners>` are markup** because their contents are *wiring* — bindings onto elements and targets (see the taxonomy below).

This is the same multi-language split every SFC format already has — Vue's `<script>`/`<template>`/`<style>` are three different languages too, and nobody calls that the Options API. Rozie just has one more data-format block because it extracts more at compile time than a single-target compiler needs to.

The payoff you get back for the split: typed props on every target with no `defineProps`-style runtime macro, and React dep arrays computed for you instead of hand-maintained.

## Props are read-only; `$model.` is how you write

Across all six target frameworks, the first rule every developer learns is *never mutate a prop*. Rozie honors that rule rather than bending it:

- **Read** any prop through `$props.x`.
- **Write** a two-way (`model: true`) prop through the `$model.x` sigil — `$model.open = false`, `$model.value += step`.
- Writing through `$props.x` is a compile error, always — even for a `model` prop (it points you at `$model.x`).

This is the `value` / `setValue` split React developers already know, given one declaration. The read channel and the write channel are visibly different at the call site, so the legality of a write is never ambiguous — and `$props` stays what every framework promises it is: read-only input. The mechanics (which native emit/setter each `$model.x` write lowers to) are in [`model: true` → idiomatic two-way binding](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere).

Why a sigil and not just allowing `$props.x = …` for model props (as earlier Rozie did)? Because an assignment to `$props.value` looks identical whether `value` is a model prop or not — the legality was invisible at the write site, and the form taught a habit ("mutate props") that's wrong in every target. The split makes the safe thing and the legal thing the same visible thing.

## Wiring is markup; typed data is an object literal

`<listeners>` is a block of `<listener>` elements, not an object literal. `<props>` is an object literal, not a block of `<prop>` elements. New readers sometimes ask whether that inconsistency should be unified — make both markup, or both literals.

It shouldn't, and the reason is a clean rule: **the format follows the content, not the other way around.**

- **Wiring** — events and bindings attached to targets/elements — is markup: `<template>`, and now `<listeners>`. An event handler on a target reads naturally as an attribute (`@keydown.escape="close"`), exactly like template `@event`. This is why the [`<listener>` element form](/guide/features#listeners-block-—-declarative-listener-elements) landed: its content was always wiring, so it belongs in the markup family — and it now reads like Svelte's `<svelte:window>` rather than a stringly-keyed object.
- **Typed data** — prop and state declarations — is an object literal: `<props>`, `<data>`. Their content is *typed JavaScript values*: `type: Number`, `default: () => []`, `as Shape`, `type: Foo<Bar>`. Those are real JS/TS expression nodes the compiler reads and the consumer's type-checker sees ([details](/guide/features#props-and-data-accept-real-js-expressions)).

Element form would actively *break* `<props>`: `<prop type="Foo<Bar>" :default="() => []" />` stuffs typed JavaScript into string attributes that have to be re-parsed and can't be type-checked — destroying the `<script lang="ts">` prop-type story. So the split isn't an inconsistency to fix; it's the correct rule applied to two different kinds of content. The discriminator is **wiring vs. typed-data**, not *markup-ish vs. not*.

## The advanced tier: engine-wrapper sigils

A handful of Rozie's surface — `$classSelector()`, `r-external`, `$reconcileAfterDomMutation()`, `$restoreFocus()`, portal slots — exists only for one job: wrapping a vanilla-JS engine (SortableJS, flatpickr, TipTap, a charting lib) that owns DOM the framework doesn't control. These are deliberately an **advanced tier**. You will not meet them writing a Counter, a Modal, or a form — only when you hand a third-party engine some DOM and have to reconcile its mutations against six different keyed-reconcilers.

If your first encounter with Rozie is the [SortableList showcase](/guide/sortable-list), that's the deep end on purpose — it's the proof that the hard cross-framework cases are *possible*, not the shape of everyday authoring. Start with [Counter](/examples/counter) or [SearchInput](/examples/search-input) for what normal Rozie code looks like; reach for these sigils only when you're integrating an engine. Each is documented where it's needed: [`$classSelector()`](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine), [`r-external` / `$reconcileAfterDomMutation()`](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own), [`$restoreFocus()`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders).

## The trade, stated plainly

Rozie spends a little modern-colocation ergonomics (separate data blocks instead of one `<script setup>`) and a little orthodoxy-bending-avoidance (a distinct write channel instead of free prop mutation) to buy **compiler determinism** — and that determinism is the whole product. It's what lets one `.rozie` file become six idiomatic, typed components instead of six hand-maintained wrappers. If you're the audience Rozie is for — someone who today keeps `react-sortablejs` + `vuedraggable` + `ngx-sortablejs` + a Svelte fork in sync by hand — that's a trade you've already been paying for the other way.
