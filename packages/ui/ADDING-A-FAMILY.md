# Adding a new `@rozie-ui` component family

The recipe for standing up a new family (one `.rozie` source → six published per-framework leaves) on the **compiled `dist` + `./source` standard**. Copy from a proven family and find-replace the name:

- **Engine wrapper** (wraps a vanilla-JS engine, or a script-injected widget): copy **`captcha/`** (script-injected, no npm engine) or **`cropper/`** (npm engine peer).
- **Pure component** (no third-party engine, token-themed): copy **`otp/`** (or any of `dialog/`, `combobox/`, `toast/`) — these ship the 4-file `themes/` token system **and** the `compile-<slug>-check.mjs` + `tests/surface.test.ts` gate. Prefer them over `slider/`/`listbox/`, which predate the surface-gate convention and stub out `test`/`typecheck` (grandfathered — do NOT copy their echo-stub scripts into a new family).

`captcha/` is the reference for the current six-toolchain `dist`+`source` standard; `otp/` is the reference for a pure (no-engine) family on that standard.

---

## Layout

```
packages/ui/<slug>/
  package.json            # root: build = "node scripts/codegen.mjs"; test = vitest (surface gate)
  tsconfig.json           # noEmit typecheck of the .rozie-adjacent sources
  vitest.config.ts        # runs tests/surface.test.ts (node/happy-dom)
  src/<Name>.rozie        # THE source (author-owned)
  src/themes/             # PURE components: base/shadcn/material/bootstrap.css token presets
    {base,shadcn,material,bootstrap}.css   # codegen's copyThemes() THROWS if base.css is missing
  scripts/
    codegen.mjs           # parse-once → compile()×6 → write leaves + vendor themes + render READMEs + validate docs
    readme.mjs            # USAGE / HANDLE_USAGE snippets + README renderer + validateDocsPropsTable
    event-manifest.mjs    # one line per emit (empty `{}` for a zero-emit family; gate the README Events section on ir.emits.length)
    handle-manifest.mjs   # one line per $expose verb
    compile-<slug>-check.mjs   # surface + collision gate (run FIRST) — standard for EVERY new family
  tests/
    surface.test.ts       # re-asserts compile()×6 zero-error + the IR surface under `turbo run test`
  packages/{react,solid,lit,vue,svelte,angular}/   # the six leaves
```

