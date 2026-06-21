# Adding a new `@rozie-ui` component family

The recipe for standing up a new family (one `.rozie` source → six published per-framework leaves) on the **compiled `dist` + `./source` standard**. Copy from a proven family and find-replace the name:

- **Engine wrapper** (wraps a vanilla-JS engine, or a script-injected widget): copy **`captcha/`** (script-injected, no npm engine) or **`cropper/`** (npm engine peer).
- **Pure component** (no third-party engine, token-themed): copy **`slider/`** (ships the 4-file `themes/` token system).

`captcha/` is the reference for the current six-toolchain `dist`+`source` standard.

---

## Layout

```
packages/ui/<slug>/
  package.json            # root: build = "node scripts/codegen.mjs"
  tsconfig.json           # noEmit typecheck of the .rozie-adjacent sources
  src/<Name>.rozie        # THE source (author-owned)
  scripts/
    codegen.mjs           # parse-once → compile()×6 → write leaves + render READMEs + validate docs
    readme.mjs            # USAGE / HANDLE_USAGE snippets + README renderer + validateDocsPropsTable
    event-manifest.mjs    # one line per emit
    handle-manifest.mjs   # one line per $expose verb
    compile-<slug>-check.mjs   # surface + collision gate (run FIRST)
  packages/{react,solid,lit,vue,svelte,angular}/   # the six leaves
```

## Step 0 — author + validate the `.rozie` FIRST

Write `src/<Name>.rozie`, then gate it before any leaf work (mirror `captcha/scripts/compile-captcha-check.mjs`): asserts `compile()×6` emits zero errors and the IR surface (props/models/emits/slots/expose) matches expectation — this is where ROZ121 (expose==emit), ROZ524 (model-setter), and Lit-lifecycle collisions surface. Adjust the `EXPECT` block to your surface.

## Step 1 — the six leaves (dist + source standard)

Every leaf: `version "0.1.0"`, `files: ["dist","src"]`, a `"."` export (compiled) **and** a `"./source"` export (raw). Intra-target consistency matters more than cross-target symmetry — each leaf uses its ecosystem's idiomatic build.

| Leaf | Build tool | `"."` → | `"./source"` → | Notes |
| --- | --- | --- | --- | --- |
| react / solid / lit | `tsdown` | `dist/index.{mjs,cjs,d.mts}` | `src/<Name>.{tsx,ts}` | `tsdown.config.ts` externals = framework + `@rozie/runtime-<fw>` (+ engine, + `/\.css$/`+`copy` **only if** the `.rozie` has a `<style>`). |
| vue | Vite lib + `vue-tsc` | `dist/index.mjs` + `dist/index.d.ts` | `src/<Name>.vue` | `vite.config.ts` (plugin-vue + css-injected-by-js); `tsconfig.json` drives `vue-tsc --declaration --emitDeclarationOnly`. |
| svelte | `@sveltejs/package` | `dist/<Name>.svelte` + `.svelte.d.ts` | `src/<Name>.svelte` | `svelte.config.js` (`vitePreprocess()`) **and a local `tsconfig.json`** — see gotchas. |
| angular | `ng-packagr` | `dist/fesm2022/*.mjs` + `dist/index.d.ts` | `src/<Name>.ts` | `ng-package.json` + `tsconfig.lib.json` (`compilationMode: "partial"`); `src/index.ts` = `export * from './<Name>'`. Wire the outer `.` export to the FESM paths after the first build. |

Per-leaf `package.json`: declare `@rozie/runtime-<fw>` as a dep (svelte/react/solid/lit/vue; **angular has none**), the framework (+ engine, if any) as peers, and the build tool(s) as devDeps. Drop the engine entirely for a script-injected family (captcha has no npm engine).

## Step 2 — scripts

Copy `codegen.mjs` + `readme.mjs` + manifests from `captcha/scripts/` (or `cropper/` for an engine-peer family) and retarget:
- **`event-manifest.mjs` / `handle-manifest.mjs`**: one entry per emit / per `$expose` verb. Required — `surface.test.ts` and the README renderer read them.
- **`readme.mjs`** exports **`USAGE`** and **`HANDLE_USAGE`** (per-framework consumption snippets). These are **author-written and family-specific** — do NOT leave the template family's snippets in. `docs/scripts/gen-usage-pages.mjs` auto-discovers every family and **throws if `readme.mjs` doesn't export `USAGE`**, so a stale/missing export breaks the whole docs usage build.
- `codegen.mjs` runs `validateDocsPropsTable(ir, docs/components/<slug>.md)` — it throws on prop name/type/default drift, so the overview doc must exist with a correct `### Props` table (Step 3) before codegen passes.

