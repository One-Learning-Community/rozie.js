---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
reviewed: 2026-09-01T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .changeset/combobox-multiselect-floating-creatable.md
  - docs/components/combobox-comparison.md
  - docs/components/combobox-theming.md
  - docs/components/combobox.md
  - docs/components/popover-comparison.md
  - docs/components/popover.md
  - examples/demos/ComboboxCreatableDemo.rozie
  - examples/demos/ComboboxFloatingDemo.rozie
  - examples/demos/ComboboxMultiDemo.rozie
  - package.json
  - packages/core/src/manifest/buildManifest.test.ts
  - packages/ui/combobox/__fixtures__/rozie-manifest.expected.json
  - packages/ui/combobox/package.json
  - packages/ui/combobox/packages/react/src/Combobox.d.ts
  - packages/ui/combobox/scripts/codegen.mjs
  - packages/ui/combobox/scripts/compile-combobox-check.mjs
  - packages/ui/combobox/scripts/event-manifest.mjs
  - packages/ui/combobox/src/Combobox.rozie
  - packages/ui/combobox/src/themes/base.css
  - packages/ui/combobox/tests/creatable.behavior.test.ts
  - packages/ui/combobox/tests/floating-popover.behavior.test.ts
  - packages/ui/combobox/tests/multiple.behavior.test.ts
  - packages/ui/combobox/tests/prohibitions.test.ts
  - packages/ui/combobox/tests/surface.test.ts
  - packages/ui/popover/__fixtures__/rozie-manifest.expected.json
  - packages/ui/popover/scripts/compile-popover-check.mjs
  - packages/ui/popover/src/Popover.rozie
  - packages/ui/popover/src/internal/middleware.test.ts
  - packages/ui/popover/src/internal/middleware.ts
  - packages/ui/popover/tests/surface.test.ts
  - tests/visual-regression/host/main.ts
  - tests/visual-regression/specs/combobox-virtual.spec.ts
  - tests/visual-regression/specs/combobox.spec.ts
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 86: Code Review Report

**Reviewed:** 2026-09-01
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 86 is large (1,883-line `Combobox.rozie`, a new composition chain, and 18
release-wave leaves) and the behavioral test suites genuinely exercise most of
the locked R1/R2/R3 edges — the toggle/dedup/freshness/ordering assertions in
`multiple.behavior.test.ts` and the exact-match/idempotency/encoding
assertions in `creatable.behavior.test.ts` are real mount-and-drive proofs,
not decorative. I did not re-litigate anything the verifier already closed
(typecheck/test counts, the `disableDismiss` regression fix, the changeset
shape).

Two BLOCKER-class defects survived that automated gates could not have
caught: a generated `.d.ts` that fails `tsc --strict` with 14 duplicate
identifiers (reproduced directly below), and a chip-removal control that
omits the `@mousedown.prevent` idiom every other interactive row in this same
file uses — meaning it will visibly misbehave in a real browser even though
every DOM-event test asserting on it uses synthetic events that don't
reproduce the hazard. Two WARNING-class findings concern the composed-popover
architecture: `inline` mode silently gained a document-level dismissal
listener the SPEC's own acceptance criteria say it shouldn't have, and the
root `pnpm.overrides` block that makes `pnpm install --frozen-lockfile`
succeed today is an open-ended override with no removal trigger once
combobox actually ships `0.5.0`. Two INFO items are minor drift.

## Critical Issues

### CR-01: The emitted React `.d.ts` fails `tsc --strict` with 14 duplicate-identifier errors

**File:** `packages/ui/combobox/packages/react/src/Combobox.d.ts:106-120`
**Issue:**

`ComboboxProps` declares `renderOption` five times, `renderEmpty` five times,
`renderCreate` four times, and `renderGroupHeading` twice — one copy per
`<slot>` occurrence in each of the four mutually-exclusive render branches
(plain / grouped / grouped+capped / windowed), never deduplicated by slot
name. This reproduces with a plain, direct `tsc` invocation against the file
as committed:

