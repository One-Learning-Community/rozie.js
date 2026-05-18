# Phase 08.2-07 — Human UAT Checklist (v0.2.0 rebuild, architectural-pivot edition)

**Plugin version:** intellij-plugin/v0.2.0 (rebuilt from main carrying cumulative Phase 08.2 Plans 01-06)
**Build artifact:** `tools/intellij-plugin/build/distributions/rozie-intellij-plugin-0.2.0.zip` (filename derived from `rootProject.name` in `settings.gradle.kts` — the RESEARCH/PLAN reference to `Rozie.js-0.2.0.zip` is a documentation drift; CI workflow uses a `*.zip` glob so this is purely a cosmetic discrepancy)
**IDEs tested:**
- [ ] WebStorm 2024.2.5
- [ ] IDEA Ultimate 2025.3

## Architectural pivot summary (what changed since the 2026-05-17 UAT halt)

The 2026-05-17 UAT against the original v0.2.0 candidate (commit `ddaea72`) surfaced two P0
issues — `<template>` body rendered as nearly-uncolored text (P0-UAT-01) and `$props.X` had
no Go-to-Declaration (P0-UAT-02). Phase 08.2 Plans 01-06 reverse the lexer-heavy direction
that caused both:

| Pivot step | Plan | What it did | Closes |
|---|---|---|---|
| Single-token TEMPLATE_BODY | 08.2-01 | JFlex collapses `IN_TEMPLATE_BODY` to one greedy rule; ~15 IElementTypes retired; `TextMateGrammarParityTest` deleted (D-07 was the wrong contract) | P0-UAT-01 |
| HTML-PSI knows our attrs | 08.2-02 | `RozieAttributeDescriptorsProvider` + `RozieKnownAttributes` + coalesced HTML injection — no more "Unknown attribute" red squiggles on `r-*` / `@` / `:` / `#` / `ref` | family (e) |
| HTML-PSI knows our tags | 08.2-03 | `RozieComponentTagProvider` — PascalCase tags (`<Modal>`, `<WrapperModal>`) recognised — no "Unknown HTML tag" red squiggles | family (e) |
| Distinctive sigil paint | 08.2-04 | `RozieAnnotator` + `RozieJsAnnotator` paint `r-*` / `@` / `:` / `#` / `ref` / PascalCase / `$props.X` distinctively, OVER the stock HTML/JS coloring inside `.rozie` files only | family (b) |
| Cross-block Go-to-Decl | 08.2-05 | `RozieJSReferenceContributor` + 3 `PsiReferenceBase.Poly` classes wire `$props.X` / `$data.X` / `$refs.X` Go-to-Declaration / Find-Usages / Rename to declarations in sibling SFC blocks | P0-UAT-02 |
| Sigil-prefix autocomplete | 08.2-06 | `RozieAttributeNameCompletionContributor` surfaces canonical `r-` / `@` / `:` / `#` name lists when typing those prefixes in attribute position | family (d) |

Net effect on the UAT contract:
- The original v0.2.0 candidate's per-token JFlex-coloring checkboxes have NO post-pivot
  semantic equivalent (the lexer no longer paints those tokens — HTML PSI does, and our
  Annotators layer Rozie smarts on top). They are REPLACED with the 5 per-example families
  in the walkthrough below.
- ~15 retired color-scheme keys (`ROZIE_EVENT_AT`, `ROZIE_EVENT_NAME`, `ROZIE_MODIFIER`,
  `ROZIE_MODIFIER_PUNCTUATION`, `ROZIE_PROP_BINDING_PUNCT`, `ROZIE_PROP_BINDING_NAME`,
  `ROZIE_INTERPOLATION_DELIM`, `ROZIE_REF_ATTR`, `ROZIE_HTML_ATTR_NAME`,
  `ROZIE_COMPONENT_REF`, `ROZIE_DIRECTIVE_COLON`, `ROZIE_DIRECTIVE_ARG`,
  `ROZIE_SLOT_FILL_MARKER`, `ROZIE_SLOT_NAME`, `ROZIE_SLOT_BRACKET`) are documented in
  `<change-notes>` and will silently revert to default HTML coloring in any saved user
  `.icls` files. Expected: v0.1.0 was internal dogfooding only.

## Install verification

For each IDE:
- [ ] Uninstall any prior Rozie.js plugin first: Settings → Plugins → Installed → right-click
      Rozie.js → Uninstall → Restart
