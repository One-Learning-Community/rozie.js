<!--
  Thanks for contributing to Rozie.js! Keep PRs focused. Because Rozie compiles
  one source to six framework targets, the reviewer's first questions are always
  "what does this touch?" and "did the cross-target gates stay green?" — please
  answer them below.
-->

## What & why

<!-- What does this change, and why? Link the issue it closes: "Closes #123". -->

## Area

<!-- Tick all that apply. -->

- [ ] Component family (`@rozie-ui/*`) — which: `__________`
- [ ] Compiler core (`@rozie/core`) / IR / a diagnostic
- [ ] A compile-target emitter (`@rozie/target-*`)
- [ ] Build plugin (`@rozie/unplugin`) / Babel plugin / CLI
- [ ] Runtime helpers (`@rozie/runtime-*`)
- [ ] Docs / Playground / IDE tooling
- [ ] Repo tooling / CI / release

## Targets affected

<!-- If this changes emitted output or a component, which targets? -->

- [ ] react  [ ] vue  [ ] svelte  [ ] angular  [ ] solid  [ ] lit
- [ ] N/A — target-independent

## Checks

- [ ] `turbo run build typecheck test` is green locally (mirror CI, not a hand-picked subset).
- [ ] **If I touched an emitter / lowering / core:** re-blessed `dist-parity` and the `target-*` / core snapshot suites (they drift on any emitter change).
- [ ] **If I touched a `@rozie-ui` family:** regenerated the leaves via that family's `codegen.mjs` (leaves are generated — don't hand-edit `packages/*/src`).
- [ ] Tests added/updated for the change (or N/A with a reason).
- [ ] Docs updated if author-facing behavior changed.
- [ ] No `.planning/` artifacts or unrelated files are included in this PR.

## Notes for the reviewer

<!-- Anything tricky: a cross-target asymmetry, a deliberate scope cut, a follow-up you're deferring. -->
