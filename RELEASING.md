# Releasing Rozie.js packages

The contributor playbook for publishing the Rozie.js monorepo to npm. Terse and footgun-forward — read it once, then lean on `pnpm release:precheck` to catch the mechanical misses automatically.

Most of what goes wrong on a release is mechanical: a forgotten version bump (pnpm then silently skips the package), a stale scaffold description, a wrong `repository.directory` after a leaf copy-paste, or a leaf depending on a runtime that isn't on npm yet. All of those are encoded in [`scripts/release-precheck.mjs`](scripts/release-precheck.mjs).

---

## 1. Overview

Two package classes ship from this repo:

- **Toolchain — `@rozie/*`**: `core`, `cli`, `unplugin`, `babel-plugin`, and `runtime-{react,vue,svelte,solid,lit}`. (The `@rozie/target-*` emitters are **private** — they are inlined into `@rozie/core`/`@rozie/cli` at build time and never published.)
- **Components — `@rozie-ui/*` leaves**: dual-package — a compiled `dist` **and** a raw `./source` export. Only the **release-verified** subset is in the workflow today (see §6).

Publishing happens through [`.github/workflows/release.yml`](.github/workflows/release.yml): a manual `workflow_dispatch` with one input, `dry_run` (**defaults to `true`** — packs + validates only). It publishes via `pnpm publish --access public --no-git-checks --provenance` with OIDC (`permissions: id-token: write`). Auth today is the `NPM_TOKEN` automation token (token-bootstrap); migration to npm **trusted publishing** is pending and will retire the long-lived token.

**Two-layer guard model** — get this straight before anything else:

| Layer | What | When | Blocks? |
| --- | --- | --- | --- |
| **(i) LOCAL `pnpm release:precheck --gate`** | The **real** pre-publish guard. Full checks incl. the timing-sensitive version-vs-npm and workspace-dep-on-npm. | Run by the releaser **after building, before dispatching** the workflow. | Yes — exit 1 = do not dispatch. |
| **(ii) CI advisory step** | A visible secondary signal for the **structural** checks only (description / url / files+exports). Audit mode + `--skip-npm`, `continue-on-error: true`. | Inside `release.yml`, after the last leaf build, before the first leaf publish. | **No** — never blocks, never false-fails on registry timing. |

The timing-sensitive checks live in the LOCAL `--gate` and are **deliberately excluded** from CI. Why is in §3 and §7.

---

## 2. Pre-release checklist

Each mechanical item below is automated by `pnpm release:precheck` (run `--gate` locally for the full set):

- **(a) Version bumped past npm** — *[TIMING-SENSITIVE → local `--gate`]*. `pnpm publish` without `--force` **silently skips** an already-published version, so consumers get stale code.
- **(b) Description accurate + non-scaffold** — present, ≥ 20 chars, no `TODO`/`PLACEHOLDER`/`FIXME`/scaffold text. (Heuristic only — see judgment items.)
- **(c) `repository.url` / `homepage` / `bugs.url` + `repository.directory`** — all point at `One-Learning-Community/rozie.js`, and `repository.directory` equals the package's actual path (catches copy-paste leaf scaffold errors).
- **(d) `files` + `exports` artifacts present** — every concrete path in `exports`/`main`/`module`/`types` resolves on disk. **Run a build first** — this check assumes `dist/` exists.
- **(e) Every `@rozie/*` workspace dep already on npm** — *[TIMING-SENSITIVE → local `--gate`]*. A leaf publishing with a `workspace:` dep on a runtime that isn't on npm yet → a dangling published dependency. (Also flags `workspace:` runtime deps on **private** packages — those never publish and must be devDependencies.)

Checks **(a)** and **(e)** only run under local `--gate` (with registry access) and are excluded from the CI advisory step.

**Judgment items the script can't fully check:**

- **Semver level** — additive feature = minor, fix = patch. (Dan has favored staying in `0.1.x` patches for now.)
- **Description accuracy** beyond the length/placeholder heuristic — read it; does it still describe the package?
- **CHANGELOG / changeset entry** if applicable.