- [ ] Settings → Plugins → ⚙ → Install Plugin from Disk → select
      `tools/intellij-plugin/build/distributions/rozie-intellij-plugin-0.2.0.zip` → Restart
- [ ] Verify "Rozie.js 0.2.0" appears under Settings → Plugins → Installed
- [ ] Open `examples/Counter.rozie` — Rozie file icon appears in Project view

## Per-example walkthrough

For each reference example below, open the file and verify the 5 architectural-pivot families:

**(a) HTML-PSI parity** — HTML coloring inside `<template>` looks like the TextMate bundle
(tag brackets, tag names, attribute names, attribute values all distinctively colored, with
the same family of colors the IDE uses in an ordinary `.html` file).

**(b) Annotator sigil paint** — `r-*` directives, `@event` handlers, `:prop` bindings,
`#slot` fills, `ref` attribute, and PascalCase component tags are painted distinctively
(visually different from stock HTML attribute / tag coloring).

**(c) Cross-block Go-to-Declaration** — Right-click on `$props.X` / `$data.X` / `$refs.X` in
`<script>` (or in any injected JS in template attribute values / interpolations) → Go To →
Declaration (or Cmd-B / Ctrl-B) jumps to the corresponding key in the `<props>` / `<data>`
block (or to the `ref="X"` attribute for `$refs.X`).

**(d) Sigil-prefix autocomplete** — Inside `<template>`, typing `r-` / `@` / `:` / `#` at
the start of an attribute name surfaces the canonical sigil list (Ctrl-Space if needed to
force it). For `r-` the list includes `r-if` / `r-else` / `r-else-if` / `r-for` / `r-model` /
`r-bind` / `r-on` etc.; for `@` the standard DOM events; for `:` known prop-binding names;
for `#` known slot-fill names.

**(e) No "Unknown" inspections** — No red squiggles or "Unknown attribute" / "Unknown HTML
tag" inspection warnings fire on any `r-*` / `@` / `:` / `#` / `ref` / PascalCase usage in
the example. (Stock HTML PSI used to flag every Rozie sigil as unknown before Plans 02 + 03
wired the providers.)

### Counter.rozie
- [ ] (a) HTML-PSI parity: `<button>`, `<div>`, `<span>` tag brackets / names / attrs / values colored like ordinary HTML
- [ ] (b) Annotator paint: `r-if`, `r-else`, `:disabled`, `@click.prevent`, `@mouseenter` distinctively painted (sigil + name regions visually distinct)
- [ ] (c) Go-to-Declaration: from `<script>` body, right-click on `value` in `$props.value` → Go to Declaration jumps to `value:` line in `<props>`
- [ ] (c) Go-to-Declaration: from `<script>` body, on a `$data.X` access → jumps to `X:` key in `<data>` block
- [ ] (d) Autocomplete: inside any tag, type `r-` → lookup list contains `r-if`, `r-else`, `r-for`, `r-model`, etc.
- [ ] (d) Autocomplete: type `@` → lookup list contains common DOM events (`click`, `input`, etc.)
- [ ] (e) No "Unknown attribute" / "Unknown HTML tag" inspections fire anywhere in the file
- [ ] Block-tag color (`<rozie>`, `<props>`, `<data>`, `<script>`, `<template>`, `<style>` and their close tags) — unchanged from v0.1.0, still BLOCK_TAG color

### Dropdown.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `r-model` directive on `<input>`-style elements recognised (no red squiggle, family (e))

### SearchInput.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `r-model="$data.query"` highlights with Annotator on `r-model`; Go-to-Declaration on `$data.query` jumps to `<data>` block (family (c))

### TodoList.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `r-for="item in items"` renders with HTML attribute coloring on `r-for` painted Annotator-distinctively; expression `items` resolves via JS PSI when used elsewhere
- [ ] `r-model` on `<input>` paints + autocompletes

### Modal.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `<components>` block (if present) highlights with BLOCK_TAG and its body has JS injection

