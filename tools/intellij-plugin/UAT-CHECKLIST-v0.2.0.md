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

## Issues captured (2026-XX-XX UAT re-run — to fill in)

For each "isn't quite right" finding, file:
- Title:
- Severity (P0 blocker / P1 fix-this-phase / P2 follow-up):
- Steps to repro:
- Expected vs actual:
- Disposition (FIX-IN-PHASE-08.2 / TRIAGE-FOLLOWUP):

If both P0s from 2026-05-17 are closed and no new P0/P1 surfaces, append:

> **2026-XX-XX UAT re-run — PASSED.** P0-UAT-01 (template body coloring) CLOSED via single-token TEMPLATE_BODY + HTML PSI injection (Plan 08.2-01). P0-UAT-02 (`$props.X` Go-to-Declaration) CLOSED via `RozieJSReferenceContributor` (Plan 08.2-05). No new P0/P1 issues surfaced across either IDE.

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

- [ ] All reference examples walked in both IDEs (Counter, Dropdown, SearchInput, TodoList, Modal, ModalConsumer, WrapperModal, Card, CardHeader, TreeNode, Table)
- [ ] All `$onUpdate` contexts verified
- [ ] All P0/P1 issues from 2026-05-17 closed in this phase OR retriaged
- [ ] No new P0/P1 issues surfaced
- [ ] `git tag -a intellij-plugin/v0.2.0 -m '...'` cut LOCALLY (Plan 08.2-07 Task 3)
- [ ] User confirms tag push (NOT done automatically — `feedback_no_autopush` user memory)
- [ ] CI release job green (artifact published to GitHub Releases)
