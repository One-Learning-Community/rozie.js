# Design — Tokenize `@rozie-ui/rete` (FlowCanvas) for headless UI

**Date:** 2026-07-02
**Component:** `@rozie-ui/rete` — `FlowCanvas.rozie` (+ `NodeType`, `Port`)
**Pattern source:** the just-shipped `@rozie-ui/embla` token surface (`--rozie-embla-*` + `src/themes/{base,shadcn,material,bootstrap}.css`).
**Execution route:** additive family round-out → `/gsd-quick` (per `feedback_gsd_quick_for_family_roundout`).

## Goal

Every visual value the Flow/rete component renders is currently a hardcoded literal in
`FlowCanvas.rozie`'s two style surfaces. That makes the component un-re-skinnable — there
is no way to bridge it to a design system. This work makes it **headless**: every rendered
value becomes a `--rozie-flow-*` CSS custom property with an inline `var(token, fallback)`
default, so the default look ships with zero config yet re-skins to any design system, with
ready-made shadcn / Material / Bootstrap bridges — exactly the story `@rozie-ui/embla` ships.

**Non-goal:** changing behavior, the prop/event/handle surface, or the default *light*
appearance. Fallbacks equal today's exact values, so the light render is byte-identical.

## The three style surfaces to tokenize

1. **Component-template chrome** — `.rozie-flow-canvas`, `.rozie-flow-controls`,
   `.rozie-flow-marquee`, `.rozie-flow-minimap`, `.rozie-flow-toolbar`. Plain scoped CSS
   (carries `[data-rozie-s-*]`). Straight `var()` substitution.
2. **Engine-DOM chrome** — `.rozie-flow-node`, `.rozie-flow-port`, `.rozie-flow-socket`,
   `.rozie-flow-connection*`. Engine-created DOM carries no scope attr, so it lives under the
   existing `:root { }` escape hatch (ROZ128 — must stay `:root`, never `:global()`). Same
   `var()` substitution.
3. **Imperative SVG colors set in `<script>` via `.setAttribute`** — 5 sites that cannot take
   a raw `var()`:
   - connection arrowhead `fill` (`#64748b`, line ~1569)
   - minimap node fill (selected `#3b82f6` / unselected `#94a3b8`, line ~2161)
   - minimap mask fill (`rgba(15,23,42,0.18)`, line ~2172)
   - minimap viewport stroke (`#3b82f6`, line ~2180)

   These read tokens through one small helper added near the top of `<script>`:

   ```js
   // Resolve a --rozie-flow-* token off the live canvas element for imperative SVG
   // attributes (which can't take a raw var()); falls back to the literal default so the
   // zero-import default + dark mode both track. $refs.canvasEl is read inside draw-time
   // code (post-mount), never at top level (ROZ123).
   const flowToken = (name, fallback) => {
     try {
       const el = $refs.canvasEl
       if (!el) return fallback
       const v = getComputedStyle(el).getPropertyValue(name)
       return (v && v.trim()) || fallback
     } catch (e) { return fallback }
   }
   ```

   Call sites pass the same literal as `fallback`, so a consumer who imports no theme and
   sits in light mode gets byte-identical output.

## Token surface (`--rozie-flow-*`)

One shared accent drives every "selected / active" affordance so a single override shifts them
all — the embla `--rozie-embla-accent` pattern:

```
--rozie-flow-accent            /* #3b82f6 — node-selected border+ring, socket hover,
                                  selected-edge stroke, active control, marquee border,
                                  minimap selected-node + viewport window */
```

Grouped tokens (fallback = **exact current value**; executor reads the file for literals):