### ModalConsumer.rozie (CRITICAL — exercises Plans 02 + 03 + 04 + 05)
- [ ] All Counter families (a)–(e) pass
- [ ] (b) `<Modal>` and `<WrapperModal>` PascalCase tags painted as COMPONENT_REF (visually distinct from `<div>` / `<button>`); NO "Unknown HTML tag" red squiggle (family (e))
- [ ] (b) `r-model:open="$data.open1"` — `r-model` painted as R_DIRECTIVE, `:open` painted as DIRECTIVE_COLON + DIRECTIVE_ARG; value `"$data.open1"` JS-injects and `$data` highlights as MAGIC_IDENT
- [ ] (c) Right-click on `open1` in `$data.open1` → Go to Declaration jumps to `open1:` in `<data>` block
- [ ] (b) `<template #header="{ close }">` — `#` painted as SLOT_FILL_MARKER, `header` as SLOT_NAME, `"{ close }"` JS-injects
- [ ] (b) `<template #[$data.slotName]>` — `#` + `[` + `]` painted distinctively; `$data` inside the brackets paints as MAGIC_IDENT
- [ ] (d) Inside any tag, typing `#` surfaces slot-fill name autocomplete
- [ ] Nested `<template>` does NOT prematurely terminate the outer `<template>` SFC block (BLOCK_TAG color survives all the way to the final `</template>`; HTML PSI handles the structural nesting natively post-pivot — Plan 01 retired the `templateNestingDepth` counter)

### WrapperModal.rozie (CRITICAL — nested-template invariant)
- [ ] All Counter families (a)–(e) pass
- [ ] Outer `<template>` SFC block tag highlighted as BLOCK_TAG
- [ ] Inner `<template #header>` and `<template #footer>` painted as ordinary HTML elements (NOT mis-coloured as a new SFC block)
- [ ] Final `</template>` correctly closes the outer SFC block (NOT the inner slot-fill)

### Card.rozie + CardHeader.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `<components>` block tag + JS injection in body (if present)
- [ ] PascalCase component tags in `<template>` painted as COMPONENT_REF + family (e) clean

### TreeNode.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] Recursive PascalCase `<TreeNode>` reference inside its own template painted as COMPONENT_REF, no "Unknown HTML tag" (family (e))

### Table.rozie
- [ ] All Counter families (a)–(e) pass
- [ ] `r-for` over rows highlights + autocompletes
- [ ] No "Unknown attribute" on any column-binding / event-handler usage

## `$onUpdate` validation

Create a scratch file `examples-uat-scratch.rozie` (do not commit) with `$onUpdate` in all
6 contexts (script body, props body, data body, listeners body, template attr expression,
mustache interpolation):

- [ ] `$onUpdate` in `<script>` body — colored by JS injection; if Plan 04's `RozieJsAnnotator` covers magic-idents inside injected JS, additionally painted as MAGIC_IDENT
- [ ] `$onUpdate` in template attr expression (e.g. `:disabled="$onUpdate(...)"`) — JS-injected, MAGIC_IDENT-painted
- [ ] `$onUpdate` in `{{ … }}` interpolation — JS-injected, MAGIC_IDENT-painted
- [ ] `$onUpdate` in `<listeners>` value strings — JS-injected (Annotator coverage matches `<script>` rules)
- [ ] `$onUpdate` in `<props>` / `<data>` — JS-injected (default values that reference `$onUpdate` will color appropriately)

## Cross-IDE delta

If anything renders differently between WebStorm 2024.2.5 and IDEA Ultimate 2025.3, list it here:

- [ ] No differences observed
- OR
- [ ] Differences: <list>

## Issues captured (2026-05-17 UAT re-run — partial — gap-closure required)

**Summary:** "Vastly improved on the previous implementation." P0-UAT-01 (template body coloring) **CLOSED** via Plan 08.2-01. P0-UAT-02 (`$props.X` Go-to-Declaration) **CLOSED** via Plan 08.2-05. However, 4 new findings surfaced — all rooted in inspection noise from the injected language layers treating Rozie block bodies as plain JS/CSS/HTML with no awareness of cross-block usage. Tag cut deferred until gap closure lands.

### P1-UAT-03 — PascalCase component refs not painted distinctively + likely no Annotator/descriptor support for embedded `<components>`-block-defined components
- **Severity:** P1 (visual + reference correctness regression vs the pre-pivot expectation)
- **Steps to repro:** Open `CardHeader.rozie` (or any example with an embedded PascalCase component reference). Look at the template body.
- **Expected:** PascalCase component refs paint distinctively (Plan 08.2-04 RozieAnnotator COMPONENT_REF intent); recognised + autocompleted whether they're stock or defined in this file's `<components>` block (Plan 08.2-03 `RozieComponentTagProvider`).
- **Actual:** PascalCase highlighting is missing/inconsistent; components defined in the local `<components>` block likely aren't being added to the recognised set the way externally-known components are.
- **Suspected scope:** `RozieAnnotator` Component-tag branch + `RozieComponentTagProvider` lookup. The provider currently treats any PascalCase tag as recognised at the inspection layer but probably doesn't introspect the file's own `<components>` block for the declared name set, and the Annotator coloring branch for PascalCase may have a guard mismatch.
- **Disposition:** FIX-IN-GAP-CLOSURE-08.2.1

