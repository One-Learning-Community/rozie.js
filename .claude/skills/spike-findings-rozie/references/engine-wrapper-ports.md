# Engine-wrapper ports — one `.rozie` wrapping a vanilla-JS engine, six idiomatic outputs

The killer-component-port thesis: collapse 6 separately-maintained per-framework wrappers into one
authored file.

## Requirements

From the `killer-component-ports` idea.

- **REQ-3 (port design)** — `<props>` defaults to a single `options: Object` pass-through plus 1–2
  convenience props (e.g. `disabled`). Do NOT enumerate the engine's full option surface.
- **REQ-2/REQ-4** — use `$el` for root-element access (lowered in all 6 via IR-level `__rozieRoot`
  synthesis). Exception: when the author already declared `ref="X"` on the root, `$el` synthesis
  bails — use `$refs.X`.
- **REQ-1** — user-authored `<script>` imports hoist to module top in React/Solid/Angular/Lit.
- **REQ-37 (`$`-prefixed engine APIs — Svelte-driven, benefits all)** — engines whose authoring API is
  `$`-prefixed (Lexical: `$getSelection`, `$createParagraphNode`) MUST be imported via **namespace
  import** (`import * as lexical from 'lexical'; lexical.$getSelection()`), never named imports.
  Rozie passes both through verbatim (closed allow-list, no `$`-prefix heuristic), but the **Svelte
  compiler** rejects `$`-prefixed imports/bindings (`dollar_prefix_invalid`). The namespace form turns
  each call into a property access. This is the exact wall the `svelte-lexical` community binding hit.
- **REQ-39 (decorator bridge — the escape hatch)** — a Lexical `DecoratorNode`'s `decorate()` returns a
  framework-NEUTRAL descriptor (`{ component, props }`), never target markup. A per-target **mount
  bridge** renders it. Rozie does NOT synthesize this — same principle as portal slots. Cost measured
  at **~33 LOC/target** on Lit: finite one-time hand-work, not a swamp.
- **REQ-40 (Lit shadow DOM)** — Lexical runs in a Lit **open** shadow root with ZERO special selection
  handling; Lexical 0.48 owns `getComposedRanges` internally. Wrapper obligations: `mode:'open'`
  (closed unsupported), inject theme CSS into the shadow root, `setRootElement(null)` on
  `disconnectedCallback` + re-set on reconnect, and `mousedown`-preventDefault on toolbar buttons to
  keep the caret selection. Browser floor Chrome 137+ / FF 142+ / Safari 17+ is the documented caveat.
- **REQ-25/26** — **Angular is the first-class runtime-verification target.** It is repeatedly the one
  target proven only by compile-check + prior art (analogjs AOT cost). Wire the real Angular runtime
  cell before declaring an engine-wrapper phase done.

## What to Avoid

- Named `$`-prefixed imports (Svelte compile error).
- Enumerating engine options as discrete props.
- Declaring Angular runtime-verified on the strength of prior art alone.

## Constraints

Lifecycle teardown: prefer `$onMount(() => { …; return () => teardown() })` over a separate
`$onUnmount` — one colocated hook, lands correctly in all 6.

## Origin

Spikes: 001, 009, 013, 015 — sources in `sources/001-sortablejs-port/`, `sources/009-*/`, `sources/013-*/`, `sources/015-*/`
