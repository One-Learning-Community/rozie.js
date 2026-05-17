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

## Issues captured (2026-05-17 UAT halt — partial walkthrough)

### P0-UAT-01 — HTML inside `<template>` body renders as nearly-uncolored text (UAT-halting)
- **Severity:** P0 (worse than the TextMate bundle alone)
- **Steps to repro:** Install v0.2.0 zip in WebStorm; open any reference example (`Counter.rozie`, `Modal.rozie`, etc.); look at `<template>` content
- **Expected:** HTML elements like `<div class="...">`, `<button>`, `<span>` highlight with HTML colors (tag-bracket color, tag-name color, attr-name color, attr-value color) — TextMate-bundle parity
- **Actual:** `<` and `>` uncolored (EMPTY_KEYS), tag names (e.g. `div`, `button`) mis-coloured as MARKUP_ATTRIBUTE (because the JFlex lexer emits them as `ATTR_NAME` tokens), attribute values uncoloured. Net effect: template body looks like plain text with a couple sporadically-coloured identifiers.
- **Root cause:** The JFlex lexer carves `<template>` body into many small tokens (`TEMPLATE_BODY('<')`, `ATTR_NAME('div')`, `GT('>')`, `LT_SLASH('</')`, plus Plan 03+04 additions like `COMPONENT_REF`, `SLOT_FILL_MARKER`, `SLOT_NAME`, `DIRECTIVE_COLON`, `DIRECTIVE_ARGUMENT_NAME`). These fragment the `TEMPLATE_BODY` injection ranges into 1-5 char slivers that `HTMLLanguage` cannot parse — the injection is effectively dead. By contrast, JS injection works fine because `<script>` body emits as one contiguous `SCRIPT_BODY` token.
- **Disposition:** FIX-IN-PHASE-08.2 (architectural pivot — see decision log below)

### P0-UAT-02 — `$props.x` does NOT Go-to-Declaration into `<props>` block (UAT-halting)
- **Severity:** P0 (the headline "smart feature" promise of any IntelliJ plugin)
- **Steps to repro:** Open `Counter.rozie`; in `<script>` block, right-click on `value` in `$props.value`; choose Go to Declaration
- **Expected:** Cursor jumps to the `value:` key in the `<props>` block (cross-block PSI reference)
- **Actual:** No navigation, or "Cannot find declaration to go to" — the plugin has no `PsiReferenceContributor` wiring `$props.X` MemberExpression nodes inside the injected JS PSI tree to the corresponding `<props>` key
- **Disposition:** FIX-IN-PHASE-08.2 (architectural pivot)

### Architectural decision recorded 2026-05-17

User UAT verdict: *"we're better off with the textmate highlighter and no smart features than whatever is currently offered."*

The lexer-heavy architecture shipped in Plans 08.1-03 / 04 / 05 (and inherited from Plans 08-01..05 / 08.1-01..02) optimised for the wrong contract — **D-07 TextMate scope-parity** — when the right contract is **"JetBrains HTML-PSI compatibility + Rozie smarts layered via standard IntelliJ extension points."** TextMate's regex-paint model and IntelliJ's token-stream-injection model are not equivalent: matching scope names in `TextMateGrammarParityTest` does not produce equivalent visual output, and the lexer carve-outs that satisfy parity actively break HTML injection.

**Phase 08.2 reverses course.** See `.planning/ROADMAP.md` Phase 08.2 entry. The pivot:
1. JFlex template-body rules strip back to "emit one contiguous TEMPLATE_BODY token" (mirror SCRIPT_BODY pattern)
2. JetBrains' built-in HTML PSI handles structure / completion / inspection / fold / format
3. Rozie smarts (`r-*`, `@`, `:`, `#`, PascalCase tags, `$props.X` cross-block refs) move to: `XmlAttributeDescriptorsProvider`, `Annotator`, `XmlTagNameProvider`, `PsiReferenceContributor`, `CompletionContributor`
4. `TextMateGrammarParityTest` retires (D-07 contract was wrong)
5. `templateNestingDepth` counter (Plan 05) likely becomes unnecessary — HTML parser handles nesting natively

## Sign-off

- [ ] All 8 examples walked in both IDEs — **UAT HALTED 2026-05-17 after Counter.rozie surfaced 2 P0 issues; remaining walkthrough deferred until Phase 08.2 lands a rebuilt v0.2.0**
- [ ] All `$onUpdate` contexts verified — **deferred (architectural rework will change the surface)**
- [ ] All P0/P1 issues fixed in this phase OR triaged — **P0-UAT-01 + P0-UAT-02 routed to Phase 08.2**
- [ ] `git tag -a intellij-plugin/v0.2.0 -m '...'` cut — **NOT cut. Tag will be cut from the Phase 08.2 close-out, replacing the current candidate.**
- [ ] User confirms tag push (NOT done automatically — feedback_no_autopush memory) — **n/a (no tag cut)**
- [ ] CI release job green (artifact published to GitHub Releases) — **n/a**