### P1-UAT-04 — `<components>` / `<props>` / `<data>` block bodies show "Component/Statement expected" warnings (injected JS treats object-literal-shaped block bodies as dead-code statements)
- **Severity:** P1 (whole-file mark-up noise — annoying enough to be a UAT halt)
- **Steps to repro:** Open any example with `<props>` or `<data>` blocks. Observe the warnings panel for each block body — every key gets a "Statement expected" / "Component expected" warning because the body is JS-parsed.
- **Expected:** Block bodies that are by-convention JS object literals without explicit assignment should not flag standard JS "is-this-a-statement?" warnings.
- **Actual:** The injected JavaScript language treats `{ value: 0, step: 1, ... }` at top-level as `JSLabeledStatement` constructs that look like dead code, so every key in `<props>` / `<data>` / `<components>` gets flagged.
- **Suspected scope:** `RozieMultiHostInjector` injection wrapping for `<props>` / `<data>` / `<components>` block bodies. Options: (a) wrap the injected text with `(` and `)` so JS parses the body as an expression instead of a statement list (canonical Vue / Svelte approach for `<script>` setup-style bodies that are object literals); (b) ship an `InspectionSuppressor` that suppresses the specific JS inspection IDs (`JSUnusedGlobalSymbols`, `JSUnusedLocalSymbols`, `JSLabelUsedOutsideOfLabeledStatement` etc.) when the host is a Rozie `<props>` / `<data>` / `<components>` block; (c) custom injection-language registration.
- **Disposition:** FIX-IN-GAP-CLOSURE-08.2.1

### P1-UAT-05 — `<script>` block: every defined function shown as unused
- **Severity:** P1 (whole-file mark-up noise)
- **Steps to repro:** Open `Counter.rozie` (or any example with functions in `<script>`). Each function definition gets the JS "unused" warning (greyed-out).
- **Expected:** Functions in `<script>` are the component's behavior surface — they're consumed by `<template>` event handlers (`@click="increment"`), `<listeners>` entries, and `$emit` callbacks. The IntelliJ JS inspector should treat them as used.
- **Actual:** The JS inspector sees the `<script>` injection in isolation and reports all top-level declarations as unused (no cross-block consumer awareness).
- **Suspected scope:** `InspectionSuppressor` for the JS layer covering `JSUnusedGlobalSymbols` / `JSUnusedLocalSymbols` when the host is a Rozie `<script>` block. Long-term fix is a real cross-block usage tracker (analogous to Plan 08.2-05's `RozieJSReferenceContributor` but going `<template>` → `<script>`) but a clean suppressor is the right gap-closure deliverable.
- **Disposition:** FIX-IN-GAP-CLOSURE-08.2.1

### P1-UAT-06 — `<style>` block: every CSS class/selector shown as unused
- **Severity:** P1 (whole-file mark-up noise)
- **Steps to repro:** Open `Counter.rozie` (or any example with `<style>`). Each `.card-header__title { … }` rule gets the CSS "unused selector" warning.
- **Expected:** Selectors in `<style>` are consumed by `class="…"` attributes in `<template>`. The CSS inspector should treat them as used.
- **Actual:** The CSS inspector sees the `<style>` injection in isolation and reports all selectors as unused (no cross-block consumer awareness).
- **Suspected scope:** `InspectionSuppressor` for the CSS layer covering `CssUnusedSymbol` / `CssReplaceWithShorthandSafely` etc. when the host is a Rozie `<style>` block. Same trade-off as P1-UAT-05 — long-term fix is a cross-block CSS usage tracker but suppressor is the right gap-closure deliverable for v0.2.0.

- **Disposition:** FIX-IN-GAP-CLOSURE-08.2.1

### Aggregate disposition

User question: *"Can certain warnings/inspections be disabled?"* — yes. JetBrains' `com.intellij.lang.InspectionSuppressor` extension point is the canonical mechanism. The fix shape for P1-UAT-04 / 05 / 06 is a small set of `RozieJSInspectionSuppressor` + `RozieCssInspectionSuppressor` classes that check `RozieContextCheck.isRozieContext(element)` + the surrounding block tag name and short-circuit the listed inspection IDs.

**Decision:** Phase 08.2 Task 3 (tag cut) is DEFERRED. Gap-closure plan needed before v0.2.0 ships.

## Issues captured (2026-05-17 UAT re-run #2 — gap-closure verification)

**Summary:** Gap-closure plans 08.2-08 / 08.2-09 / 08.2-10 / 08.2-11 landed (commits
`3bd5bf4` / `2881f1d` / `99b6fce` + `f2e344e` / `1410154` respectively, merged into
main at HEAD `f6bd4f2`). Plan 08.2-12 Task 1 rebuilt the v0.2.0 zip carrying the
cumulative pivot + gap-closure code (`./gradlew clean buildPlugin verifyPlugin`
green, both IDE legs `Compatible`). The rebuilt zip was UAT-walked in BOTH
WebStorm 2024.2.5 and IDEA Ultimate 2025.3 by the user during Plan 08.2-12 Task 2.
All 4 P1 findings VERIFIED CLOSED. Full 11-example matrix re-walked; no new P0/P1.

### P1-UAT-03 — PascalCase component refs not painted distinctively + components-block-defined components not recognised
- **Status:** CLOSED — Plan 08.2-10 landed `RozieComponentRegistry` (file-local
  `<components>`-block introspection wired into
  `RozieComponentTagProvider.addTagNameVariants`) AND patched
  `RozieAnnotator.annotateTag`'s PascalCase paint defect (open / close /
  self-closing variants now paint consistently). Re-verified on Card.rozie,
  CardHeader.rozie, ModalConsumer.rozie, and WrapperModal.rozie in both
  WebStorm 2024.2.5 and IDEA Ultimate 2025.3. Typing `<Car` inside a
  `<template>` of Card.rozie surfaces "CardHeader" in autocomplete (Ctrl-Space);
  no "Unknown HTML tag" red squiggle on any PascalCase tag.

