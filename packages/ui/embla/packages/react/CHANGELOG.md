# @rozie-ui/embla-react

## 0.1.6

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
  - @rozie/runtime-react@0.5.0

## 0.1.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Two read kinds landed here:
  - **`$emit` handler props** (4) — `onPointerDown`, `onReInit`, `onSelect`, `onSettle`. Embla's callbacks are registered once against the engine at mount, so before this fix a consumer that swapped any of these handlers after mount kept getting the original one called. They now dispatch to the current handler.
  - **Helper calls** (4) — `emblaPluginsFromProps`, `initialOptions`, `reinitOptions`, `thumbsOptionsFromProps`, so a re-init picks up current options and plugins.

- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts`'s `renderSlide`/`renderThumb` params are unaffected (`slide`/`index` are `r-for` loop vars, correctly still `unknown`) — no CR-02-attributable change to this leaf's slot-callable types. The `startIndex` prop's JSDoc now correctly says "Init-only" instead of the stale "Runtime-updatable" (WR-01) — the D1 init-only contract shipped in 0.1.3, but the prop's own doc comment (copied verbatim into the `.d.ts` and IDE hover) was missed. No runtime behavior change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The selected index now survives `reInit`: `startIndex` is stripped from every reInit payload after the raw `options` spread, so a runtime option flip (e.g. toggling `loop`) no longer teleports the carousel back to `startIndex`. **Deliberate behavior change to a published verb:** no-arg `reInitCarousel()` now preserves position instead of resetting to `startIndex` — documented in `embla.md`. Scheduled mount work (two `requestAnimationFrame` handles + a macrotask) is now cancelled on teardown, and both engines are nulled after `destroy()`, so all 14 `$expose` verbs fall through their guards after unmount. A runtime `thumbnails` toggle now actually builds the thumb engine (deferred/idempotent double-schedule).
- The `useEffect` dependency for the derived-getter `$watch` on `.length` now deps on the tracked read path (the derived length) rather than the base `slides` array identity — it previously deps'd on `[props.slides]`, which could miss a length change that didn't also change array identity.
- Declared emit handlers no longer also land in the root DOM fallthrough spread — previously a consumer's handler fired twice per emit.
- The public `.d.ts` no longer types unresolved `r-for` slot-context params (`slide`/`index` on the `slide`/`thumb` render props) as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller.
- Docs truth pass: the runtime-updatable contract (17 of 20 props; `startIndex`/`plugins`/`options` marked construction-only, with reasons), the five previously-missing handle verbs (`scrollProgress`/`slidesInView`/`slidesNotInView`/`previousScrollSnap`/`getPlugins`), a Slots section (`renderSlide`/`renderThumb` render props), and a filled Events table.
- No API surface change.
- @rozie/runtime-react@0.2.2

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/embla` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  `embla-carousel ^8.6` and `embla-carousel-autoplay ^8.6` are `peerDependencies` — the consumer installs them; nothing is bundled. There is no engine CSS to import: the carousel skeleton ships scoped and tokenised inside the component.

  The `@rozie/runtime-react` dependency now resolves to `0.2.2` (array-form `:style` merge).

  Two built-in navigation fixes are now VR-locked in this release: Embla's `slides` option is pinned to `.rozie-embla__slide` (Lit's trailing declarative-mode `<slot/>` used to be counted as a phantom slide, collapsing `scrollSnapList()` to one snap), and `selectThumb` no longer calls the Embla-8-removed `clickAllowed()`.

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