---

## 3. Runtime-compatibility ordering

If any `@rozie/runtime-*` changed, **bump + publish the runtimes FIRST.**

The non-vue captcha leaves (`react`/`solid`/`lit`/`svelte`) declare `@rozie/runtime-<fw>` as a `workspace:*` / `workspace:^` dependency. At publish, **pnpm rewrites that to the concrete version** in the tarball — and that version **must already be on npm**, or the published leaf has a dangling dep. (The `angular` leaf has no `@rozie` dep — `tslib` only; the `vue` leaves are self-contained.)

> **The trap:** local version *number* unchanged but content changed → you **must still bump**, otherwise `pnpm publish` silently skips it and consumers get stale runtime code.

**Why this is a LOCAL `--gate` check and not a CI gate:** in a single combined toolchain+leaf release run, the freshly-bumped runtime publishes in **that same run** (the "Publish toolchain" step runs *before* the leaves build/publish), so by the time the leaves publish it *is* on npm. But a CI gate placed among the build/publish steps would check *before* that settles and **false-fail**. There is also no "everything built, nothing published" moment in the workflow — the toolchain publishes early. The LOCAL `--gate`, run *before you dispatch*, catches the genuinely-missing case without the timing race.

**Worked example (2026-08-02, embla + otp debut wave):** the runtime bump does not have to be lockstep across the whole `@rozie/runtime-*` set. This wave bumped only the **content-drifted** subset (`runtime-{react,solid,lit,svelte}` `0.2.1 → 0.2.2`, for a commit that landed after `0.2.1` was cut) and deliberately left `runtime-vue` + `runtime-keynav-core` at `0.2.1` (byte-identical to the published tarball — bumping them would publish a version whose content did not change). Two consequences, both expected and not a problem:

1. `pnpm publish` skips the two unbumped runtimes as already-published — no workflow change needed; the Build/Publish toolchain `--filter` lists already enumerate every runtime, bumped or not.
2. Local `--gate` check (e) (`workspace dep on npm`) false-fails for exactly the leaves carrying a **bumped** runtime dependency — `0.2.2` is not on npm until that same run's "Publish toolchain" step, which runs *before* any leaf publishes but *after* the local `--gate` you ran pre-dispatch. This is the documented timing race above, not a real problem: a leaf whose only `@rozie/runtime-*` dependency is the *unbumped* `runtime-vue` (e.g. `otp-vue`, which depends on `runtime-vue@0.2.1` — already on npm) stays fully clean through `--gate`, which is the concrete signal that the runtime-bump scope was applied correctly.

**Worked example (2026-08-03, toolchain 0.3.0 + otp/embla 0.1.3 + emitter-ripple patch wave) — the mirror image of the case above:** this wave bumps the **toolchain**, not the runtimes. `@rozie/{core,cli,unplugin,babel-plugin}` go `0.2.1 → 0.3.0`; `@rozie/runtime-*` stays put entirely (content-identical to the published tarballs — the last runtime-touching commit predates this whole series). Two consequences:

1. `--gate` false-fails on exactly `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` — each reports `@rozie/core@0.3.0 NOT on npm`, because all four toolchain packages publish inside the same "Publish toolchain" step and pnpm publishes topologically (`core` first, its three dependents after) — the same same-run timing race as §3's runtime case, just one layer up the dependency graph.
2. All 49 bumped leaves stay fully clean through `--gate` check (e) — every leaf's only `@rozie/*` dependency is `@rozie/runtime-<fw>`, and every one of those versions is already live on npm (nothing in this wave touches them). A leaf failing check (e) here would mean the runtime-scope call was wrong; leaves being 100% clean is the concrete signal it was applied correctly — same logic as `otp-vue` in the worked example above, just inverted (there the *leaves* had the timing race and the runtimes anchored the "already live" side; here the *toolchain* has the timing race and the runtimes anchor the "already live" side).

---

## 4. Step-by-step