> Component name ≠ slug is fine: e.g. component `Toaster` in slug `toast` (mirrors `DataTable` in `data-table`). Keep `FILENAME`/emitted-file/barrel-export/Lit-tag on the **component name**, and pkg names/docs path/`docsPath` on the **slug**.
> New leaves auto-register: `pnpm-workspace.yaml` already globs `packages/ui/*/packages/*`, so a `pnpm install` picks them up — no workspace-config edit needed.

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
- **`<slug>-demo.md`** (hand-written): `<ClientOnly>` live demo importing the `-vue` package. **This requires `@rozie-ui/<slug>-vue` in `docs/package.json` devDeps (`workspace:*`)** — the demo imports the leaf SOURCE (the vue leaf's `.` export resolves to `./src/index.ts`), so VitePress/Vite compiles the `.vue` on the fly; NO leaf dist build is needed for the docs build.
- **`<slug>-usage.md`**: **auto-generated** from `readme.mjs` `USAGE` — do not hand-write.
- Add a nav block to `docs/.vitepress/config.ts`, plus the page to `docs/components/index.md` and `docs/index.md` (the four registration points).

### Prop docs (single source of truth)

Every prop's prose lives in **one** place — the `.rozie` `<props>` `docs.description` — and feeds all three surfaces (JSDoc hover, the per-leaf READMEs, and the docs-site `<slug>-api.md` props table). No surface re-authors prop prose; no surface commits a pre-rendered table. The machinery exists after Phase 59 — follow these three steps, no mechanism needs re-deriving:

1. **Author the prose in the `.rozie` `<props>` `docs.description`.** Put each prop's full description in its single `docs.description` field (the Phase 58 `docs: { description?, deprecated?, example? }` shape — there is **no** new schema field, no `details`/`longDescription`). That one string is the sole origin of the prop's prose across every surface. Preserve any existing `deprecated`/`example` sub-keys untouched.
2. **Wire the shared helper into the family `readme.mjs`.** Delete any local `escapeTableCell`/`renderPropDescription` copy and instead `import { renderPropDescription } from '@rozie/core';`, calling `renderPropDescription(p)` in the `## Props` loop. The reference implementation is `packages/ui/data-table/scripts/readme.mjs` (it imports the helper at the top and keeps `renderPropType`/`renderPropDefault` local). This is what severs README drift from a copy-pasted renderer.
3. **Enable the docs-site generated table.** In `docs/components/<slug>-api.md`, replace the hand-authored `## Props` table with a `rozie-props <Name>` fence (the fence body is ignored and regenerated on every build):

   <pre>
   ## Props

   ```rozie-props DataTable
   ```
   </pre>

   The `propsCodegen` plugin is **already wired** in `docs/.vitepress/config.ts` (registered alongside `rozieCodegen` + `diagnosticsCodegen`) — there is **no per-family plugin config**. `validateDocsPropsTable` already short-circuits to a pass when the `## Props` section is a `rozie-props` fence, so there are **no per-family validator changes** either.

   **Per-family caveat (the ONLY edit needed):** add the family's `<slug>` to the resolver product list in `docs/.vitepress/props-codegen.ts` (the local `resolveExample` array — `'data-table'` was added there as the pilot), so `<Name>` resolves to `packages/ui/<slug>/src/<Name>.rozie`. Do **not** edit `rozie-codegen.ts` — `props-codegen.ts` owns its own list.

The render path is the SAME core `renderPropsTable(ir)` generator (`@rozie/core`) for both the README and the docs-site table, so the two cannot diverge — and nothing pre-rendered is committed for the table.

## Per-target gotchas (learned standing up captcha)

- **Svelte needs a *local* `tsconfig.json`.** `svelte2tsx`'s `emitDts` searches upward for `tsconfig.json`/`jsconfig.json`; the repo only carries `tsconfig.base.json`, so without a local one the `.svelte.d.ts` is **silently skipped** (build still exits 0). Add a relaxed `tsconfig.json` (`extends` base, `declaration: true`).
- **Angular outer export.** `ng-packagr` writes its own `dist/package.json`; after the first build, point the leaf's outer `.` export at the generated `dist/fesm2022/<scope>-<name>.mjs` + `dist/index.d.ts`.
- **Cross-phase state in `$onMount` must be top-level.** The Solid emitter splits `$onMount` into `onMount(...)` + a separate `onCleanup(...)`; a `let` declared inside the mount body is **out of scope in the teardown** (TS2304). Declare such state (instance handles, `disposed` flags) as top-level `let`s alongside the engine instance.
- **DOM element typing.** Assign element-specific props to a freshly-`createElement`'d (well-typed) variable, not to a `querySelector` result (typed `Element`) — the latter fails `vue-tsc`/`ngtsc` (TS2339). Keep emitter/codegen casts out of it; fix the `.rozie` source.
- **`tsc --noEmit` is a required gate for tsdown leaves.** Their build (oxc isolated-decl dts) does **not** body-typecheck — a body type error only surfaces under each leaf's `typecheck` script. Always run it.

### More collision classes + emitter gaps (learned standing up tags / number-field / pagination, 2026-06)

These all passed `compile()×6` clean and only bit at the per-leaf `typecheck`/`ng-packagr` build — gates 3 (typecheck ×4) + 4 (build ×6) are the real catch, the surface gate alone misses them. Worked around in source (no emitter edits; additive scope fence preserved):

- **local-helper-name == author-PROP name, on Lit** — a `const totalPages = …` helper became a Lit class field colliding with the `totalPages` `@property` → `TS2300`/`TS2717`. The *author-prop* sibling of the inherited-DOM-property collision (otp `inputMode`). Rename the helper (`totalPages`→`effectivePages`). (pagination)
- **slot-name == `$expose`-verb, on Lit** — slots `prev`/`next` and expose verbs `prev`/`next` both became Lit class fields → `TS2300`. ROZ127 only guards slot==prop; slot==expose-verb slips past. Rename the slots (`prev`/`next`→`prevControl`/`nextControl`). (pagination) — NEW variant.
- **expose verb `focus` is fine and PREFERRED over a renamed `focusInput`** — the Lit `HTMLElement.focus` override is signature-compatible (warn-only ROZ137, no TS error) and semantically correct; keep `focus`. Do NOT rename it just to silence ROZ137. (tags/number-field — Dan's call)

**Emitter gaps surfaced (BACKLOG — proper fixes are non-additive: ref-type-map / emitter change + dist-parity + target-snapshot rebless + VR). All have a source-only workaround:**
- **`$refs.<input>` types to generic `HTMLElement`** (no `input`→`HTMLInputElement` in the per-target ref-type map; joins the known `ul`/`li`/`dialog` gap) → `.select()`/`.value` are `TS2551`/`TS2339` on Solid/Lit/vue-tsc. Workaround: only touch `HTMLElement` members on the `$refs.<input>` handle; reach input-specific members via `e.target` inside a handler (where it is `any`). (number-field)
- **`<listeners>` inline handler referencing `$event`** → `$event` leaks into the React `useEffect` deps array → `TS2552: Cannot find name '$event'`. The listener dep-scan doesn't exclude the injected `$event` param the way the template `@event` path does. No corpus family hits this (all 71 `<listener>`s use method-ref + modifier, never name `$event`). Workaround: use element pointer-capture (`@pointermove`/`@pointerup` via template `@event`, where `$event` is typed) instead of a document `<listener>`. (number-field)
- **hyphenated slot name** (e.g. `page-item`) → unquoted property key in the Vue/Solid/Lit `defineSlots<{…}>` slot-type literal → hard `TS1005` parse error. Workaround: use single-word slot names (`item`). Proper fix = quote non-identifier slot keys in the vue/solid/lit slot-type emitters. (pagination) — NEW gap.
- **`r-if`/`r-else` with a `<slot>` in the else branch** lowered to an object-literal in JSX-expression position on React. Workaround: two independent `r-if`s instead of `r-if`/`r-else`. (pagination)
- **numeric `:attr` `?? undefined` → `TS2869`** on React (a provably-non-null tabindex like `0`/`-1` trips "right operand of ?? is unreachable"). Workaround: route tabindex through a `number | undefined`-typed helper (the data-table `cellTabindex` precedent). (pagination)

## Verification gates (this is purely additive — no emitter change)

A new family touches no `packages/core`/`packages/targets` source, so the heavy emitter-change gates (dist-parity rebless, target-snapshot rebless) do **not** apply. Run:

1. `node packages/ui/<slug>/scripts/compile-<slug>-check.mjs` — surface + collision.
2. `pnpm --filter @rozie-ui/<slug> build` — codegen + docs validation.
3. `pnpm --filter @rozie-ui/<slug>-<leaf> typecheck` for react/solid/lit/vue (the real body-level check).
4. `pnpm --filter @rozie-ui/<slug>-<leaf> build` for all six (dist green).
5. `pnpm install` after adding new build-tool devDeps (updates the lockfile).

VR: a family whose widget renders a third-party iframe / canvas / WebGL surface (e.g. captcha) is a **behavioral-only** cell — no deterministic screenshot baseline.

**Adding VR cells for a new family (the Angular prebuild lockstep — easy to miss):** a behavioral/screenshot demo in `examples/demos/<Name>{Behavior,Screenshot}Demo.rozie` that composes the family via `<components>` must register the family's `packages/ui/<slug>/src` root in THREE coordinated places, or the **Angular** VR cell builds green but mounts EMPTY at runtime (`imports: [<Name>]` collapses to `any[]`; the Playwright settle then resolves 0 elements). It also leaves stray cross-tree `<Name>.ts` + `.rozie.ts` shims in the family src. Mirror an existing family (otp) across: (1) `tests/visual-regression/vite.config.ts` — a `<slug>Src` const added to BOTH `resolveCrossTreeBareImports([...])` and `prebuildExtraRoots: [...]`; (2) `tests/visual-regression/tsconfig.app.json` — the `../../packages/ui/<slug>/src/**/*.rozie.ts` include; (3) `tests/visual-regression/scripts/build-cells.mjs` — a `<SLUG>_SRC` const + a cleanup-sweep entry. This is the [[project_vr_angular_crosstree_prebuild_move_trap]] generalized to a freshly-added (not moved) family. Generate Linux baselines in the pinned Docker image (`tools/ci-repro/vr.sh -u -b '<Name>Screenshot,…' -g '…'`), then verify byte-identity with a bare (no `-u`) run; never commit macOS PNGs. **The demo cells are themselves `.rozie` — subject to every collision class** (a `set<X>` helper collides with the generated `$data.<x>` setter on React/Solid = ROZ524; name them `apply<X>`).

### Tests (proportionate)

- **Surface gate** — promote `scripts/compile-<slug>-check.mjs` into `tests/surface.test.ts` (vitest, node/happy-dom) so `pnpm test` re-asserts the IR surface + `compile()×6` zero-error under `turbo run test`. Cheap; do it for **every** family — including pure no-engine ones (`otp`/`dialog`/`combobox`/`toast` all carry it; only the older `slider`/`listbox` predate this and stub `test`). **The surface gate is necessary but NOT sufficient**: name collisions with inherited Lit DOM properties (e.g. a helper/prop named `inputMode`/`id`) and with the generated Angular CVA methods (`writeValue`/…) pass `compile()×6` clean and only fail at the per-leaf `typecheck`/`ng-packagr` build — so gates 3 (typecheck ×4) and 4 (build ×6) below are the real collision catch. See the authoring playbook §6 collision catalogue.
- **Unit-test branchy engine glue** — if the wrapper has real logic beyond config passthrough (a script-loader singleton, a key/id scheme, a reconcile guard), extract it to `src/internal/<helper>.ts` (codegen vendors `src/internal/` into every leaf via `copyInternal`, excluding `*.test.ts`) and unit-test it with vitest + fake timers. This is the `sortable-list useSortableJS` / `captcha loadCaptchaApi` pattern. **happy-dom gotcha:** it auto-*fetches* any non-empty `<script src>` (async unhandled rejection) and synthesizes an `error` event when file-loading is disabled — so in tests inject a providers/config map with an **empty `src`** (inert) and assert the real URLs separately as pure data.
- Config-passthrough-only wrappers don't need runtime tests beyond the surface gate — typecheck ×4 + build ×6 cover them.

## When the family is ready to publish

Follow [`../../RELEASING.md`](../../RELEASING.md): widen the `release.yml` `--filter` lists (Build + Publish steps for each new leaf) **and** the advisory precheck step's filter, then run `pnpm release:precheck --gate` locally first as the real pre-publish guard.