```
$ cd packages/ui/combobox/packages/react && npx tsc --noEmit --strict \
    --jsx react-jsx --module es2020 --moduleResolution node src/Combobox.d.ts

src/Combobox.d.ts(106,3): error TS2300: Duplicate identifier 'renderOption'.
src/Combobox.d.ts(107,3): error TS2300: Duplicate identifier 'renderEmpty'.
src/Combobox.d.ts(108,3): error TS2300: Duplicate identifier 'renderCreate'.
src/Combobox.d.ts(109,3): error TS2300: Duplicate identifier 'renderGroupHeading'.
... (14 total)
```

The pre-Phase-86 file already carried this bug for `renderOption`/
`renderEmpty`/`renderGroupHeading` (confirmed via `git diff
a33de17430b^..HEAD`), so the underlying emitter defect — the dts-slot
synthesizer emits one `render<Slot>` entry per template occurrence instead of
per distinct slot name — predates this phase. Phase 86 makes it materially
worse: it adds the brand-new `renderCreate` prop and reproduces the exact
same per-branch duplication for it (4 new duplicate declarations), and it is
the phase that first makes the defect trivially reproducible (`renderCreate`
alone is 4 duplicates of a prop that did not exist before this phase).

This does not show up in `turbo run typecheck` (324/324, already verified)
because that path runs with `skipLibCheck` effectively suppressing full
re-check of already-`.d.ts`-typed files; it *will* break any consumer whose
own `tsconfig.json` sets `skipLibCheck: false` (a real, not hypothetical,
posture for strict-TS shops — this is exactly the class of consumer the
project's own "consumer-typed slot param gate" exists to protect). This is a
`@rozie/core` dts-synthesis bug, not something to hand-patch in the generated
leaf — flagging as an emitter gap per project convention, not proposing a
local fix that codegen would overwrite.

**Fix:** In the type-emission pass that synthesizes `render<Slot>` props from
`<slot>` occurrences, deduplicate by slot **name** across the whole component
(union/merge the per-branch param shapes if they ever diverge) before
emitting the interface, the same way `manifest.slots` is already deduplicated
elsewhere in the pipeline. Regenerate all six leaves (Solid's `.d.ts` likely
carries the identical defect — same render-prop-from-slot pattern — but was
not in this phase's file list to confirm directly) and add a `tsc --strict`
smoke check over the emitted `.d.ts` to the surface gate so this class of
regression fails fast next time.

### CR-02: Removing a chip closes the whole popup and clobbers an in-progress query, because the remove button skips the `@mousedown.prevent` idiom every other row uses

**File:** `packages/ui/combobox/src/Combobox.rozie:1346-1352` (button), compare `:1406`/`:1474`/`:1538`/`:1550`/`:1572`/`:1616`/`:1640` (every other interactive row)
**Issue:**

Every selectable row in the popup — options, the "+N more" row, and the
create row — commits via `@mousedown.prevent="selectOption(...)"` specifically
so that mousedown's default focus-steal never fires the input's `blur` before
the pick is committed (the file's own header comment on `onFocus`/`onBlur`
explains exactly this hazard). The chip-rail remove button breaks that
pattern:

```
<button
  type="button"
  class="rozie-combobox-chip__remove"
  :disabled="!!$props.disabled"
  :aria-label="chipRemoveLabel(row)"
  @click="removeChipValue(row.value)"
>×</button>
```

It uses a bare `@click`, not `@mousedown.prevent`. In a real browser (not the
happy-dom harness, which drives this exact assertion with a synthetic
`new MouseEvent('click', ...)` that never simulates native focus-follows-
mousedown — see `multiple.behavior.test.ts` test (11)), clicking this button
triggers: mousedown → the browser shifts focus to the button → the input
fires a native `blur` → `onBlur()` (line 1026) sees `$data.pinned === false`
and `openingInProgress === false`, so it sets `$data.isOpen = false`,
collapsing the entire composed `<Popover>` → *then* the `click` fires and
`removeChipValue()` runs correctly. The removal itself works, but the popup
that `effectiveCloseOnSelect()` is explicitly designed to keep open in
`multiple` mode ("closing after every chip pick would make multi-select
unusable" — the prop's own doc comment, line 172) closes anyway, on every
chip removal, regardless of that setting.

A second, related effect of routing chip removal through `selectOption()`'s
`multiple` branch (line 918-933) unconditionally: `$data.query = ''` runs on
*every* commit in that branch, pick or removal alike (line 929, comment
"D-14: clear the query on pick"). So removing a chip via the mouse also
silently discards whatever the user had typed into the search box at that
moment — not just closing the popup, but losing in-progress filter text.

This exact class of hazard is one the team demonstrably hit and worked
around *elsewhere* in this same phase: `combobox-virtual.spec.ts`'s own
86-03 deviation comment documents that composing Popover gave the control "a
document-level click-outside dismiss listener it never had before... gated
on `open` only... no descendant handler can ever intercept it," forcing that
spec to switch from `.click()` to a raw `dispatchEvent('mousedown')`. That
fix addressed a *different* button (outside the control, triggering the
click-outside listener); the chip-remove button (which sits *inside*
`anchorEl` and so never trips click-outside) needed the mousedown-vs-blur
fix instead, and did not get it.

**Fix:** Add `.prevent` to the chip remove button's interaction, mirroring
every other row:

```
<button
  type="button"
  class="rozie-combobox-chip__remove"
  :disabled="!!$props.disabled"
  :aria-label="chipRemoveLabel(row)"
  @mousedown.prevent="removeChipValue(row.value)"
>×</button>
```

Separately, consider having `removeChipValue()` route through a path that
does *not* clear `$data.query` — e.g. a small `isRemoval` flag on the
synthetic wrapper row that `selectOption()`'s `multiple` branch checks before
the `$data.query = ''` line — so removing a chip never discards unrelated
in-progress search text.

## Warnings

### WR-01: `inline` mode is no longer "no popover involvement" — it inherits a real document-level Escape/click-outside listener, contradicting a locked SPEC acceptance criterion

**File:** `packages/ui/popover/src/Popover.rozie:467-469` (listeners), `packages/ui/combobox/src/Combobox.rozie:1311-1322` (composed `<Popover>` bindings)
**Issue:**

`86-SPEC.md`'s Acceptance Criteria list locks: "The popup flips above the
input at a viewport edge ×6; the `inline` path involves no popover." Popover's
own dismissal listeners are gated *only* on `$props.open && !$props.disableDismiss`:

```
<listener :target="document" @keydown.escape="dismiss" r-if="$props.open && !$props.disableDismiss" />
<listener :target="document" @click.outside($refs.anchorEl,$refs.floatingEl)="dismiss" r-if="$props.open && !$props.disableDismiss" />
```

Combobox forwards `:disable-positioning="$props.inline"` (which correctly
suppresses `computePosition`/`autoUpdate`) but forwards only
`:disable-dismiss="$data.pinned"` — never `$props.inline` — into
`disableDismiss`. So an `inline` consumer (command-palette, in its ordinary
un-pinned flow — `pinOpen()` is used only around specific sub-surface flyouts
per the 86-07 regression-fix commit) now attaches a real document-level
Escape-key and click-outside listener whenever its combobox list is open,
something the pre-Phase-86 `inline` combobox never had (it only closed on
`blur`). This is a materially different, and broader, claim than the
changeset-wording imprecision the verifier already flagged ("`inline` ...
no popover involvement" is cosmetically loose there); here the *mechanism*
itself — a new, always-on document listener — is live for every `inline`
consumer, not merely described imprecisely. Whether this collides with
command-palette's own dismissal handling (e.g. its own Escape-to-close on the
same `document` target) could not be confirmed from the files in this
phase's scope, but the SPEC's own acceptance bullet is not met as written.

**Fix:** Either forward `$props.inline` into `disableDismiss` as well
(`:disable-dismiss="$props.inline || $data.pinned"`), or explicitly amend the
SPEC/changeset language to describe the intentional new behavior ("`inline`
now also gets real click-outside/Escape dismissal") and confirm with
command-palette's own event handling that the two listeners don't race.

### WR-02: The `pnpm.overrides` block that makes `frozen-lockfile` install succeed today has no removal trigger and will keep silently overriding these six package names after release

**File:** `package.json:44-54`
**Issue:**

```
"pnpm": {
  "overrides": {
    "@rozie-ui/combobox-react": "workspace:*",
    "@rozie-ui/combobox-vue": "workspace:*",
    "@rozie-ui/combobox-svelte": "workspace:*",
    "@rozie-ui/combobox-solid": "workspace:*",
    "@rozie-ui/combobox-angular": "workspace:*",
    "@rozie-ui/combobox-lit": "workspace:*"
  },
  ...
}
```

At the current commit the six `packages/ui/combobox/packages/*/package.json`
files are still versioned `0.4.4`-`0.4.6` (changesets defers the actual bump
to the release step), while all six `@rozie-ui/command-palette-<target>`
leaves already declare `peerDependencies: { "@rozie-ui/combobox-<target>":
"^0.5.0" }` ahead of that bump. Combined with `.npmrc`'s
`auto-install-peers=true`, pnpm would otherwise try to auto-fetch a
`combobox-*@^0.5.0` that does not exist on the npm registry yet and fail; the
`workspace:*` override sidesteps that by force-resolving these six names to
the local workspace copy *regardless of the requested semver range*. That is
a reasonable, deliberate stopgap for the changesets chicken-and-egg problem —
but it is unconditional and permanent. Nothing in the phase's plans or the
changeset schedules its removal once `0.5.0` actually publishes, so from that
point on it will keep silently forcing these six specific package names to
resolve to whatever is locally checked out, bypassing the very semver-range
enforcement that R5's own acceptance criterion ("no leaf anywhere in the repo
still declares a `^0.4.0` combobox peer") depends on `pnpm install
--frozen-lockfile` to catch for any *future* accidental stale-range
regression on these exact packages.

**Fix:** Add a tracked follow-up (issue/backlog item) to delete this
`overrides` block once `@rozie-ui/combobox-*@0.5.0` is actually published and
the ordinary workspace-linking path resolves `^0.5.0` on its own, so the
override doesn't outlive its purpose.

## Info

### IN-01: `popover/tests/surface.test.ts`'s prop-count test title says "14 props"; the array it asserts against has 15

**File:** `packages/ui/popover/tests/surface.test.ts:63` (title), `:31` (array)
**Issue:** `EXPECT.props` lists `open, placement, strategy, trigger, offset,
disableFlip, disableShift, arrow, disabled, modal, bare, disablePositioning,
keepMounted, matchWidth, disableDismiss` — 15 entries (verified by direct
count) — but the test's own `it(...)` description reads `'props surface
matches (14 props)'`. The assertion itself (`expect(sorted(propNames)).toEqual(sorted(EXPECT.props))`)
is unaffected and still correct; only the human-readable count in the test
name is stale, apparently left at "14" from before `disableDismiss` was added
in the later 86-07 regression-fix commit.
**Fix:** Bump the title to `'props surface matches (15 props)'`.

### IN-02: `isCreatableQuery()`'s match formula trims the option label too, which is looser than the SPEC-locked formula

**File:** `packages/ui/combobox/src/Combobox.rozie:667-670`
**Issue:** `86-SPEC.md` R3 locks the match formula as `String(labelOf(o)).toLowerCase() === query.trim().toLowerCase()`
— trimming only the *query* side. The implementation trims both sides:

```js
const queryMatchesOption = (nq) => {
  const opts = Array.isArray($props.options) ? $props.options : []
  return opts.some((o) => String(labelOf(o)).trim().toLowerCase() === nq)
}
```

This is strictly more permissive than the locked formula (an option whose
label carries incidental leading/trailing whitespace now also counts as an
exact match), and it does not violate any of the SPEC's own acceptance
criteria (those are phrased in terms of query-side whitespace, which both
formulas handle identically). It is, however, a literal deviation from the
formula the SPEC locked verbatim, which is worth a maintainer's explicit
sign-off rather than silent drift.
**Fix:** Either update `86-SPEC.md`'s R3 formula to note the label is also
trimmed (if that's the intended, better behavior), or drop the `.trim()` on
the label side to match the SPEC text exactly.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
