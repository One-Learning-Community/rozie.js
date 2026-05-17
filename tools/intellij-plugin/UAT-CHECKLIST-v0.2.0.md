# Phase 08.1-06 — Human UAT Checklist

**Plugin version:** intellij-plugin/v0.2.0 (built from main @ ddaea72bd280814ad6ce5cd7174c2cc806f253b2)
**Build artifact:** `tools/intellij-plugin/build/distributions/rozie-intellij-plugin-0.2.0.zip` (filename derived from `rootProject.name` in `settings.gradle.kts` — the RESEARCH/PLAN reference to `Rozie.js-0.2.0.zip` is a documentation drift; CI workflow uses a `*.zip` glob so this is purely a cosmetic discrepancy)
**IDEs tested:**
- [ ] WebStorm 2024.2.5
- [ ] IDEA Ultimate 2025.3

## Install verification

For each IDE:
- [ ] Settings → Plugins → ⚙ → Install Plugin from Disk → select zip → restart
- [ ] Open `examples/Counter.rozie` — Rozie file icon appears in Project view

## Per-example walkthrough

For each of the 8 reference examples below, open the file and check the listed concerns.

### Counter.rozie
- [ ] All 7 SFC block tags highlighted (BLOCK_TAG color) — `<rozie>`, `<props>`, `<data>`, `<script>`, `<template>`, `<style>`, close tags
- [ ] `$props`, `$data`, `$computed`, `$onMount` highlight as MAGIC_IDENT
- [ ] `r-if`, `r-else` highlight as R_DIRECTIVE
- [ ] `@click.prevent`, `@mouseenter` highlight with EVENT_AT + EVENT_NAME + MODIFIER_NAME
- [ ] `:disabled` highlights with PROP_COLON + PROP_NAME
- [ ] `{{ }}` interpolations highlighted, `$props.value` inside MAGIC_IDENT
- [ ] JS autocomplete works inside `<script>` (type `$pro` → `$props` suggested)
- [ ] CSS autocomplete works inside `<style>` (type `color:` → completion)

### Dropdown.rozie
- [ ] All Counter checks PLUS:
- [ ] `r-model` directive recognised on `<input>`-style elements

### SearchInput.rozie
- [ ] All Counter checks
- [ ] `r-model="$data.query"` on form input highlights

### TodoList.rozie
- [ ] All Counter checks
- [ ] `r-for="item in items"` highlights as R_DIRECTIVE
- [ ] `r-model` on `<input>` highlights

### Modal.rozie
- [ ] All Counter checks
- [ ] `<components>` block (if present) highlights with BLOCK_TAG + JS injection inside

### ModalConsumer.rozie (CRITICAL — exercises plans 03 + 04)
- [ ] `<Modal>` highlights as COMPONENT_REF (distinct from `<div>`)
- [ ] `<WrapperModal>` highlights as COMPONENT_REF
- [ ] `r-model:open="$data.open1"` — `r-model` is R_DIRECTIVE, `:` is DIRECTIVE_COLON, `open` is DIRECTIVE_ARG, `"$data.open1"` JS-injects
- [ ] `<template #header="{ close }">` — `#` is SLOT_FILL_MARKER, `header` is SLOT_NAME, `"{ close }"` JS-injects
- [ ] `<template #[$data.slotName]>` — `#` is SLOT_FILL_MARKER, `[` and `]` are SLOT_BRACKET, `$data.slotName` inside has MAGIC_IDENT for `$data`
- [ ] `<template #brand>` and `<template #actions>` — `#` + identifier (no value)
- [ ] Nested `<template>` does NOT prematurely terminate the outer `<template>` block (BLOCK_TAG color survives all the way to the final `</template>`)

### WrapperModal.rozie (CRITICAL — exercises plan 05 nested-template)
- [ ] Outer `<template>` SFC block tag highlighted as BLOCK_TAG
- [ ] Inner `<template #header>` and `<template #footer>` highlighted (NOT treated as new SFC blocks — no premature `<template>` block-tag highlight inside the body)
- [ ] Final `</template>` correctly closes the outer SFC block (NOT the inner slot-fill)

### Card.rozie + TreeNode.rozie (newer fixtures with `<components>`)
- [ ] `<components>` block tag + JS injection in body
- [ ] PascalCase tags in template highlight as COMPONENT_REF

## `$onUpdate` validation

Create a scratch file `examples-uat-scratch.rozie` (do not commit) with `$onUpdate` in all 6 contexts (template attr expression + mustache from `edge-on-update.rozie`, plus script/props/data/listeners bodies):

- [ ] `$onUpdate` in `<script>` body — colored by JS injection (no MAGIC_IDENT — that's OK, host lexer doesn't see into JS bodies)
- [ ] `$onUpdate` in template attr expression (e.g. `:disabled="$onUpdate(...)"`) — MAGIC_IDENT color
- [ ] `$onUpdate` in `{{ ... }}` interpolation — MAGIC_IDENT color
- [ ] `$onUpdate` in `<listeners>` value strings — colored by JS injection
- [ ] `$onUpdate` in `<props>` / `<data>` — colored by JS injection

## Cross-IDE delta

If anything renders differently between WebStorm 2024.2.5 and IDEA Ultimate 2025.3, list it here:

- [ ] No differences observed
- OR
- [ ] Differences: <list>

## Issues captured

For each "isn't quite right" finding, file:
- Title:
- Severity (P0 blocker / P1 fix-this-phase / P2 follow-up):
- Steps to repro:
- Expected vs actual:
- Disposition (FIX-IN-PHASE / TRIAGE-FOLLOWUP):

## Sign-off

- [ ] All 8 examples walked in both IDEs
- [ ] All `$onUpdate` contexts verified
- [ ] All P0/P1 issues fixed in this phase OR triaged with explicit reasoning for deferral
- [ ] `git tag -a intellij-plugin/v0.2.0 -m '...'` cut
- [ ] User confirms tag push (NOT done automatically — feedback_no_autopush memory)
- [ ] CI release job green (artifact published to GitHub Releases)
