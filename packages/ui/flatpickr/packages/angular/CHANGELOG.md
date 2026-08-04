# @rozie-ui/flatpickr-angular

## 0.1.2

### Patch Changes

- Stale-publish reconciliation. The published `0.1.1` tarball predates several regenerations that landed on `main` without a version bump, so the registry kept serving stale bytes; the package had never even shipped a `CHANGELOG.md` before this release. This release republishes the current generated output:
  - Adds the `:host(rozie-flatpickr) { display: contents; }` component style, so the host element no longer imposes its own box in the layout (consumers previously got an extra unstyled wrapping element).
  - Adds JSDoc across the component's props (0 blocks in the published tarball), so IDE tooltips/completion now describe each prop's semantics, runtime-vs-construction-time mutability, and defaults.
  - `LICENSE` copyright holder corrected from `Dan Krieger and Rozie.js contributors` to `One Learning Community LTD` (the repo's current holder — the worktree file was already correct; only the stale published tarball needed reconciling).
  - No prop/event/emit surface change.
