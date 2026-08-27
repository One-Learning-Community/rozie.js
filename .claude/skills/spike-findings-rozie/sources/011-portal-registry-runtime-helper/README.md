---
spike: 011
name: portal-registry-runtime-helper
type: standard
validates: "Given the inlined portal bookkeeping (live-handle Set + add/delete + bulk-dispose) repeated across targets, when it is factored into a per-runtime-package createPortalRegistry helper on the Lit target, then emitted output shrinks and behavior is preserved with bounded, expected-only snapshot churn"
verdict: VALIDATED
related: [003, 004, 033]
tags: [portal, emitter, runtime-helper, lit, dedupe, maintenance]
---

# Spike 011: Portal-registry runtime helper (Lit)

## What This Validates

The portal emitters repeat the same lifecycle scaffold across all six targets:
a live-handle `Set`, `.add()`/`.delete()` per portal, a bulk-dispose teardown,
and a copy-pasted `interface ReactivePortalHandle`. Question: can that
**bookkeeping** move into a runtime helper without disturbing the irreducible
per-framework render call — and what does it cost in snapshot/dist-parity/VR
churn? Lit-only, throwaway.

## Approach

Factor the bookkeeping into `@rozie/runtime-lit`'s `createPortalRegistry()`:

```ts
export function createPortalRegistry(): PortalRegistry {
  const live = new Set<() => void>();
  return {
    mount(setup) {                 // setup() does the render, returns teardown
      const teardown = setup();
      const dispose = () => { teardown(); live.delete(dispose); };
      live.add(dispose);
      return dispose;
    },
    disposeAll() {                 // disconnectedCallback
      for (const dispose of [...live]) dispose();
      live.clear();
    },
  };
}
```

The Lit-specific `render(tpl(scope), container)` / `render(nothing, container)`
stays inline in the emitted closure — only the Set + teardown move.

Five edits: new `createPortalRegistry.ts`; export from runtime index;
`createPortalRegistry` + type-only `ReactivePortalHandle` added to the
`RuntimeLitImport` union/collector; `emitScript` registers the import when
`hasPortals`; `emitPortals.ts` emits against the registry and drops the inlined
interface.

## Results — VALIDATED

**Emitted-output diff (PortalListStyled, single non-reactive portal): −3 LOC.**
See `BEFORE.*` / `AFTER.*`. The seam:

```diff
-import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
+import { createPortalRegistry, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
...
-private _portalContainers = new Set<HTMLElement>();
+private _portals = createPortalRegistry();
...
-        render(tpl(scope), container);
-        this._portalContainers.add(container);
-        return () => {
-          render(nothing, container);
-          this._portalContainers.delete(container);
-        };
+        return this._portals.mount(() => {
+          render(tpl(scope), container);
+          return () => render(nothing, container);
+        });
...
-      for (const container of this._portalContainers) render(nothing, container);
-      this._portalContainers.clear();
+      this._portals.disposeAll();
```

**Churn surface (Lit target):**
- **2 unit assertions** failed of 333 (`emitPortals.test.ts`): one pinned the
  old closure body, one pinned the inlined `interface ReactivePortalHandle`.
  Both are *expected* shape-pins that a deliberate emit change must update
  red-first. The other **331 passed** — collision-gating, scopeHash injection,
  multi-slot, member-name disambiguation all preserved.
- **2 committed dist-parity goldens** would re-bless: `PortalListStyled.lit.ts`,
  `PortalListStyledScss.lit.ts`.
- **Typecheck green** for `@rozie/runtime-lit` + `@rozie/target-lit`; the
  emitted `mount(...)` / `ReactivePortalHandle` usage matches the helper types.
- **VR churn = 0 expected (unconfirmed in spike).** `mount()` runs `setup()`
  synchronously → render at the same instant; `disposeAll()` runs each teardown
  → `render(nothing)`. Observable DOM is identical, so `PortalList.png` /
  `PortalListStyled.png` should stay byte-identical. Needs a pinned-Linux
  Playwright run to confirm before any rollout (macOS baselines are invalid).

## Investigation Trail

1. Mapped the seam: bookkeeping (Set/add/delete/bulk-dispose/interface) vs the
   irreducible per-framework render call. Only the former is dedupe-able.
2. Implemented on Lit, emitted PortalListStyled before/after → clean −3 LOC.
3. Ran full Lit suite → exactly the 2 predicted shape-pins broke; nothing else.
4. Typechecked runtime + target → green. Reverted all source (throwaway);
   kept artifacts.

## Signal for the Build

- **Worth doing, scoped to bookkeeping only.** Win is maintenance/clarity
  (one place to fix a teardown leak across six targets), not LOC (~3/comp).
- **Per-target helpers, not one shared method** — the mount/unmount primitive
  differs in kind per framework (createRoot/flushSync, h+render, mount/unmount,
  ViewContainerRef, solid render, lit render+nothing). Each runtime pkg gets its
  own `createPortalRegistry`; `ReactivePortalHandle` can be one shared type.
- **Cost:** adds a runtime import to portal components on the 5 targets that
  currently inline with zero portal-runtime dep. Acceptable (every target
  already imports other runtime helpers), but it IS a deliberate trade.
- **Rollout = a real red-first, byte-identity change** across 6 targets:
  update shape-pin assertions red-first, re-bless dist-parity goldens, confirm
  VR stays green on Linux. Not a silent sweep. ~2 unit + 2 golden churn per
  target as the Lit baseline.

## How to Run (re-spike)

Re-apply the 5 edits, then:
`pnpm --filter @rozie/target-lit exec vitest run` (expect 2 known shape-pin
fails), and a capture harness emitting `examples/PortalListStyled.rozie` via
`emitLit` to regenerate `AFTER.*`.