1. **Bump versions** for everything you're releasing (runtimes first if they changed — §3).
2. **Build** the toolchain + the leaves you're releasing (the precheck `(d)` needs `dist/`):
   ```bash
   pnpm turbo run build --force --filter=@rozie/core --filter=@rozie/cli ...  # mirror release.yml
   ```
3. **Run the UNSCOPED tarball-drift audit FIRST** — catches leaves the wave is
   NOT bumping (check (f), §6 item 10 D1 mechanized). This is deliberately run
   unscoped, in AUDIT mode (not `--gate`), because already-published is the
   expected steady state for every package in a bump set — check (f) is the
   only thing that can fire here:
   ```bash
   pnpm release:precheck --tarball
   ```
   Any unexpected `FAIL` means a leaf you are NOT touching this wave has
   silently gone stale — investigate before continuing (either fold it into
   this wave's bump set with an honest changelog, or file it as its own
   follow-up; do not ignore it).
4. **Run the LOCAL gate** — the real pre-publish guard (full checks incl. version/dep timing; absent `dist/` = FAIL, so build first). `--gate` implies `--tarball` (check (f) is part of the real pre-publish guard):
   ```bash
   pnpm release:precheck --gate
   # or scope it: pnpm release:precheck --gate --filter @rozie/core --filter @rozie-ui/captcha-react ...
   ```
