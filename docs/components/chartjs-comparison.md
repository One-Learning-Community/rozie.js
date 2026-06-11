# Chart.js libraries comparison

[Chart.js](https://www.chartjs.org/) is the most-installed canvas charting
library on the web, and — unlike FullCalendar — it ships **no official framework
connectors**. Every framework binding is a separate community project, and the
quality varies wildly: React and Vue are served by large, healthy wrappers;
Angular and Svelte have solid maintained ones; **Solid's only option has been
frozen since mid-2024; and Lit has no modern Chart.js wrapper at all.**

Rozie's [`@rozie-ui/chartjs`](/components/chartjs) compiles one `.rozie` file to
idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers — six framework
targets from a single source, each a pre-compiled `@rozie-ui/chartjs-*` package
with no Rozie toolchain required. The same generic `Chart` (the `type` prop
drives the whole controller set), the same three structured events, the same
eight-verb imperative handle, the same external-HTML **tooltip portal slot**, and
the same `:plugins` passthrough — on all six.

Every wrapper on this page — including Rozie's — drives the **same `chart.js`
engine, current major v4 (`4.5.x`)**. The engine is shared and well-maintained, so
this comparison is purely about the **per-framework binding layer**: which
frameworks have a binding at all, how current it is, and how consistent the
events / imperative-handle / custom-tooltip story is across them.

## Comparison matrix

Cell legend: **✓** = documented out-of-the-box · **✗** = not supported / not
present · **~** = partial / consumer-glue-required / not documented. ("Not
documented" is scored `~`, never `✗` — absence of documentation is not evidence
of absence.)

| Wrapper | Frameworks | Latest published | Framework support | Structured events | Imperative handle | HTML-tooltip slot | Per-type components | Selective (tree-shakable) registration |
| --- | --- | --- | --- | :---: | :---: | :---: | :---: | :---: |
| **[Rozie @rozie-ui/chartjs](/components/chartjs)** | **6 — React + Vue + Svelte + Angular + Solid + Lit** | this repo (2026-06) | R18+ / V3.4+ / Sv5 / **Ng19+ signals** / Solid / Lit | ✓ **3 uniform** (`click`/`hover`/`datasetClick`, structured, composed) on all 6 | ✓ **uniform `$expose`** (8 verbs) on all 6 | ✓ **portal slot** on all 6 | ✓ **8 typed components** + generic `Chart`, all 6 | ✓ consumer-registers + `/auto` entry (per-type tree-shakes on source leaves) |
| [react-chartjs-2](https://react-chartjs-2.js.org/) | React | **5.3.1** · 2025-10 | React 16.8 – **19** | ~ `options.onClick` + `getElement*AtEvent` helpers (no React events) | ✓ `ref` → Chart.js instance | ✗ external-handler only (no React slot) | ✓ 8 typed + generic `Chart` | ✓ typed components auto-register their controller |
| [vue-chartjs](https://vue-chartjs.org/) | Vue 3 | **5.3.3** · 2025 | Vue 3 (3.x+) | ✗ emits no Vue events | ✓ `ref.chart` → instance | ✗ external-handler only (canvas-fallback slot only) | ✓ 8 typed + generic + `createTypedChart` | ✓ manual `ChartJS.register(...)` |
| [ng2-charts](https://valor-software.com/ng2-charts) | Angular | **10.0.0** · 2026-03 *(v8 = Ng19)* | Angular 17 – **21** *(no signals — `@Input`/`OnChanges`)* | ✓ `chartClick` / `chartHover` (2, Angular only) | ✓ `ViewChild(BaseChartDirective).chart` | ✗ no `ng-template` tooltip | ~ one `canvas[baseChart]` directive (`type` input) | ✓ `provideCharts(...)` selective |
| [svelte-chartjs](https://github.com/SauravKanchan/svelte-chartjs) | Svelte | **4.0.1** · 2026-03 | **Svelte 5** | ~ `getElement*AtEvent` helpers (no Svelte events) | ✓ `bind:chart` → instance | ✗ external-handler only | ✓ 8 typed + generic | ✓ manual `ChartJS.register(...)` |
| [solid-chartjs](https://github.com/s0ftik3/solid-chartjs) | Solid | **1.3.11** · **2024-07** *(frozen)* | Solid 1.7+ | ✗ none documented | ~ not documented | ✗ | ✓ typed + `DefaultChart` | ✓ manual register |
| Lit | — | — | *no modern Chart.js wrapper exists* | ✗ | ✗ | ✗ | ✗ | ✗ |

**Weekly downloads** (npm, snapshot 2026-05-27→06-02 — a popularity datum, *not* a
quality verdict): react-chartjs-2 **≈3,847,476** · vue-chartjs **≈848,265** ·
ng2-charts **≈451,000** · svelte-chartjs **≈55,200** · solid-chartjs **≈9,250** ·
`chartjs-web-components` (the dead Lit option) **≈6** · Rozie `@rozie-ui/chartjs`:
new.

All competitor facts were verified against the npm registry, the GitHub API, and
each project's README / source / `package.json` on **2026-06-05**; re-check the
dates before relying on them.

## Why Rozie's row reads the way it does

- **Cross-framework reach from one source — the headline.** Chart.js has no
  official connectors, so the matrix is a patchwork: React (≈3.8M/wk) and Vue
  (≈0.85M/wk) are healthy; Angular (ng2-charts, ≈0.45M/wk) and Svelte
  (svelte-chartjs, Svelte-5-ready) are solid and current; **Solid's only wrapper
  has been frozen since 2024-07 with no documented instance or event API; and Lit
  has no modern Chart.js wrapper at all** (the only named package targets Chart.js
  2.x / lit-element 1.x and was last touched in 2021). A team standardizing on
  Chart.js across all six frameworks gets two big wrappers, two solid ones, one
  stagnant package, and one hole. Rozie compiles a single `.rozie` definition to
  all six idiomatic targets. **That is the wedge: not "more popular than
  react-chartjs-2," but "the same component everywhere — including the two
  frameworks the ecosystem leaves stagnant or empty."**

- **A uniform, structured event surface across all six.** This is the single
  biggest *capability* difference. Chart.js click/hover handling fragments badly
  per framework: react-chartjs-2 and svelte-chartjs give you `options.onClick`
  plus exported `getElementAtEvent` *helper functions* (no framework events);
  vue-chartjs emits **no** Vue events at all; ng2-charts is the only one with
  native framework events (`chartClick` / `chartHover`); Solid and Lit have none.
  Rozie surfaces **three** events — [`@click` / `@hover` /
  `@datasetClick`](/components/chartjs#events) — with structured payloads
  (`{ event, elements, chart }`, the hit elements already resolved via
  `getElementsAtEventForMode`) **identically on all six targets**, and each is
  *composed* over any consumer-supplied `options.onClick`/`onHover` rather than
  clobbering it. One event shape to learn once, on any framework.

- **The external-HTML tooltip as a first-class portal slot, everywhere.** No
  competitor offers a framework-native tooltip slot or render-prop — on every
  one of them a custom HTML tooltip means hand-writing
  `options.plugins.tooltip.external`, a DOM-building callback that lives outside
  the framework's rendering model. Rozie surfaces it as
  [one `tooltip` portal slot](/components/chartjs#slots) that emits the framework's
  idiomatic consumer surface — React/Solid render-prop, Vue scoped-slot, Svelte
  snippet, Angular `ng-template` content-child, Lit slot bridge — fed the live
  tooltip model (`{ title, body, dataPoints, opacity }`). The slot is guarded:
  omit it and you get Chart.js's default canvas tooltip on every target. Because
  canvas owns its own paint, the external tooltip is the one place a
  framework-native fragment can render over the chart — so Rozie implements that
  one well, on all six.

- **A uniform imperative handle across all six.** Every competitor exposes the
  Chart.js instance its own way — a React `ref` to the instance, vue-chartjs's
  `ref.chart`, ng2-charts's `ViewChild(BaseChartDirective).chart`, svelte-chartjs's
  `bind:chart`, and nothing documented on Solid/Lit. Rozie's
  [`$expose` handle](/components/chartjs#imperative-handle) is the *same* eight verbs —
  `getChart` / `updateChart` / `resizeChart` / `resetChart` / `renderChart` /
  `stopChart` / `clearChart` / **`toBase64Image`** (PNG export) — on every target,
  grabbed with each framework's native ref mechanism. `getChart()` returns the raw
  instance, so the full Chart.js API is always one hop away.

- **Angular emitted in the signals idiom.** ng2-charts — the dominant Angular
  wrapper — is a `canvas[baseChart]` **directive** built on `@Input()` +
  `OnChanges`, not Angular's signals model. Rozie's `@rozie-ui/chartjs-angular`
  is a standalone **component** whose props are signal `input()`s and whose
  reactivity runs through `effect()` — the Angular-19+ idiom — with the same
  `(click)`/`(hover)` outputs and `viewChild`-grabbable handle.

- **`:plugins` consumer-extensibility, applied uniformly.** Chart.js plugins
  (datalabels, annotation, zoom, a custom crosshair) are passed per-instance
  through [`:plugins`](/components/chartjs#extending-with-plugins) — the Chart.js
  analog of an options bag — identically on all six targets, with no per-plugin
  wrapper code and zero bundle cost for plugins you don't engage. (This matches
  the per-instance `plugins` prop the React/Vue/Svelte wrappers also offer; the
  parity point is that Rozie does it *the same way everywhere*.)

## Caveats — where the existing wrappers genuinely win

This page concedes where the standalone wrappers are ahead — that's what keeps the
comparison credible, and it doubles as Rozie's own roadmap.

- **React 19 and Svelte 5 are already covered upstream.** Unlike the FullCalendar
  comparison, version currency is *not* a Rozie wedge here:
  `react-chartjs-2@5.3.1` already lists `react@^19` in its peer range, and
  `svelte-chartjs@4.0.1` already targets Svelte 5. Rozie installs cleanly against
  React 19 and Svelte 5 too — but it is matching the ecosystem on currency, not
  leading it. Rozie's advantage on React/Vue/Angular/Svelte is the *uniform
  cross-framework surface* and one source, not "more current."

- **Per-type components and selective registration — fully closed.** Rozie's
  first cut shipped only the generic `Chart` and force-registered every
  controller. Both are resolved: the generic `Chart` no longer auto-registers
  (the consumer registers what they use, or imports the `/auto` kitchen-sink
  entry), and each package now also exports the eight
  [per-type components](/components/chartjs#per-type-components) — `Line`/`Bar`/…/`Bubble`
  — each registering only its own controller set. The bundled React/Solid/Lit
  packages now expose a **per-variant subpath** for each typed component
  (`@rozie-ui/chartjs-react/line`, `…/bar`, …, `…/bubble`), and each subpath
  resolves to its own isolated chunk that pulls only that one controller set —
  so a consumer importing `/line` ships only Line's registration, never the
  other seven. The barrel `.` import stays the convenient all-variants path. The
  source-shipped Vue/Svelte/Angular packages tree-shake per-type imports
  natively from `src`. This reaches parity with `react-chartjs-2`'s
  selective-registration story across all six frameworks.

- **`datasetIdKey` and a11y `fallback` — now covered.** The `datasetIdKey` prop
  (default `'label'`) matches datasets by a stable key across updates (with index
  fallback), and a non-portal [`fallback` slot](/components/chartjs#slots) renders a11y
  content inside the `<canvas>` (alongside the `ariaLabel` prop) — closing the
  react/vue parity gap on both.

- **Single-framework ergonomics are not the contest.** The matrix scores
  out-of-the-box, cross-framework capability. For a single-React or single-Vue
  app, `react-chartjs-2` / `vue-chartjs` are large, excellent, battle-tested
  libraries and the obvious pick. Rozie's value is reaching all six frameworks —
  including the Solid wrapper that's frozen and the Lit one that doesn't exist —
  from one source, with one events/handle/tooltip surface to learn.

## Try it

The [`@rozie-ui/chartjs` showcase + API reference](/components/chartjs) documents the
`@rozie-ui/chartjs-*` packages — one pre-compiled, per-framework install
(`npm i @rozie-ui/chartjs-react chart.js`, etc.). The
[`ChartScreenshotDemo` source](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/ChartScreenshotDemo.rozie)
renders line, bar, and doughnut from the one generic `Chart`, and the
[`ChartBehaviorDemo` source](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/ChartBehaviorDemo.rozie)
drives runtime type-switching, the `@click` event, the `:plugins` passthrough, and
the `tooltip` portal slot.
