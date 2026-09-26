# @rozie-ui/embla-solid

## 0.1.12

### Patch Changes

- 57607be: **Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
  kept only under the `solid` export condition.**

  Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
  `dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
  own, but ships the same corrected export shape for consistency with its siblings). That is not
  valid JavaScript on its own — a default `vite-plugin-solid` setup
  fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
  bundler without a Solid plugin fails outright. The only way to consume these packages was to
  manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
  workaround, not a supported shape.

  New export shape (the standard one for a published Solid library):
  - `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
    `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
  - `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
    and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
    SSR / hydration).

  **If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
  `vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
  default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
  public API change on any of these leaves.

- 57607be: Design-system bridges now yield to a token set on any ancestor, and apply correctly on Lit.

  Each family's `bootstrap`/`material`/`shadcn` theme bridge previously assigned the tokens it
  maps directly on the component's own class. In CSS, a value an element declares for itself
  always beats one it would inherit — so with a bridge imported, a public
  `--rozie-<family>-*` token set on an ancestor (`:root`, `.dark`, a themed wrapper) had no effect;
  only setting it on the component element itself worked. On Lit specifically, where the
  component's class lives inside a shadow root that a document-level bridge selector can never
  match, every bridge was completely inert.

  Every read site that base.css gives a default, or a bridge maps, is now public-token-first, then
  a private wiring name, then the inline default — e.g.
  `var(--rozie-switch-on-bg, var(--rsw-on-bg, #0066cc))` — so a value set on any ancestor always
  wins over a bridge's own mapping, and a public accent set on an ancestor now also recolours the
  bridge-mapped tokens that default to it (ring colour, check colour, etc). Each bridge now
  redeclares only the wiring for the tokens it maps, with the design system's own variable as the
  fallback, resolved on the component itself — so it follows the nearest theme scope rather than
  only ever reading `:root`, and a Lit host in the document's light DOM is matched directly by its
  tag. Zero-import rendering is unchanged in every case: with nothing imported, every chain still
  resolves to the same built-in default it always has.

  **Behaviour changes a consumer can see:** with a bridge imported, a `--rozie-<family>-*` token
  set on any ancestor now wins over the bridge's mapping (previously it only won when set directly
  on the component element). On Lit, the bridges now actually apply (previously inert); a Lit
  component nested inside another shadow root reads the design system's variables at the document
  root.

  **`@rozie-ui/rete`** additionally fixes its dark palette specifically: `FlowCanvas`'s
  OS-dark palette was declared directly on the canvas element (competing with base.css's own
  `.dark`/OS-dark declarations on the same element), so any ancestor override of a
  `--rozie-flow-*` token was dead in OS-dark mode even with nothing else imported. The palette now
  lives at the document root at zero specificity, so an ancestor override reaches it in every mode.

  No component source behaviour changes beyond the CSS cascade described above; this is a pure
  theming/cascade fix in every family listed.
  - @rozie/runtime-solid@0.7.5

## 0.1.11

### Patch Changes

- b084200: Solid: slot scope values are now passed as lazy getters instead of eager reads.

  A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

  Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

  Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

  Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

  `@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
  - @rozie/runtime-solid@0.7.4

## 0.1.10

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.9

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.8

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.7

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.5

### Patch Changes

- `@rozie/runtime-lit` gains a new public export, `RozieSlotDistributor` — a reactive
  controller that performs manual slot assignment for a Lit shadow root, used wherever a
  component needs to route projected children into loop-generated `<slot>` targets
  (e.g. carousel slides). Adopting manual `slotAssignment` turns OFF the browser's
  automatic Text-node projection for that shadow root: raw text children must now be
  assigned to a slot explicitly, and any code reading `assignedNodes()` needs to guard
  for the manual-assignment case. A host that adopts the controller needs its
  `shadowRootOptions` typed as `ShadowRootInit`.

  `@rozie/core` adds two new compile-time diagnostics and one new template sigil:
  - **ROZ148** — flags a prop whose name collides with an emitted callback name, before
    it becomes a runtime shadowing bug on a target that lowers the prop to a method.
  - **ROZ210** — flags a reserved slot name so it can't silently collide with an
    internally-generated one.
  - **`$slotted`** — a new member sigil authors can read inside a loop to get the live,
    reactively-assigned elements projected into that iteration's slot.

  `@rozie/{cli,unplugin,babel-plugin}` bundle `@rozie/core`'s compiler, so this release
  carries the same diagnostics and `$slotted` lowering through to every consumer of
  those packages — the compiler itself moved even though none of these three changed
  their own source. `$slotted` lowers to a reactive assigned-elements signal on the Lit
  target (backed by `RozieSlotDistributor`, gated behind a new `shouldDistributeSlots`
  check so it only emits where a loop actually needs manual slot assignment) and to a
  plain `[]` on the five hostless targets (React, Vue, Svelte, Solid, Angular), where
  there's no shadow root to distribute into.

  `@rozie/runtime-{react,vue,svelte,solid,keynav-core}` are version-aligned to 0.5.0 by
  the changesets `fixed` group riding the `runtime-lit` minor above — this is a
  version-alignment release only; none of these five packages has a source or behavior
  change in this wave.

  `@rozie-ui/date-picker-*` (all six targets) — day and caption labels are now derived
  from `Intl`, with a new `labels` prop for overriding them; range-span selections now
  validate against `disabled` dates; and the calendar header adds drill-in/drill-out
  navigation verbs.

  `@rozie-ui/embla-*` (all six targets) adopts `$slotted` for its carousel slides. On
  the Lit target specifically, this closes a real projection gap: raw `slot="slide"`
  children are now distributed per-iteration instead of only the first iteration
  claiming them.

  `@rozie-ui/{combobox,command-palette,data-table,sortable-list,tags,toast}-lit` are
  regenerated against the new Lit emitter output above — each already used a loop-slot
  pattern that now runs through `RozieSlotDistributor` / `$slotted` instead of the prior
  ad hoc approach, with no observable behavior change for existing consumers of these
  specific leaves.

- Updated dependencies
  - @rozie/runtime-solid@0.5.0

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1` (no emitter-behavior change reaches this leaf's inline body — Solid's slot-ctx params are unconditionally `any`, unaffected by CR-02). The `startIndex` prop's JSDoc now correctly says "Init-only" instead of the stale "Runtime-updatable" (WR-01) — the D1 init-only contract shipped in 0.1.3, but the prop's own doc comment (copied verbatim into IDE hover) was missed. No runtime behavior change; no API surface change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The selected index now survives `reInit`: `startIndex` is stripped from every reInit payload after the raw `options` spread, so a runtime option flip (e.g. toggling `loop`) no longer teleports the carousel back to `startIndex`. **Deliberate behavior change to a published verb:** no-arg `reInitCarousel()` now preserves position instead of resetting to `startIndex` — documented in `embla.md`. Scheduled mount work (two `requestAnimationFrame` handles + a macrotask) is now cancelled on teardown, and both engines are nulled after `destroy()`, so all 14 `$expose` verbs fall through their guards after unmount. A runtime `thumbnails` toggle now actually builds the thumb engine (deferred/idempotent double-schedule).
- The `splitProps` skip-list correctly excludes emit-handler props from the root DOM fallthrough spread now — previously a consumer's handler fired twice per emit.
- Docs truth pass: the runtime-updatable contract (17 of 20 props; `startIndex`/`plugins`/`options` marked construction-only, with reasons), the five previously-missing handle verbs (`scrollProgress`/`slidesInView`/`slidesNotInView`/`previousScrollSnap`/`getPlugins`), a Slots section (`slideSlot`/`thumbSlot` render props), and a filled Events table.
- No API surface change.
- @rozie/runtime-solid@0.2.2

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/embla` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  `embla-carousel ^8.6` and `embla-carousel-autoplay ^8.6` are `peerDependencies` — the consumer installs them; nothing is bundled. There is no engine CSS to import: the carousel skeleton ships scoped and tokenised inside the component.

  The `@rozie/runtime-solid` dependency now resolves to `0.2.2` (array-form `:style` merge).

  Two built-in navigation fixes are now VR-locked in this release: Embla's `slides` option is pinned to `.rozie-embla__slide` (Lit's trailing declarative-mode `<slot/>` used to be counted as a phantom slide, collapsing `scrollSnapList()` to one snap), and `selectThumb` no longer calls the Embla-8-removed `clickAllowed()`.

- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