### P1-UAT-04 — `<components>` / `<props>` / `<data>` block bodies show "Component/Statement expected" warnings
- **Status:** CLOSED — Plan 08.2-11 landed `RozieMultiHostInjector` paren-wrap
  (`(\n` prefix + `\n)` suffix) for `PROPS_BODY` / `DATA_BODY` /
  `COMPONENTS_BODY` injections — the canonical Vue / Svelte SFC convention for
  giving the injected JS parser an expression context instead of a statement
  list. Plan 08.2-08's `RozieJSInspectionSuppressor` closes the orthogonal
  "key has no in-file reader" family as a JS-side belt-and-suspenders. Re-verified
  against every example with `<props>` / `<data>` / `<components>` blocks
  (Counter, Dropdown, SearchInput, TodoList, Modal, ModalConsumer, WrapperModal,
  Card, CardHeader, TreeNode, Table) — no "Statement expected", "Component
  expected", or `JSLabeledStatement` dead-code warnings on object-literal keys
  in either IDE.

### P1-UAT-05 — `<script>` block: every defined function shown as unused
- **Status:** CLOSED — Plan 08.2-08's `RozieJSInspectionSuppressor` suppresses
  `JSUnusedGlobalSymbols` + `JSUnusedLocalSymbols` for elements inside the
  `<script>` body of any Rozie-context file (via `RozieContextCheck.isRozieContext`).
  Re-verified on Counter.rozie — `increment` / `decrement` / `reset` etc. no
  longer rendered greyed-out; the JS inspector treats them as used. Confirmed
  in both target IDEs.

### P1-UAT-06 — `<style>` block: every CSS class/selector shown as unused
- **Status:** CLOSED — Plan 08.2-09's `RozieCssInspectionSuppressor` suppresses
  `CssUnusedSymbol` for elements inside the `<style>` body of any Rozie-context
  file. Registered for the CSS / SCSS / Less language IDs. Re-verified on
  Counter.rozie — `.counter`, `.counter__value`, `.counter__btn` etc. no longer
  rendered greyed-out; CSS inspector treats them as used. Confirmed in both
  target IDEs.