| Group | Tokens (fallback) |
| --- | --- |
| **Canvas** | `-bg` (#f7f8fa), `-grid-dot-color` (rgba(0,0,0,.08)), `-grid-size` (20px), `-border-color` (rgba(0,0,0,.1)), `-radius` (8px) |
| **Node** | `-node-bg` (#fff), `-node-border` (rgba(0,0,0,.16)), `-node-radius` (8px), `-node-shadow` (0 2px 6px rgba(0,0,0,.12)), `-node-title-fg` (#1f2937), `-node-selected-ring` (rgba(59,130,246,.5)) |
| **Port** | `-port-fg` (#6b7280) |
| **Socket** | `-socket-size` (12px), `-socket-bg` (#94a3b8), `-socket-border-width` (2px), `-socket-border-color` (#fff), `-socket-ring` (rgba(0,0,0,.2)) |
| **Connection** | `-connection-stroke` (#64748b), `-connection-width` (3px), `-connection-selected-width` (4px), `-connection-label-fg` (#334155), `-connection-label-halo` (#fff) |
| **Controls** | `-control-bg` (#fff), `-control-fg` (#334155), `-control-border` (rgba(0,0,0,.16)), `-control-radius` (6px), `-control-shadow` (0 1px 3px rgba(0,0,0,.14)), `-control-hover-bg` (#f1f5f9), `-control-active-bg` (#e2e8f0), `-control-selected-bg` (#dbeafe), `-control-selected-fg` (#1d4ed8) |
| **Marquee** | `-marquee-bg` (rgba(59,130,246,.12)), `-marquee-border` (→ accent) |
| **Minimap** | `-minimap-bg` (rgba(255,255,255,.82)), `-minimap-border` (rgba(0,0,0,.16)), `-minimap-shadow` (0 1px 3px rgba(0,0,0,.14)), `-minimap-node-fill` (#94a3b8), `-minimap-mask` (rgba(15,23,42,.18)) |
| **Toolbar** | `-toolbar-bg` (#fff), `-toolbar-border` (rgba(0,0,0,.16)), `-toolbar-shadow` (0 2px 8px rgba(0,0,0,.18)), `-toolbar-btn-bg` (#f8fafc), `-toolbar-btn-fg` (#334155), `-toolbar-btn-border` (rgba(0,0,0,.14)), `-toolbar-btn-hover-bg` (#eef2f7), `-toolbar-delete-fg` (#b91c1c) |

The **selected/active tokens are not listed separately** because their fallback *is* accent —
they exist as the nested-`var()` override seam and default through `--rozie-flow-accent`:
`-node-selected-border`, `-socket-hover-bg`, `-connection-selected-stroke`,
`-control-selected-border`, `-marquee-border`, `-minimap-selected-fill`,
`-minimap-viewport-stroke`. Example:
`border-color: var(--rozie-flow-node-selected-border, var(--rozie-flow-accent, #3b82f6));`
and the socket hover `background: var(--rozie-flow-socket-hover-bg, var(--rozie-flow-accent, #3b82f6));`
so overriding just `--rozie-flow-accent` recolors every selection cue at once.

## Dark-mode-aware defaults

The component ships an adaptive default (works with **zero import**). Dark token overrides
are gated so light rendering is untouched:

- Inside the component's scoped `<style>` (and mirrored in the `:root {}` escape-hatch block
  for engine DOM), add a dark override of the **color** tokens under **both**
  `@media (prefers-color-scheme: dark)` and a `.dark` / `[data-theme="dark"]` ancestor.
- Sizing tokens (sizes, radii, widths, grid-size) are not redefined in dark.
- Suggested dark palette (executor may refine): canvas-bg `#0f172a`, grid-dot
  `rgba(255,255,255,.06)`, node-bg `#1e293b`, node-border `rgba(255,255,255,.12)`,
  node-title-fg `#e2e8f0`, port-fg `#94a3b8`, socket-bg `#64748b`, socket-border-color
  `#1e293b`, connection-stroke `#64748b`, control/toolbar bg `#1e293b` fg `#cbd5e1`,
  minimap-bg `rgba(15,23,42,.82)`, accent `#60a5fa`.

### Rebless impact

The VR harness (`tests/visual-regression/playwright.config.ts`) sets **no** `colorScheme`, so
Chromium renders **light**; the screenshot demo applies no `.dark` class. Therefore neither
dark gate matches during the existing VR run → **`FlowCanvasScreenshot.png` stays
byte-identical, no rebless.** A **net-new** dark VR cell (a screenshot demo variant under
`colorScheme: 'dark'` or a `.dark` wrapper) is added to lock the dark path; its baseline is
Linux-rendered per `feedback_vr_linux_baselines`.

## Theme bridges + distribution

- New `packages/ui/rete/src/themes/`:
  - `base.css` — the full explicit `--rozie-flow-*` reference (light) + the dark override block
    (documenting both, import-optional).
  - `shadcn.css` — maps color/shadow tokens onto shadcn's `--primary/--background/--foreground/
    --muted/--border` (reads them live → auto-follows the app's light/dark + accent).
  - `material.css` — maps onto Material 3 `--md-sys-color-*`.
  - `bootstrap.css` — maps onto Bootstrap 5 `--bs-*`.
  - Sizing tokens left unset in the three bridges so the base sizes hold (embla convention).
- `packages/ui/rete/scripts/codegen.mjs`: port embla's `copyThemes` step — copy `src/themes/`
  → each leaf `src/themes/`, throwing if `src/themes/` is missing; log `(+ themes/)`.
- Each leaf `package.json`: add `./themes/*` to `exports` + `themes` to `files` (match embla's
  emitted leaves).
- Rebuild all 6 targets via `node scripts/codegen.mjs`.

## Docs

- `docs/components/rete-comparison.md`: add a **"Zero-config styling, re-skinnable"**
  feature-matrix row (Rozie ✅ `--rozie-flow-*` tokens + shadcn/Material/Bootstrap bridges;
  incumbents ⚠️ unstyled / hand-roll), a "Where Rozie wins today" bullet, and update the
  "Try it" note (no engine CSS to import; tokenised + bridgeable). Bump `surface_hash` in the
  frontmatter.
- `docs/components/rete.md`: add a **Theming** section (token table, override example, the
  three bridge imports, dark-mode note) mirroring embla.md's theming section.
- `docs/tests/comparison-surface.test.ts`: update the rete `surface_hash` guard to match.

## Verification

1. `node packages/ui/rete/scripts/codegen.mjs` clean — 6 targets emitted, themes vendored.
2. Leaf typecheck/builds green across all 6 (`turbo run typecheck --force --continue`).
3. Grep confirms **no** raw hex/rgba left in `FlowCanvas.rozie`'s `<style>` or the 5 imperative
   SVG sites (each now `var()` or `flowToken(...)`).
4. Docs surface test green (`--filter` docs vitest) after `surface_hash` bump.
5. VR: existing `FlowCanvasScreenshot.png` byte-identical (no rebless); new dark cell added +
   Linux-rendered baseline committed.
6. Manual: override `--rozie-flow-accent` at `:root` in a demo → every selection cue recolors;
   toggle `.dark` → dark palette applies.

## Execution note (as-built, 2026-07-03)

**Dark mode ships as a zero-import, OS-driven default — via the `:root {}` escape hatch,
not a top-level scoped `@media` block.** During execution a *scoped* `@media
(prefers-color-scheme: dark)` block emitted as *unconditional* dark: Rozie's CSS scoping
pass **silently drops a top-level `@media` wrapper** and hoists its inner rule out (a real
compiler bug — it also silently defeats `Dialog.rozie`'s `prefers-reduced-motion` guard).
A direct compile probe then showed the fix: the **`:root {}` escape hatch preserves
at-rule children verbatim** (parseStyle CR-01) on **all six** targets (react/vue/svelte
global CSS, angular `::ng-deep`, lit injected document styles, solid inline global). So the
dark block lives inside the escape hatch — where the engine-DOM chrome already lives — and
sets the tokens on the bare `.rozie-flow-canvas`; they inherit onto the engine DOM and are
read by `flowToken()`. Result:

- **Zero-import OS-dark default on all six** — exactly the approved design, achieved
  without a compiler change (the escape hatch is the correct home for tokens that must
  reach unscoped engine DOM anyway).
- **Light default is byte-identical** (git-diff: the scoped CSS is unchanged; the dark
  `@media` is added only to the global/`:root` bucket and is query-gated) → **no VR
  rebless**.
- **`themes/base.css`** adds the app-toggled `.dark`/`[data-theme]` class strategy on top
  (for the five light-DOM targets) and is the explicit token reference.

**Follow-up (separate task): fix the compiler's scoped-`@media` silent-drop.** The
top-level scoped path should preserve/re-wrap at-rules (as the escape-hatch path already
does) rather than hoist them to unconditional; at minimum it should emit a diagnostic.
This also fixes `Dialog.rozie`'s broken `prefers-reduced-motion`. Wide blast radius (the
shared CSS pass) → owns its own red-first fixture + full target-suite/dist-parity rebless.

- **The net-new dark VR cell is deferred** — it needs a dark-rendered demo cell + a
  Docker-Linux baseline (macOS baselines fail CI). The light baseline is byte-identical,
  so the existing cell still guards the default.

## Out of scope / deferred

- Refreshing the *light* default look (kept byte-identical).
- A dark baseline for every existing flow demo (one representative dark cell only).
- Per-node / per-type token overrides beyond what `data`-driven inline styles already allow.
