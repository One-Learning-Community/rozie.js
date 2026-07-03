# Migrate docs to VitePress 2 on Vite 8

**Date:** 2026-07-03
**Status:** Approved (design) — Option B locked in
**Author:** Dan Krieger (with Claude)

## Problem

The `@rozie/docs` VitePress build intermittently OOMs (`JavaScript heap out of
memory`, exit 134). It surfaced most recently as a Lit CI failure: `lit-matrix
(3)` OOMed at ~6037 MB in the "Build all packages" step while every other
framework matrix building the same docs passed — a boundary flake, because the
build sits right on the configured `--max-old-space-size` ceiling.

Root cause (previously diagnosed): the docs site bundles every demo engine
(maplibre-gl, pdfjs-dist, chart.js, rete, codemirror, tiptap, fullcalendar,
cropper, embla) into one Rollup client build **and** live-compiles ~120 example
fences through `@rozie/core`. Rollup must hold the entire module graph — every
AST + source map — in the **V8 heap** to tree-shake and code-split. That graph
is the memory hog. The stopgap in effect on `main` is
`NODE_OPTIONS=--max-old-space-size=8192` on the docs `build` script (raised from
6144 in commit `aaa7aee2`).

`docs` is the **lone Vite-5 holdout** in the monorepo: VitePress 1.6.4 pins
`vite ^5.4.14`, while the rest of the repo already runs Vite 8 (Rolldown-based)
via the root override `"vite@^8": "8.1.0"`.

## Goal

Eliminate the docs-build OOM at its root by moving the docs onto a
Rolldown/Oxc-backed Vite, so engine ASTs are parsed in Rust and never enter the
V8 heap. Remove the `--max-old-space-size` stopgap. Keep the whole monorepo on a
**single Vite major (8)**.

### Non-goals

- No change to docs content, theme design, or the codegen pipeline
  (`rozie-codegen`, `diagnostics-codegen`, `props-codegen`).
- No change to how the repo's non-docs packages build (already Vite 8).
- Not adopting `rolldown-vite@7` (Option A) — see Alternatives.

## Approach (Option B — validated by spike)

Bump docs to **VitePress `2.0.0-alpha.17`** and force its declared `vite ^7.3.1`
dependency onto the repo's existing **`vite@8.1.0`** (already Rolldown by
default) via a root pnpm override. This unifies the repo on one Vite major and
removes the need for any separate `rolldown-vite` package.

### Spike evidence (2026-07-03)

Two full docs builds were measured head-to-head on this machine (128 GB / 18
cores; peak RSS is machine-independent — it tracks module-graph size):

| Metric | Baseline (VitePress 1.6.4 / Vite 5 / Rollup) | **Option B (VitePress 2.0.0-alpha.17 / Vite 8.1.0 / Rolldown)** |
|---|---|---|
| V8 heap OOM | Yes at 6144 (the CI failure) | **No, even at a 4096 cap** |
| Wall time | 159 s | **100 s** |
| Peak RSS (native, incl. Rust) | 8.43 GB | 6.25 GB |
| Pages rendered | — | 173 (clean) |
| Build errors | — | none (only the pre-existing chunk-size warning) |

The 4096 cap is the decisive control: it maps to the 16 GB CI runner's default
V8 old-space sizing. The current Rollup build OOMs at 6144 there; the Rolldown
build stays under 4 GB because the ASTs live in native Rust memory. **The heap
bump can be removed entirely.**

Also verified during the spike:
- VitePress 2 resolves `vite => vite 8.1.0` under the override (single instance,
  deduped with the rest of the repo).
- The Rozie unplugin (`@rozie/unplugin/vite`, `target: 'vue'`) runs correctly
  through Vite 8 — example pages compiled and rendered.
- Engine code-splitting is unchanged (data-table 14 M, rete 11 M, maplibre 4 M
  chunks all present).
- `oxc-minify` peer of VitePress 2 is satisfied; no peer warning surfaced.

## The changes

Five edits, each exercised in the spike:

