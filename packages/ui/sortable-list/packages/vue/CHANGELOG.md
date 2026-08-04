# @rozie-ui/sortable-list-vue

## 0.1.7

### Patch Changes

- Stale-publish reconciliation. The published `0.1.6` tarball shipped without a `web-types.json` IDE sidecar at all — it was missing from the tarball entirely, and the `package.json` `web-types` field / `files` entry that reference it were also absent from the published manifest, so PhpStorm/WebStorm consumers got zero `<SortableList>` prop/slot completion. This release republishes with the sidecar present and wired (`web-types` field + `files` entry), matching every other release-verified vue leaf's convention. No `src/` change, no API surface change.

## 0.1.6

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.