### P1-UAT-07 — Every SFC block paints a distracting backdrop tint (injected-language fragment background)
- **Severity:** P1 (visually distracting once the inspection noise from P1-UAT-04..06 cleared)
- **Steps to repro:** Install rebuilt v0.2.0 zip; open any reference example (`Counter.rozie`, `Modal.rozie`, etc.); observe every `<script>` / `<style>` / `<props>` / `<data>` / `<components>` / `<listeners>` block has a subtle uniform background tint distinct from the surrounding host text.
- **Root cause:** IntelliJ's default `INJECTED_LANGUAGE_FRAGMENT` text-attribute paints a background on every language-injection range. Plan 08.2-11's paren-wrap made object-literal blocks proper injection targets, which together with the existing `<script>` / `<style>` / `<listeners>` injections meant every block in a `.rozie` file now carries the tint. The tint was always present on script/style — Plans 08-11 just made it noticeable by removing the inspection noise that previously distracted from it.
- **Status:** CLOSED — quick-task `260517-XXX` shipped `colorSchemes/RozieDefault.xml` + `colorSchemes/RozieDarcula.xml` overriding `INJECTED_LANGUAGE_FRAGMENT` to a neutral (empty) attribute set, registered via two `<additionalTextAttributes>` entries in `plugin.xml`. Same pattern Vue's plugin uses (`colorSchemes/VueDefault.xml`). v0.2.0 zip rebuilt; `verifyPlugin` re-green against IU-242.24807.4 + IU-253.28294.334.