5. **Fix anything it flags.** Re-run until clean.
6. **Commit + push** `main`.
7. **`npm pack` spot-check** the risky leaves: svelte (`*.svelte.d.ts` present?), angular (APF `dist/fesm2022/*.mjs` + `dist/index.d.ts` present?).
8. **Dispatch `release.yml` with `dry_run = true`**, watch it go green. The CI advisory precheck step surfaces any residual structural issue in the log without blocking.
9. **Dispatch with `dry_run = false`**, watch it go green.
10. **Verify on npm via direct registry GET** — `npm view` lags on first-ever names:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/<pkg>/<version>   # 200 = published
   ```

---

## 5. Per-target build idioms

| Leaf | Build tool | `"."` → | Notes |
| --- | --- | --- | --- |
| react / solid / lit | `tsdown` | `dist/index.{mjs,cjs,d.mts}` | dual ESM/CJS; types are `.d.mts`/`.d.cts`, **not** `.d.ts`. |
| vue | Vite lib + `vue-tsc` | `dist/index.mjs` + `dist/index.d.ts` | self-contained (no `@rozie/*` dep). |
| svelte | `@sveltejs/package` | `dist/<Name>.svelte` + `.svelte.d.ts` | needs a **local** `tsconfig.json` or the `.svelte.d.ts` is silently skipped (§7). |
| angular | `ng-packagr` | `dist/fesm2022/*.mjs` + `dist/index.d.ts` | ng-packagr writes its own `dist/package.json`. |

Full family recipe: [`packages/ui/ADDING-A-FAMILY.md`](packages/ui/ADDING-A-FAMILY.md).

---

## 6. Adding a new family to the release

When a family becomes release-verified, widen the workflow — and mirror the same scope into the precheck:

1. Add **Build** + **Publish** steps (or `--filter` entries) for each new leaf in `release.yml`, mirroring the non-vue captcha Build/Publish steps added in commit **71706743** (the first all-targets captcha release line — six leaves aligned).
2. Add the new leaf names to the **CI advisory precheck step's** `--filter` list (the `--skip-npm` step).
3. Add them to your local invocation: `pnpm release:precheck --gate --filter @rozie-ui/<family>-<leaf> ...`.
4. **Build order:** toolchain / runtimes before leaves.
5. **Do NOT** widen `--filter` lists to families that are not release-verified — see the warning header in `release.yml`. In scope today: all six leaves of captcha, sortable-list, flatpickr, pdf, **data-table** (added 2026-07-11 — all six aligned at 0.1.0, `--gate` PASS), **tiptap** (all six aligned at 0.2.0 — added 2026-07-23, the first all-targets tiptap release line; 0.2.0 ships char-count + bubble-menu link editor + themeable styles, all additive/minor; non-vue leaves carry `@rozie/runtime-*` live on npm at 0.2.1, angular = tslib only, self-contained with no `@rozie-ui` peer), **cropper**, and **fullcalendar** (added 2026-08-02 — both aligned at 0.1.2, the FIRST all-targets release line for each family; graduated from vue-only dogfooding after a clean whole-repo build/typecheck/codegen-idempotency/family-test/VR verification sweep found no emitter bugs; `--gate` PASS 12/12; non-vue leaves carry `@rozie/runtime-*` live on npm at 0.2.1, angular = tslib only, self-contained with no `@rozie-ui` peer), **date-picker** + **tags** (added 2026-08-02 — both aligned at 0.1.2, the DEBUT all-targets release line for each family — distinct from the cropper/fullcalendar graduation added the same day, since date-picker and tags had never been published at all; `--gate` PASS 12/12; leaves carry `@rozie/runtime-*` live on npm at 0.2.1, angular = tslib only, self-contained with no `@rozie-ui` peer), and **embla** + **otp** (added 2026-08-02 — both aligned at 0.1.2, the DEBUT all-targets release line for each family — verified 0/6 on npm via a direct registry GET, since `npm view` lags on first-ever names; `--gate` clean apart from the documented same-run dep-timing false-fails — see §3; leaves carry `@rozie/runtime-*` at 0.2.2 (react/solid/lit/svelte) / 0.2.1 (`otp-vue`, unchanged), angular = tslib only, self-contained with no `@rozie-ui` peer; embla additionally takes `embla-carousel` + `embla-carousel-autoplay` `^8.6` as peers, no engine CSS import required), and **rete** (added 2026-08-04 — all six aligned at 0.1.2, the DEBUT all-targets release line — verified 0/6 on npm via a direct registry GET; `--gate` PASS 6/6; leaves carry `@rozie/runtime-*` at 0.2.2 (react/solid/lit `workspace:*`, svelte `workspace:^`) / 0.2.1 (`rete-vue`, `workspace:^`), **angular = `tslib` only**, self-contained with no `@rozie-ui` peer; engine peers `rete` + `rete-area-plugin` + `rete-connection-plugin` + `rete-render-utils` required, `rete-auto-arrange-plugin` + `elkjs` + `web-worker` optional; `rete-vue` ships `web-types.json` and `rete-lit` ships `custom-elements.json`, `rozie-manifest.json` deliberately not shipped. The date-picker-style deep audit was performed: the 4-agent pre-release audit (quick 260803-qwh), the runtime-reactive-props pass (260803-s3m), the VR expansion (260803-uwb), this release prep (260803-vcd), plus the series-end Docker VR union run).
6. **`-vue` leaves that carry `@rozie/runtime-vue` do NOT belong in the shared "Build/Publish Vue leaves" steps.** Those steps are for self-contained vue leaves only (zero `@rozie/*` deps). A runtime-carrying family — data-table, toast, popover, combobox, command-palette, date-picker, tags, otp — gets its own all-six Build + Publish step pair placed after the toolchain build.
7. **The converse of item 6 — a self-contained `-vue` leaf (zero `@rozie/*` deps) belongs in the shared "Build/Publish Vue leaves" steps**, with its five siblings in a `non-vue <family>` block — the flatpickr / sortable-list / cropper / fullcalendar / pdf / captcha / tiptap / embla shape. Only a **runtime-carrying** `-vue` leaf forces the all-six block of item 6. When a wave ships one of each (embla + otp, 2026-08-02), they take **different** shapes — do not unify them for cosmetic symmetry.
8. **2026-08-03 toolchain 0.3.0 + otp/embla 0.1.3 + emitter-ripple patch wave (quick 260803-1dl)** — no new family, no workflow `--filter`-list edit needed; recorded here for the two scope decisions the next releaser should inherit rather than re-litigate:
   - **D1 — runtimes do NOT ride a toolchain minor.** `@rozie/runtime-*` bumps only when their own content changes; a toolchain-only release (even a minor with new diagnostics/primitives) does not force a runtime bump. See §3's mirror-image worked example above for the resulting `--gate` shape.
   - **D2 — leaf patch bumps are per-leaf, not per-family lockstep**, for a ripple patch wave (as opposed to a debut, where item 5's "all six aligned" convention still applies). When an emitter fix ripples across the corpus unevenly (2-4 of 6 leaves in most of the 14 families touched here), bump only the leaves whose emitted content actually moved. An unbumped sibling leaf already enumerated in `release.yml`'s `--filter` lists is simply skipped by `pnpm publish` as already-published — no workflow change needed. `otp` and `embla` still went all-six in this same wave, but because all six genuinely changed, not because of lockstep policy.
9. **2026-08-04 rete debut (quick `260803-vcd`)** — two reusable decisions the next releaser should inherit:
   - **D1 — IDE sidecars are now part of debut prep.** A family's `-vue` leaf ships `web-types.json` and its `-lit` leaf ships `custom-elements.json`, generated by the family codegen from the same IR the READMEs use, and wired into `package.json` (`web-types` / `customElements` field + a `files` entry) by that codegen, idempotently. **A version bump without a codegen regen leaves a stale sidecar** — commit `4a095fdd` is the worked example (a stale tiptap-vue `web-types.json` re-dirtied every whole-repo build until it was regenerated). Bump versions **before** the generating run, and prefer a guard test that pins the sidecar `version` to the leaf `package.json` version (`packages/ui/rete/tests/sidecars.test.ts` is the reference shape).
   - **D2 — `rozie-manifest.json` is NOT part of debut prep.** It is required only for a family that other families compose against (the per-family manifest, Option A). rete is not a composition provider — no other family imports `@rozie-ui/rete-<target>` at authoring time — so it ships without one.
10. **2026-08-04 react-staleness + component-prop-delivery patch wave (quick `260804-hzx`)** — no new family, no `--filter`-list edit needed (all 21 bumped packages were already wired). Two decisions the next releaser should inherit rather than re-litigate:
    - **D1 — the publish-baseline derivation is PER-LEAF against the published tarball, not a single commit-range cut.** Different leaves are last published from different commits — the 2026-08-04 rete debut published from `56340d74` while most leaves were last published from `2094f143`/`dcf9dce8` — so a single `git diff <release-commit>..HEAD` is unsound in **both** directions: it flags clean leaves and misses stale ones. Instead, for each leaf, `npm pack @rozie-ui/<family>-<target>@<current-local-version>` and compare every shipped file (minus `dist/`, a build artifact, and `CHANGELOG.md`) against the worktree, plus a reverse pass for worktree files that WOULD ship per the leaf's `files` field but are absent from the tarball. **Two pack-time normalizations are mandatory or you get ~100% false positives:** (i) pnpm rewrites `workspace:*` to a concrete version for every `@rozie/*` dep — map any `@rozie/`-scoped dep VALUE to a constant on both sides; (ii) pnpm reorders dependency keys at pack time — sort keys before comparing. Run the derivation **after** a cold `turbo run build --force`, never before: codegen regenerates leaf `src/`, and the comparison must read the post-codegen tree. Reference implementation: §1.2 of `.planning/quick/260804-hzx-react-staleness-patch-wave/PLAN.md`. Measured cost: ~5 min for 102 registry packs.
    - **D2 — a "runtime" commit can carry a core edit; derive the toolchain set from paths, never from the commit SUBJECT.** This wave's `15a97bf3` reads `feat(runtime): add normalizeComponentAttrs to runtime-react + runtime-solid`, but it also edited `packages/core/src/rewrite/reservedNames.ts` — which alone forces `@rozie/core` to bump, and with it `cli`/`unplugin`/`babel-plugin`, which pin core at an exact version AND bundle it. Use `git log <cut>..HEAD -- packages/core` and `git log <cut>..HEAD -- packages/targets` (the `@rozie/target-*` emitters are inlined into core's published `dist`, so a targets-only commit still means core changed). Confirm staleness directly rather than inferring it: `npm pack @rozie/cli@<published>` then grep the tarball for the new symbol — zero hits proves the published bundler is stale.
11. **2026-08-04 `@rozie-ui` stale-publish reconciliation wave (quick `260804-lxk`)** — the item-10 D1 derivation is now MECHANIZED as **check (f) — published-tarball drift** in `scripts/release-precheck.mjs`, run with `pnpm release:precheck --tarball` (implied by `--gate`, never run under `--skip-npm`). Same method as item 10 D1 (npm pack the current local version, byte-compare every shipped file minus `dist/`/`CHANGELOG.md`/`package.json`, reverse pass for `files`-matched worktree files absent from the tarball, the two mandatory pnpm-pack normalizations), plus **a third normalization the mechanized port needed that the item-10 shell derivation didn't**: a package with no git-tracked `LICENSE` of its own gets one SYNTHESIZED by `pnpm publish` at pack time (copied from the workspace-root `LICENSE`) — every toolchain/runtime package hits this (none carries its own `LICENSE`), and without excluding it check (f) false-flagged all ten as `GONE:LICENSE`. A package that DOES carry its own git-tracked `LICENSE` (e.g. `captcha-angular`, `flatpickr-vue`) is still compared normally — that is exactly how the stale-copyright-holder class in those leaves is caught. The `files`-field matcher is negation-aware (`!src/**/__tests__/**` etc. — required for a leaf whose `files` field excludes test files, e.g. the runtimes). Self-validated unscoped against the live registry at plan time: reproduced the item-10 20-leaf finding EXACTLY (19 FAIL + `popover-lit` allowlisted WARN), with all six runtimes and all four toolchain packages clean. Run it as the FIRST step of §4 (unscoped, before bumping) — that is the only invocation that can see a leaf the current wave is NOT touching drift silently.
12. **2026-08-09 toolchain 0.5.1 + tiptap 0.3.0 minor + 2 react stale-publish patches (quick `260809-s5k`)** — no new family, no `--filter`-list edit needed (all 18 bumped packages were already wired). Two reusable decisions the next releaser should inherit rather than re-litigate:
    - **D1 — a new `$expose` imperative-handle verb on a leaf is a MINOR, not a patch**, even when its own prose calls it "fully additive". Precedent: `@rozie-ui/combobox`'s `seedQuery(text)` shipped under `0.2.0` `### Minor Changes` despite its own changelog calling it "fully additive and render-neutral", and tiptap's own `openLinkEditor()` shipped the same way under `0.2.0`. This wave's `setLink`/`unsetLink` followed the same call. Practical consequence: a family whose leaves have drifted apart on patch numbers (tiptap was 0.2.0/0.2.0/0.2.0/0.2.1/0.2.1/0.2.2) realigns on the next minor — expect that as a side effect, don't engineer toward it.
    - **D2 — a stale-publish reconciliation can ride a feature wave for the SAME leaf, but must keep its own changeset file.** `tiptap-react` was in both buckets this wave: one `minor` changeset (the link-editor feature) and one separate `patch` changeset (the `1b0e5254` value-position reconciliation) produced ONE version (`0.3.0`, max wins) and TWO CHANGELOG bullets under that single heading. A shared-body changeset cannot do this — changesets writes one body per file to every package it names, so splitting into two files naming the same package is the only way to keep the two stories distinct. The other two stale leaves in this wave (`data-table-react`, `fullcalendar-react`) stayed patch-only, because their `1b0e5254` hunks were stale-closure fixes with no surface change (precedent: `tiptap-react@0.2.2`'s own patch and the whole `260804-hzx` wave).
13. **2026-08-10 codemirror debut (quick `260810-d7s`)** — aligned all six `@rozie-ui/codemirror-{react,vue,svelte,solid,lit,angular}` leaves at **0.1.3** (a debut PATCH — the deep audit below found no public-surface change, so it did NOT force a minor). Verified 0/6 on npm via a direct registry GET, since `npm view` lags on first-ever names.
    - **`codemirror-vue` is self-contained (zero `@rozie/*` deps)**, so it rides the shared "Build/Publish Vue leaves" steps (the flatpickr/sortable-list/cropper/fullcalendar/pdf/captcha/tiptap/embla shape — §6 item 7), while the other five get their own non-vue Build/Publish step pair — the CONVERSE of rete/otp/tags/date-picker, whose `-vue` leaf carries `@rozie/runtime-vue` and therefore forces the all-six block (§6 item 6).
    - **A date-picker-style deep audit was performed before this debut** (the STANDING pre-release-audit rule): `.planning/quick/260810-d7s-shore-up-rozie-ui-codemirror-for-first-n/AUDIT.md` traced all 10 props / 12 `$expose` verbs / 5 portal slots against all five docs pages and the VR spec, classifying every finding as SOURCE-BUG / DOCS-DRIFT / COVERAGE-GAP / RELEASE-PREP-GAP / EMITTER-BACKLOG. Findings: two DOCS-DRIFT (a Solid slot-prop name and a stale handle-manifest header comment, both fixed), five COVERAGE-GAP (theme/readOnly/basicSetup compartment reconfigures plus the gutter/decoration reactive multi-instance slots had zero VR coverage — closed by extending `tests/visual-regression/specs/code-mirror.spec.ts` and, necessarily, `examples/demos/CodeMirrorDemo.rozie`), and several RELEASE-PREP-GAP (no family test suite, no IDE sidecars, ragged versions, two missing CHANGELOGs, no `release.yml` wiring — all closed in this same wave). Zero SOURCE-BUG, zero EMITTER-BACKLOG findings.
    - **IDE sidecars (D-05, §6 item 9 pattern applied):** `codemirror-vue` ships a JetBrains `web-types.json` and `codemirror-lit` ships a Custom Elements Manifest (`custom-elements.json`), both generated by `packages/ui/codemirror/scripts/{web-types,cem}.mjs` (ported verbatim from `packages/ui/rete/scripts/`) from the same lowered IR the READMEs use, and guarded by a new `tests/sidecars.test.ts` that pins each sidecar's `version` field to the sibling leaf `package.json` version (the `4a095fdd` stale-sidecar lesson).
    - **`rozie-manifest.json` is deliberately NOT shipped** (§6 item 9 D2 pattern): no other family imports `@rozie-ui/codemirror-<target>` at authoring time, so codemirror is not a composition provider.
    - **A real family test suite now exists** (D-04): `packages/ui/codemirror/tests/{surface,sidecars}.test.ts` (33 assertions) replaced the previously test-less `vitest run --passWithNoTests`, which had been silently passing with zero assertions.
    - **Engine peers:** 6 REQUIRED (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/theme-one-dark`, the `codemirror` meta-package, `@codemirror/lang-javascript`) plus 10 OPTIONAL `@codemirror/lang-*` presets (`peerDependenciesMeta` `optional: true`), consistent across all six leaves — verified, not re-derived (already correct from an earlier commit, `085594b1`).
    - **KNOWN DEBT surfaced but NOT folded into this wave** (§4 step 3's unscoped `pnpm release:precheck --tarball`, run before any version was touched): `@rozie-ui/combobox-{react,vue,svelte,solid,lit,angular}` (all six — stale-published `src/` drift) and `@rozie-ui/tiptap-vue` (stale-published `web-types.json` — a NEW instance of the `4a095fdd` sidecar-staleness class) are drifted on npm. Neither family was touched by this wave; both are candidates for a future stale-publish reconciliation wave (§6 items 10/11 precedent). `@rozie-ui/popover-lit`'s pre-existing ALLOWLISTED WARN (§7) reproduced cleanly, unchanged.

---

## 7. Gotcha catalog

- **`pnpm publish` skips already-published versions without `--force`** → forgot-to-bump is a silent no-op. (This is why `--gate` treats already-published as a hard FAIL.)
- **`npm view` lags on first-ever package names** → always verify with a direct registry GET `https://registry.npmjs.org/<pkg>/<version>` (200 = published, 404 = not).
- **Svelte needs a LOCAL `tsconfig.json`** or `svelte2tsx`'s `emitDts` silently skips the `.svelte.d.ts` (build still exits 0).
- **Angular `ng-packagr` writes its own `dist/package.json`** — after the first build, point the leaf's outer `.` export at the generated `dist/fesm2022/<scope>-<name>.mjs` + `dist/index.d.ts`.
- **Never build the toolchain by the `@rozie/*` glob** — it drags in `@rozie/docs` → VitePress OOM. `release.yml` lists the 9 packages **explicitly** via `--filter`. Always build by explicit `--filter`.
- **Private `@rozie/*` deps are dangling-dep traps** — a `workspace:` runtime dependency on a private package (e.g. an `@rozie/target-*`) publishes as a concrete version that 404s on npm; it must be a devDependency (bundled at build time). The precheck flags this.
- **`tsdown` dual packages emit `.d.mts`/`.d.cts`, not `.d.ts`** — a `types: "./dist/index.d.ts"` after a copy-paste will reference a nonexistent file. The precheck `(d)` check catches it.
- **The CI precheck is ADVISORY by design** — a green CI run does **not** mean the version/dep timing checks passed. Those only run in your LOCAL `--gate`.
- **"Pre-existing failure" baselines must be captured against the last GREEN PUSHED commit, not the current tree.** The 2026-08-03 wave captured its Task-0 baseline *after* the commit that broke the docs build, so a series-introduced regression was recorded as pre-existing and shipped. Identify the last green pushed commit (CI run history, not local state) and diff against that.
- **20 `@rozie-ui` non-react leaves were found STALE on npm 2026-08-04** — their published tarball did not match committed source at the same version number. Found by the per-leaf tarball derivation (§6 item 10 D1), which is the only method that can see this class; the single-cut range diff structurally cannot. By target: angular 6, vue 7, svelte 4, lit 1, plus 2 vue IDE-sidecar cases. Several were consumer-visible, not cosmetic — `toast-vue` was missing the stacked-offset feature entirely, `command-palette-{angular,svelte,vue}` were missing the whole `src/internal/parseKeyToken.ts` module, `data-table-angular` drifted on 11 files, and 4 leaves shipped a stale `LICENSE` copyright holder. **Root cause of the class:** `pnpm publish` silently skips an already-published version, so any commit that regenerates a leaf without a version bump leaves the registry serving old bytes forever. 19 of the 20 were reconciled in the `260804-lxk` follow-up wave (§6 item 11); `popover-lit` was deliberately excluded and stays allowlisted (next bullet). Backlog for the narrowed remainder: `.planning/todos/pending/rozie-ui-stale-publish-reconciliation.md`.
- **`@rozie-ui/popover-lit@0.1.2` is allowlisted in check (f), not reconciled.** Its drift (`unknown`→`any` on the `anchor` render-prop slot-scope public type) is a real API-surface change, not a mechanical patch ripple — bumping it under a "reconciliation" changelog would ship a type loosening without a deliberate decision. `pnpm release:precheck --tarball` reports it as an ALLOWLISTED `WARN` (never `FAIL`) carrying the reason + the backlog pointer, keyed `name@version` so a future bump to `0.1.3` automatically re-arms the check (D-07). If you see this WARN, it is NOT noise — read the backlog item before dismissing it. Do not add a second allowlist entry to "fix" the warning; either resolve the underlying API decision and bump the leaf, or leave it be.

---

## 8. Auth / provenance

- **`NPM_TOKEN`** — an npm automation/granular token with publish rights to **both** the `@rozie` and `@rozie-ui` scopes. Stored as a repo secret.
- **Repo must be PUBLIC** — npm provenance requires a public source repo.
- **`--provenance` + OIDC** (`id-token: write`) mints the SLSA provenance attestation at publish time. Without `id-token: write`, `--provenance` fails.
- **Pending:** migration to npm **trusted publishing**, which will retire the long-lived `NPM_TOKEN`.
