---
spike: 013
name: lexical-sigil-collision
type: standard
validates: "Given a .rozie <script> using Lexical's $-prefixed API ($getSelection, $createParagraphNode, $getRoot, $isRangeSelection, $createTextNode), when compiled to all 6 targets, then those $-identifiers pass through verbatim without being captured by Rozie's reserved-sigil ($props/$data/$onMount…) or bare-object-sigil machinery — AND the emitted output compiles in each target's own compiler."
verdict: VALIDATED (with a required authoring convention)
related: [001, 010]
tags: [lexical, sigil-collision, rich-text-editor, killer-component-port, phase-999.1, svelte, dollar-prefix, gate, vanilla-js-wrapper]
---

# Spike 013: Lexical `$`-Sigil Collision (GATE)

## What This Validates

Given a `.rozie <script>` using Lexical's `$`-prefixed API, when compiled to all
six targets, then those `$`-identifiers pass through **verbatim** (not captured by
Rozie's reserved-sigil or bare-object-sigil machinery) **and the emit compiles in
each target's own compiler**.

This is the one genuinely-new compiler question for a Lexical port: no prior
engine wrapped in this lineage (SortableJS/flatpickr/TipTap/MapLibre — spikes
001–012) has a `$`-prefixed authoring API. It gates the whole port — a hard
failure here reshapes everything downstream.

## Research

**Rozie sigil machinery (read before building — `packages/core/src`):**
- `semantic/validators/reservedIdentifierValidator.ts` — `RESERVED_SIGILS` is a
  **fixed allow-list**: `$el, $props, $data, $refs, $slots, $emit, $event, $attrs,
  $listeners, $restoreFocus, $model, $expose, $provide, $inject, $clone`. There is
  **no broad `$`-prefix heuristic.** Lexical's `$getSelection`/`$createParagraphNode`/
  `$getRoot`/`$isRangeSelection`/`$createTextNode` are none of them. Also: ROZ202
  collision only fires for `<data>` field names and `r-for` loop vars that shadow a
  reserved sigil — never for arbitrary `<script>` calls.
- `semantic/validators/bareSigilValidator.ts` — ROZ978 flags only a hardcoded
  `{$props,$data,$refs,$slots}` used as *whole-object values*. `$getSelection` is
  not in that set.

→ Static prediction: Rozie passes Lexical's `$`-API through cleanly. Confirmed
empirically below. **But** static reading of the Rozie layer is insufficient — the
downstream target compiler must also accept the emit, which is where the real
finding lives.

## How to Run

```bash
# bare named-import form (breaks Svelte):
node packages/cli/dist/bin.cjs build .planning/spikes/013-lexical-sigil-collision/SigilProbe.rozie \
  -t vue,react,svelte,angular,solid,lit -o .planning/spikes/013-lexical-sigil-collision/dist

# namespace-import form (clean across all 6):
node packages/cli/dist/bin.cjs build .planning/spikes/013-lexical-sigil-collision/SigilProbeFixed.rozie \
  -t vue,react,svelte,angular,solid,lit -o .planning/spikes/013-lexical-sigil-collision/dist-fixed
```

Svelte-compiler acceptance check: compile the emitted `.svelte` with the repo's
`svelte@5.55` compiler (`generate: 'client'`) and read `dollar_prefix_invalid`.

## Investigation Trail

1. **Read the validators first.** Confirmed the reserved set is a closed allow-list
   with no `$`-prefix wildcard — strong signal the Rozie layer is clean.
2. **Probe 1 — bare named import** (`SigilProbe.rozie`): `import { $getSelection, … }
   from 'lexical'` used in a `<script>` helper, `$onMount`, an `@click` handler, and a
   `$computed`. Compiled all 6, exit 0, **zero diagnostics**. Grep confirmed every
   `$`-identifier present verbatim in all 6 emits — Rozie captures nothing.
3. **Surprise found via code-read, not grep:** React's `$computed`→`useMemo`
   lowering emitted the imported `$`-functions into the **dependency array**
   (`}, [$getSelection, $isRangeSelection]`). Presence-grep alone would have missed it.
4. **Escalation — presence ≠ compiles.** The `$`-identifiers being *in* the file
   doesn't mean the target compiler accepts them. Svelte reserves the `$` prefix
   (runes + store auto-subscription). Compiled the emitted `.svelte` with the real
   Svelte 5 compiler → **hard failure**:
   `dollar_prefix_invalid — The $ prefix is reserved, and cannot be used for
   variables and imports` (on `import { $getSelection … }`). The other 5 targets
   accept `$`-prefixed identifiers (valid JS/TS).
5. **Probe 2 — the fix** (`SigilProbeFixed.rozie`): namespace import
   `import * as lexical from 'lexical'` + `lexical.$getSelection()`. The `$` is now a
   *property name*, not a binding — outside Svelte's reservation. Compiled all 6
   (exit 0) and the emitted `.svelte` **compiles clean, zero warnings.** All 6 carry
   7 `lexical.$` member-calls. React dep array collapses to `[lexical]` (same benign
   over-capture, cleaner surface).

## Results

**VERDICT: VALIDATED — with a required authoring convention.**

- **Rozie compiler layer: fully clean.** Lexical's `$`-API passes through verbatim
  in all 6 targets, no reserved-sigil capture, no ROZ202/ROZ978, no diagnostics.
  The closed allow-list design is exactly right here.
- **Downstream target layer: 5/6 accept `$`-imports; Svelte does not.** Named
  `$`-imports (`import { $getSelection }`) hard-fail the Svelte compiler
  (`dollar_prefix_invalid`). This is the exact wall the real `svelte-lexical`
  community binding hit.
- **Single cross-target authoring form exists:** the **namespace import**
  (`import * as lexical from 'lexical'; lexical.$getSelection()`) compiles clean
  across all six, Svelte included. → **REQ-37.**

**Secondary finding (emitter hygiene, non-blocking):** React `$computed`→`useMemo`
(and by extension effect) dep-array analysis includes **module-scope imported
identifiers** as deps (`[lexical]`, or `[$getSelection, $isRangeSelection]` in the
named form). Harmless — module imports have stable identity, so the memo never
re-runs on their account (equivalent to `[]`) — but imprecise; ideally module-scope
imports are excluded from the reactive dep set. → **REQ-38** (candidate
emitter-backlog, red-first fixable). Not Lexical-specific — surfaced by Lexical only
because its API is import-heavy inside computeds.

**Impact on 014/015:** the Lexical editor-shell and plugin `.rozie` sources MUST use
the namespace-import form for all Lexical `$`-API. No other reshaping needed — the
gate is green.