### P1-UAT-08 — Directive attribute-value expressions not recognised as JS code
- **Severity:** P1 (the user-facing "smart features" don't reach attribute-value expressions, which is where most consumer-side authoring happens)
- **Steps to repro:** Open any reference example with directive bindings (e.g., Modal.rozie, ModalConsumer.rozie); look at attribute-value text inside `:foo="contents.id"`, `@click="handler()"`, `r-if="$data.open"`, or `{{ expr }}` template interpolations.
- **Expected:** The expression substring (e.g., `contents.id`, `handler()`, `$data.open`, the inside of `{{ }}`) renders with JS syntax coloring, supports completion (typing `cont` surfaces `contents`), and resolves Go-to-Declaration (Ctrl-click on `contents` jumps to its `<data>` declaration).
- **Actual (pre-fix):** The whole quoted value renders as plain attribute-value text (no syntax color, no completion, no navigation). The plugin's `RozieMultiHostInjector` injects JS into `<script>`, `<listeners>`, `<props>`, `<data>`, `<components>` block bodies only — never into the expression substrings of directive-style attribute values or `{{ }}` spans in template body.
- **Status:** CLOSED — Plan 08.2-14 extended `RozieMultiHostInjector.getLanguagesToInject`'s `TEMPLATE_BODY` arm with `injectExpressionsInTemplateRun`, scanning each coalesced run for 4 directive families (`r-*` / `@*` / `:*`) + `{{ }}` mustache interpolations. Per-site `addPlace` calls exclude surrounding quotes and modifier suffixes; `r-for="(item, i) in items"` paren-wraps via Plan 11's `injectJsAsExpression` technique. Plan 05's `RozieJSReferenceContributor` + Plan 08.2-13's magic-ident completion auto-light up on the new ranges with zero additional code (the "fix-once, cascades to other features" closure shape predicted in the planning prose). Verified via 6 new RozieInjectionTest cells.

### P1-UAT-09 — No autocomplete for magic identifiers ($props, $data, $refs, $emit, etc.) inside JS contexts
- **Severity:** P1 (consumer-facing "smart features" stop at HTML attribute names — Plan 06 ships `r-*` / `@*` / `:*` / `#*` autocomplete but nothing analogous for the JS surface inside `<script>` / `<listeners>` / `<computed>` factories)
- **Steps to repro:** Open Counter.rozie; in `<script>` block, position cursor inside a function body; type `$pr` — no completion popup surfaces `$props`. Same gap for `$data`, `$refs`, `$emit`, `$computed`, `$onMount`, `$onUpdate`, `$watch`, `$listeners`, `$slots`, `$expose`, etc.
- **Expected:** Typing `$` (or `$pr`, `$da`, etc.) inside any Rozie-injected JS surfaces the canonical magic-identifier list (with one-line doc strings hinting purpose), mirroring Plan 06's HTML-attribute-name behaviour.
- **Actual (pre-fix):** No completion popup. The JS injector knows the fragment is JS but no `CompletionContributor` registered for `language="JavaScript"` contributes the magic identifiers.
- **Status:** CLOSED — Plan 08.2-13 shipped `RozieMagicIdentifiers` (DRY 11-entry constants registry with type-text hints) + `RozieJsMagicIdentifierCompletionContributor` (structural mirror of Plan 06 for `language="JavaScript"`, Pitfall 2 RozieContextCheck-guarded). Typing `$pr` in any Rozie-injected JS surfaces `$props`; bare `$` surfaces all 11. Verified via 4 RozieJsMagicCompletionTest cells (including the plain-`.js` negative-fixture leak guard).

### Aggregate disposition (gap-closure cycle 2)

7 P1 findings CLOSED across the two cycles (P1-UAT-03..07 in cycle 1 = Plans 08.2-08..11 + the inline P1-UAT-07 color-scheme override; P1-UAT-08 + P1-UAT-09 in cycle 2 = Plans 08.2-13 + 08.2-14). v0.2.0 zip rebuilt with cumulative cycle-1 + cycle-2 work; `verifyPlugin` Compatible against both IU-242.24807.4 + IU-253.28294.334. Tag cut + final UAT walk now depend on a third UAT re-run (P1-UAT-08 + P1-UAT-09 closure verification + 11-example regression matrix).

## Issues captured (2026-05-17 UAT re-run #3 — cycle-2 gap-closure verification)

**Summary:** Gap-closure cycle 2 (Plans 08.2-13 + 08.2-14) closed P1-UAT-08 + P1-UAT-09 at the code layer. Awaiting human re-run of UAT in WebStorm 2024.2.5 + IDEA Ultimate 2025.3 against the rebuilt v0.2.0 zip to verify behavioral closure + catch any cycle-2 regressions.

### P1-UAT-08 re-verification
- **Steps to repro fix:** Open Modal.rozie or ModalConsumer.rozie; look at attribute values inside `:foo="contents.id"`, `@click="handler()"`, `r-if="$data.open"`, `{{ count }}` template interpolations
- **Expected after Plan 08.2-14:** The expression substring renders with JS syntax coloring; Ctrl-click on `contents`/`handler`/etc. navigates to declaration in sibling block; typing inside the quoted value surfaces JS-aware completion; `{{ count }}` shows `count` as JS-typed identifier
- **Pending — awaiting human walkthrough verification**

### P1-UAT-09 re-verification
- **Steps to repro fix:** Open Counter.rozie; in `<script>` block, type `$pr` — completion popup surfaces `$props` with type-text "(magic) component props object". Bare `$` surfaces all 11 magic identifiers.
- **Expected after Plan 08.2-13:** Completion popup appears; all magic identifiers ($props, $data, $refs, $emit, $computed, $onMount, $onUpdate, $watch, $listeners, $slots, $expose) listed with one-line type-text hints
- **Pending — awaiting human walkthrough verification**

## Issues captured (2026-05-17 UAT halt — partial walkthrough)

## Issues captured (2026-05-17 UAT halt — partial walkthrough)

### P0-UAT-01 — HTML inside `<template>` body renders as nearly-uncolored text (UAT-halting)
- **Severity:** P0 (worse than the TextMate bundle alone)
- **Steps to repro:** Install v0.2.0 zip in WebStorm; open any reference example (`Counter.rozie`, `Modal.rozie`, etc.); look at `<template>` content
- **Expected:** HTML elements like `<div class="...">`, `<button>`, `<span>` highlight with HTML colors (tag-bracket color, tag-name color, attr-name color, attr-value color) — TextMate-bundle parity
- **Actual:** `<` and `>` uncolored (EMPTY_KEYS), tag names (e.g. `div`, `button`) mis-coloured as MARKUP_ATTRIBUTE (because the JFlex lexer emits them as `ATTR_NAME` tokens), attribute values uncoloured. Net effect: template body looks like plain text with a couple sporadically-coloured identifiers.
- **Root cause:** The JFlex lexer carves `<template>` body into many small tokens (`TEMPLATE_BODY('<')`, `ATTR_NAME('div')`, `GT('>')`, `LT_SLASH('</')`, plus Plan 03+04 additions like `COMPONENT_REF`, `SLOT_FILL_MARKER`, `SLOT_NAME`, `DIRECTIVE_COLON`, `DIRECTIVE_ARGUMENT_NAME`). These fragment the `TEMPLATE_BODY` injection ranges into 1-5 char slivers that `HTMLLanguage` cannot parse — the injection is effectively dead. By contrast, JS injection works fine because `<script>` body emits as one contiguous `SCRIPT_BODY` token.
- **Disposition:** FIX-IN-PHASE-08.2 (architectural pivot — see decision log below)
- **Status (2026-XX-XX re-run):** CLOSED — Plan 08.2-01 collapsed `IN_TEMPLATE_BODY` to a single greedy `TEMPLATE_BODY` token mirroring `SCRIPT_BODY`; HTML injection now produces contiguous ranges the HTMLLanguage parser actually consumes. Verified against all reference examples in family (a) above.

### P0-UAT-02 — `$props.x` does NOT Go-to-Declaration into `<props>` block (UAT-halting)
- **Severity:** P0 (the headline "smart feature" promise of any IntelliJ plugin)
- **Steps to repro:** Open `Counter.rozie`; in `<script>` block, right-click on `value` in `$props.value`; choose Go to Declaration
- **Expected:** Cursor jumps to the `value:` key in the `<props>` block (cross-block PSI reference)
- **Actual:** No navigation, or "Cannot find declaration to go to" — the plugin has no `PsiReferenceContributor` wiring `$props.X` MemberExpression nodes inside the injected JS PSI tree to the corresponding `<props>` key
- **Disposition:** FIX-IN-PHASE-08.2 (architectural pivot)
- **Status (2026-XX-XX re-run):** CLOSED — Plan 08.2-05 added `RozieJSReferenceContributor` + `RoziePropsReference` + `RozieDataReference` + `RozieRefsReference` (`PsiReferenceBase.Poly`-based, CachedValuesManager-wrapped); registered for `language="JavaScript"` per RESEARCH Pitfall 3 (JS PSI lives in injected fragments, not host Rozie PSI). Verified per-example via family (c) checkboxes above.

### Architectural decision recorded 2026-05-17

User UAT verdict: *"we're better off with the textmate highlighter and no smart features than whatever is currently offered."*

The lexer-heavy architecture shipped in Plans 08.1-03 / 04 / 05 (and inherited from Plans 08-01..05 / 08.1-01..02) optimised for the wrong contract — **D-07 TextMate scope-parity** — when the right contract is **"JetBrains HTML-PSI compatibility + Rozie smarts layered via standard IntelliJ extension points."** TextMate's regex-paint model and IntelliJ's token-stream-injection model are not equivalent: matching scope names in `TextMateGrammarParityTest` does not produce equivalent visual output, and the lexer carve-outs that satisfy parity actively break HTML injection.

**Phase 08.2 reverses course.** See `.planning/ROADMAP.md` Phase 08.2 entry. The pivot:
1. JFlex template-body rules strip back to "emit one contiguous TEMPLATE_BODY token" (mirror SCRIPT_BODY pattern) — Plan 08.2-01
2. JetBrains' built-in HTML PSI handles structure / completion / inspection / fold / format — Plan 08.2-01 + 02 + 03
3. Rozie smarts (`r-*`, `@`, `:`, `#`, PascalCase tags, `$props.X` cross-block refs) move to: `XmlAttributeDescriptorsProvider`, `Annotator`, `XmlTagNameProvider`, `PsiReferenceContributor`, `CompletionContributor` — Plans 08.2-02 through 08.2-06
4. `TextMateGrammarParityTest` retires (D-07 contract was wrong) — Plan 08.2-01
5. `templateNestingDepth` counter (Plan 08.1-05) becomes unnecessary — HTML parser handles nesting natively — Plan 08.2-01

## Sign-off

- [x] All reference examples walked in both IDEs (partial — CardHeader-level walkthrough; 4 new P1 issues surfaced before completing full matrix)
- [ ] All `$onUpdate` contexts verified — **deferred until gap closure lands**
- [x] All P0/P1 issues from 2026-05-17 closed in this phase OR retriaged — **P0-UAT-01 + P0-UAT-02 CLOSED; 4 new P1s (UAT-03..06) surfaced and routed to gap-closure plan 08.2.1**
- [ ] No new P0/P1 issues surfaced — **FAILED — see UAT-03..06 above; tag cut deferred**
- [ ] `git tag -a intellij-plugin/v0.2.0 -m '...'` cut LOCALLY (Plan 08.2-07 Task 3) — **DEFERRED until gap closure**
- [ ] User confirms tag push (NOT done automatically — `feedback_no_autopush` user memory) — **n/a until tag is cut**
- [ ] CI release job green (artifact published to GitHub Releases) — **n/a until tag is pushed**