1. **`docs/package.json`** — `"vitepress": "^1.5.0"` → **`"vitepress":
   "2.0.0-alpha.17"`** (exact pin; it is alpha). Add **`"oxc-minify":
   "^0.138.0"`** to `devDependencies` (VitePress 2 peer — it needs oxc-minify
   directly because `transformWithOxc` does not expose the minify options
   VitePress uses).

2. **Root `package.json` → `pnpm.overrides`** — add **`"vite@^7": "8.1.0"`**
   alongside the existing `"vite@^8": "8.1.0"`. This forces VitePress 2's
   `vite ^7.3.1` request onto the repo's Vite 8.1.0. It matches *only* Vite-7
   requesters (i.e. VitePress 2); nothing else in the repo asks for Vite 7.

3. **`docs/package.json` `build` script** — **remove**
   `NODE_OPTIONS=--max-old-space-size=8192`. Final script:
   `node scripts/gen-usage-pages.mjs && vitepress build . && node scripts/check-anchors.mjs`.

4. **Commit the regenerated `pnpm-lock.yaml`** — CI installs with
   `--frozen-lockfile`, so the lockfile must reflect the new resolution.

5. **Config / theme** — no code changes anticipated. `.vitepress/config.ts` uses
   only stable API (`markdown.{languages,shikiSetup,config}`, `vite.plugins`,
   `themeConfig.search: { provider: 'local' }`, `nav`), and
   `.vitepress/theme/index.ts` is a trivial `DefaultTheme` re-export +
   `custom.css`. The spike rendered all 173 pages cleanly, confirming no config
   breakage. Validation still includes a visual smoke-check of a few pages for
   any default-theme CSS-variable renames in VitePress 2.

## Risks & mitigations

- **Off-label pairing (primary risk).** VitePress 2 alpha is written against the
  Vite 7 API; forcing it onto Vite 8 is not a combination the VitePress team
  ships or tests. It builds clean *today*. Mitigation: `vitepress` is pinned to
  exactly `2.0.0-alpha.17`, so it cannot drift under us. Every future vitepress
  bump is a deliberate PR that rebuilds docs across the full CI matrix — if a
  later alpha touches a Vite-7-only API and breaks against 8, we catch it there
  and can fall back to `rolldown-vite@7.3.1` (Option A) in that same PR.

- **Alpha dependency generally.** Same pin discipline; upgrades are deliberate.

- **Blast radius.** The docs build runs in **all six** framework matrix legs
  plus Deploy Docs and Adoption Smokes. Validation must be the full matrix, not
  just Lit.

- **Rollback.** The entire change is one revert commit (deps + override + build
  script + lockfile). Reverting restores VitePress 1 + the heap bump instantly.

## Alternatives considered

- **Option A — `rolldown-vite@7.3.1`.** VitePress 2 on its declared Vite-7 API
  with the Rolldown backend. Also spiked and works (77 s, clean). It is the
  upstream-tested pairing, but leaves two Vite majors in the tree and adds the
  `rolldown-vite` package (itself experimental, patch versions unsynced).
  Rejected in favor of single-Vite consistency; kept as the documented fallback.

- **VitePress 2 + plain Vite 7 (no Rolldown).** Vite 7 is still Rollup-based —
  does not fix the OOM. Rejected.

- **Stay on VitePress 1, keep the 8192 heap bump.** Punts indefinitely; no
  VitePress 2 RC timeline yet, and the spike shows the alpha already works.
  Rejected.

## Validation / rollout plan

1. Apply the five changes on a PR branch.
2. Local: full `pnpm --filter @rozie/docs build` completes without the heap bump;
   `check-anchors.mjs` passes; visual smoke-check of home + a heavy engine demo
   page (rete/maplibre) + a live-compiled example page.
3. Push the PR and confirm **green across the full CI matrix** — all six
   framework legs, Deploy Docs, Adoption Smokes — not just Lit.
4. Merge to `main` only on a fully green matrix.

## Testing

No new unit tests. This is a build-toolchain change; the test is the build
itself succeeding without the heap bump across CI, plus the anchor-check and
visual smoke pass. The docs `vitest` suite (comparison-page surface hash, etc.)
must remain green.
