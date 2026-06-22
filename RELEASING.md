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

---

## 4. Step-by-step

1. **Bump versions** for everything you're releasing (runtimes first if they changed — §3).
2. **Build** the toolchain + the leaves you're releasing (the precheck `(d)` needs `dist/`):
   ```bash
   pnpm turbo run build --force --filter=@rozie/core --filter=@rozie/cli ...  # mirror release.yml
   ```
3. **Run the LOCAL gate** — the real pre-publish guard (full checks incl. version/dep timing; absent `dist/` = FAIL, so build first):
   ```bash
   pnpm release:precheck --gate
   # or scope it: pnpm release:precheck --gate --filter @rozie/core --filter @rozie-ui/captcha-react ...
   ```
4. **Fix anything it flags.** Re-run until clean.
5. **Commit + push** `main`.
6. **`npm pack` spot-check** the risky leaves: svelte (`*.svelte.d.ts` present?), angular (APF `dist/fesm2022/*.mjs` + `dist/index.d.ts` present?).
7. **Dispatch `release.yml` with `dry_run = true`**, watch it go green. The CI advisory precheck step surfaces any residual structural issue in the log without blocking.
8. **Dispatch with `dry_run = false`**, watch it go green.
9. **Verify on npm via direct registry GET** — `npm view` lags on first-ever names:
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
5. **Do NOT** widen `--filter` lists to families that are not release-verified — see the warning header in `release.yml`. `data-table` and the non-captcha non-vue leaves are deliberately out of scope until verified.

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

---

## 8. Auth / provenance

- **`NPM_TOKEN`** — an npm automation/granular token with publish rights to **both** the `@rozie` and `@rozie-ui` scopes. Stored as a repo secret.
- **Repo must be PUBLIC** — npm provenance requires a public source repo.
- **`--provenance` + OIDC** (`id-token: write`) mints the SLSA provenance attestation at publish time. Without `id-token: write`, `--provenance` fails.
- **Pending:** migration to npm **trusted publishing**, which will retire the long-lived `NPM_TOKEN`.