## Step 3 — docs (`docs/components/`)

> Full docs recipe (the validated Props-table contract, the live-demo wiring, and all four registration points): [`docs/ADDING-COMPONENT-DOCS.md`](../../docs/ADDING-COMPONENT-DOCS.md). Summary:

- **`<slug>.md`** (hand-written): showcase + an IR-exact `### Props` table (validated by codegen — name/type/default must match the IR; string defaults carry quotes, e.g. `"recaptcha"`; required/null props show `—`/`null`).
- **`<slug>-comparison.md`** (hand-written): vs the per-framework libraries it replaces.
- **`<slug>-demo.md`** (hand-written): `<ClientOnly>` live demo importing the `-vue` package.
- **`<slug>-usage.md`**: **auto-generated** from `readme.mjs` `USAGE` — do not hand-write.
- Add a nav block to `docs/.vitepress/config.ts`.

## Per-target gotchas (learned standing up captcha)

- **Svelte needs a *local* `tsconfig.json`.** `svelte2tsx`'s `emitDts` searches upward for `tsconfig.json`/`jsconfig.json`; the repo only carries `tsconfig.base.json`, so without a local one the `.svelte.d.ts` is **silently skipped** (build still exits 0). Add a relaxed `tsconfig.json` (`extends` base, `declaration: true`).
- **Angular outer export.** `ng-packagr` writes its own `dist/package.json`; after the first build, point the leaf's outer `.` export at the generated `dist/fesm2022/<scope>-<name>.mjs` + `dist/index.d.ts`.
- **Cross-phase state in `$onMount` must be top-level.** The Solid emitter splits `$onMount` into `onMount(...)` + a separate `onCleanup(...)`; a `let` declared inside the mount body is **out of scope in the teardown** (TS2304). Declare such state (instance handles, `disposed` flags) as top-level `let`s alongside the engine instance.
- **DOM element typing.** Assign element-specific props to a freshly-`createElement`'d (well-typed) variable, not to a `querySelector` result (typed `Element`) — the latter fails `vue-tsc`/`ngtsc` (TS2339). Keep emitter/codegen casts out of it; fix the `.rozie` source.
- **`tsc --noEmit` is a required gate for tsdown leaves.** Their build (oxc isolated-decl dts) does **not** body-typecheck — a body type error only surfaces under each leaf's `typecheck` script. Always run it.

## Verification gates (this is purely additive — no emitter change)

A new family touches no `packages/core`/`packages/targets` source, so the heavy emitter-change gates (dist-parity rebless, target-snapshot rebless) do **not** apply. Run:

1. `node packages/ui/<slug>/scripts/compile-<slug>-check.mjs` — surface + collision.
2. `pnpm --filter @rozie-ui/<slug> build` — codegen + docs validation.
3. `pnpm --filter @rozie-ui/<slug>-<leaf> typecheck` for react/solid/lit/vue (the real body-level check).
4. `pnpm --filter @rozie-ui/<slug>-<leaf> build` for all six (dist green).
5. `pnpm install` after adding new build-tool devDeps (updates the lockfile).

VR: a family whose widget renders a third-party iframe / canvas / WebGL surface (e.g. captcha) is a **behavioral-only** cell — no deterministic screenshot baseline.

### Tests (proportionate)

- **Surface gate** — promote `scripts/compile-<slug>-check.mjs` into `tests/surface.test.ts` (vitest, node/happy-dom) so `pnpm test` re-asserts the IR surface + `compile()×6` zero-error under `turbo run test`. Cheap; do it for every family.
- **Unit-test branchy engine glue** — if the wrapper has real logic beyond config passthrough (a script-loader singleton, a key/id scheme, a reconcile guard), extract it to `src/internal/<helper>.ts` (codegen vendors `src/internal/` into every leaf via `copyInternal`, excluding `*.test.ts`) and unit-test it with vitest + fake timers. This is the `sortable-list useSortableJS` / `captcha loadCaptchaApi` pattern. **happy-dom gotcha:** it auto-*fetches* any non-empty `<script src>` (async unhandled rejection) and synthesizes an `error` event when file-loading is disabled — so in tests inject a providers/config map with an **empty `src`** (inert) and assert the real URLs separately as pure data.
- Config-passthrough-only wrappers don't need runtime tests beyond the surface gate — typecheck ×4 + build ×6 cover them.
