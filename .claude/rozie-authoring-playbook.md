# Rozie Authoring Playbook (agent-internal)

My working reference for writing `.rozie` components and touching the compiler. Distilled from
`docs/guide/features.md` (the authoritative product doc — read it when this is thin), the
agent memory store (`~/.claude/projects/.../memory/`), the emitter source, and the shipped examples. **When in
doubt, the product doc + source win; this is the fast path + the gotchas they don't centralize.**

Sources of truth:
- Feature surface & per-target lowering tables → `docs/guide/features.md` (1200+ lines, canonical)
- Every diagnostic → `packages/core/src/diagnostics/codes.ts` (212 ROZ codes) + `docs/reference/diagnostics.md` (auto-generated)
- Public API barrel → `@rozie/core` (`compile`, `ModifierRegistry`, `registerModifier`, …)
- Canonical examples → `examples/` (7 reference components, byte-verified across 6 targets) + `examples/demos/` (VR demos) + `packages/ui/*` (shipped engine-wrapper ports)
- Deep-dive gotchas → memory files referenced as `[[slug]]` below

---

## 0. Mental model (internalize this)

- **One source → six idiomatic targets**: React 18+, Vue 3.4+, Svelte 5+ (runes), Angular 19+ (signals), Solid, Lit. Rozie owns the **author-side API only**; it is NOT a runtime framework.
- **Audience = component-library / design-system authors** wrapping vanilla-JS engines. Every feature must answer "does a component-library author need this?" Aesthetic default: **"what would a Vue dev expect?"** Push back on JSX-isms.
- **Setup-once reactivity**: `<script>` closures run ONCE at setup (like Vue/Svelte/Solid `setup`), NOT per render. `let n = 0; const incr = () => n++` just works — no `useCallback`/dep-array gymnastics in source. The React emitter does heavy lifting to preserve this illusion (see §10 + §11).
- **Parity bar = "high percentage", not 100%.** The one big documented divergence is React slots (render-prop API). Accept documented edge cases; don't chase 100%.
- `r-*` directives (not `v-*`), `{{ }}` allowed in plain attribute values, rich inline JS in handlers, parameterized dotted event modifiers — deliberately a Vue/Alpine *dialect*, not Vue.

---

## 1. SFC structure

```rozie
<rozie name="Foo" inherit-attrs="false" inherit-listeners="false" safe-interpolation="false">
<components>{ Child: './Child.rozie' }</components>
<props>{ value: { type: Number, default: 0, model: true } }</props>
<data>{ open: false }</data>
<script lang="ts"> /* setup-once JS/TS */ </script>
<listeners><listener :target="document" @keydown.escape="close" r-if="$props.open" /></listeners>
<template> … </template>
<style lang="scss"> /* scoped by default */ </style>
</rozie>
```

- **Envelope `<rozie name="...">` is mandatory** (ROZ001 if missing). `name` drives the emitted component identifier.
- Envelope attrs: `inherit-attrs` / `inherit-listeners` (default true), `safe-interpolation` (default on; precedence: envelope › global option › default).
- Blocks `<props>`/`<data>`/`<listeners>`/`<components>` are **opaque** to the HTML splitter (custom `inOpaqueBlock` flag) — see [[project_splitter_opaque_block_discipline]]. A block ends at the **first literal close sequence of its own tag**, even inside a JS string → escape `<\/script>` etc. (ROZ005).
- `<props>`/`<data>` are parsed by `@babel/parser.parseExpression`, NOT JSON5 — arrow factories (`default: () => []`), `Infinity`, type tokens (`Number`) all work.
- `<script lang="ts">` opts into TS; untyped script is auto type-neutralized (`any` on untyped params/null-lets/for-of) via `typeNeutralizeScript` in `lowerToIR` — see [[project_typeneutralize_script]].

---

## 2. Sigils (the `$` author-side magic)

| Sigil | Read/Write | Meaning | Gotchas |
|---|---|---|---|
| `$props.x` | read | declared prop value | writing a non-model prop = **ROZ200**; writing a model prop via `$props` = **ROZ204** (use `$model`) |
| `$model.x` | **write only** | two-way emit for `model:true` prop | no `$model.x` *read* — read via `$props.x`. Mnemonic: `r-model:` outside, `$model.` inside |
| `$data.x` | read/write | local reactive state | — |
| `$refs.name` | read | element/instance from `ref="name"` | **only safe in `$onMount`/post-mount callbacks**. Reading in `$computed`/`$watch`-getter/template binding/`{{}}`/`r-if`/`r-for` = **ROZ123** ([[project_refs_only_safe_in_onmount]]) |
| `$el` | read | component root element | engine mount target |
| `$attrs` / `$listeners` | read | undeclared consumer-passed clusters | member access works; bare whole-object exempt from ROZ978; use with `r-bind`/`r-on` |
| `$slots` | read | slot presence | bare `$slots` = ROZ978 |
| `$event` | read | event object in handlers | reserved closure-param name across all 6 ([[project_event_sigil_convention]]) |
| `$emit('name', …)` | call | fire a custom event | empty name = **ROZ122** |
| `$computed(() => …)` | — | derived reactive value | no `$refs` inside (ROZ123) |
| `$watch(() => getter, cb, opts?)` | — | react to transitions | see §4 |
| `$onMount/$onUnmount/$onUpdate(fn)` | — | lifecycle; `$onMount` return = teardown | source order preserved |
| `$expose({ fn, … })` | — | consumer-callable imperative handle | functions only; collisions ROZ115–121,124 |
| `$snapshot(x)` | call | non-reactive UNWRAP — identity on 5, `$state.snapshot(x)` on Svelte | only for libs that `Object.defineProperty` the value (Chart.js). NOT a deep copy — use `$clone` for history/undo. Narrow use — see §6 |
| `$clone(x)` | call | independent DEEP clone, safe on a reactive object on all 6 | lowers `rozieDeepClone(x)` from `@rozie/runtime-vue` (Vue, Phase 45-07 — recursive proxy-safe `structuredClone(deepToRaw(x))`; the old `structuredClone(toRaw(x))` threw on a nested INDEPENDENT reactive proxy/ref, WR-02) / `$state.snapshot(x)` (Svelte) / `structuredClone(x)` (R/Solid/Ng/Lit); preserves Date/Map/Set (vs lossy JSON); `$clone(null)`→`null`; throws on fns/DOM (author error). Use for undo/history/scratch snapshots. Distinct from `$snapshot` (unwrap-only). ROZ135 warns on bare `structuredClone(<reactive>)`. NOTE: a Vue leaf using `$clone` now needs `@rozie/runtime-vue` in its package.json `dependencies` (first such leaf = rete-vue). |
| `$classSelector('cls')` | call | class-name → `.cls` selector, compile-validated vs `<style>` | single bare token; undeclared class = compile error w/ did-you-mean |
| `$portals.NAME(content, scope)` | call | imperatively mount a portal slot fill → disposeFn | see §7 |
| `$reconcileAfterDomMutation()` | call | tell framework "DOM changed, rebuild now" (Lit-load-bearing, no-op elsewhere) | pair with `r-external`; §6 |
| `$restoreFocus(selector, idx)` | call | re-focus a row after keyed reorder (Svelte/Solid/Lit; no-op React/Vue/Angular) | selector must be string literal (ROZ975/976) |

**ROZ978**: a bare whole-object sigil (`{{ $data }}`, `$props` alone) is always an error (independent of `safeInterpolation`). Member access is fine. `$attrs`/`$listeners` exempt.

---

## 3. Template directives + modifiers

- Conditionals: `r-if` / `r-else-if` / `r-else`; **`r-match` / `r-case` / `r-default`** (switch; strict `===`; comma-alternatives `r-case="'a','b'"`; literal-`true` predicate mode). v1 does NOT auto-key match branches — add explicit `:key` for fresh DOM on swap.
- Loops: `r-for="item in items"` + `:key`. (`r-case` + `r-for` on same element = error.)
- Show/bind: `r-show`, `:prop="expr"` (bind), `{{ expr }}` (interp; non-primitives wrapped in `rozieDisplay` unless provably primitive — boolean HTML attrs never wrapped).
- Two-way: form-input `r-model="$data.x"` (+ `.lazy`/`.number`/`.trim`); consumer-side `r-model:propName="…"`.
- Spread: `r-bind="obj"` (attrs), `r-on="obj"` (listeners). Literal objects → per-key native; dynamic → runtime normalizer. Multiple listeners for same event **all fire in source order**.
- Auto-fallthrough: undeclared consumer attrs/listeners land on the single root element by default. >1 root + fallthrough on = ROZ970/973. Manual: `inherit-*="false"` + `r-bind="$attrs"`/`r-on="$listeners"`.
- `r-external`: marks an element whose children a JS engine mutates → "rebuild children, leave this element alone" (Lit-load-bearing). §6.
- **Event modifiers** (chainable, parameterized): `.stop .prevent .self .capture .passive .once .debounce(ms) .throttle(ms) .outside($refs.a,$refs.b) .enter/.escape/.tab/.space/.arrow{Up,Down,Left,Right}/.delete`. **No internal whitespace in modifier arg lists** (`.outside($refs.a,$refs.b)` not `, `) — the attribute name ends at the first space. Grammar is a PEG: `packages/core/src/modifier-grammar/modifier-grammar.peggy`. Custom modifiers via `registerModifier` + `compile({ modifierRegistry })`.
- `r-model` modifiers: `.lazy` (change not input — React emits uncontrolled `defaultValue`+`onBlur`, the one documented parity edge), `.number`, `.trim`. Misuse → ROZ960–963.

---

## 4. `$watch` — the engine-reconciler workhorse

- `$watch(() => $props.x, cb)` is **lazy by default** — never fires on initial value, only on post-mount transitions (uniform across all 6). This is the right tool when `$onMount` is too early (ref not yet populated; engine not yet built).
- `{ immediate: true }` (third arg) = eager initial fire. **Ordering vs `$onMount` is target-dependent** (before on Vue/Angular, after on React/Svelte/Solid/Lit) — do NOT use `immediate` for engine reconciliation that needs the engine to exist. Reserve for self-contained side effects.
- Change detection = reference equality (`!==`). A getter returning a fresh object/array each run fires every tick — watch a stable reference or a derived primitive.
- Single-getter form only; no array-of-getters, no `oldValue` param. Malformed → soft ROZ109, skipped.

---

## 5. Props / models / expose

- `required: true` is the **sole** optionality determinant; `default:` is orthogonal (a default always makes it optional). `required:true` + `default:` = incoherent → ROZ014, default dropped.
- `model: true` → six native two-way expansions. Read `$props.x`, write `$model.x`.
- **Angular single-model component → real `ControlValueAccessor`** (`[(ngModel)]`/`[formControl]` work). On by default; opt out `angular:{cva:false}` / `--no-cva`. Multi/zero model = no CVA (ROZ125/126). `writeValue`/`registerOnChange`/etc. `$expose` names collide → ROZ124.
- `$expose({ fns })` → per-target handle. React wraps in `forwardRef` + `useImperativeHandle` (only when `$expose` present — else NO forwardRef). Typed `FooHandle` synthesized from `<script lang="ts">` signatures. Expose a *value* via a getter method.
- Typed `.rozie` imports via per-module `<Name>.d.rozie.ts` sidecars (unplugin `buildStart` / CLI). Needs `allowArbitraryExtensions:true` in consumer tsconfig (React/Solid/Lit/Svelte); Vue's vue-tsc honors under `bundler`; **Angular writes NO sidecar** (would shadow the AOT `.rozie.ts` disk-cache → JIT-crash; [[project_angular_ngtsc_sidecar_shadowing]]).
- **Consuming an `@emit`: the handler receives the payload OBJECT as arg0 directly** — `$emit('node-action', { id, name, detail })` → `@node-action="onAction"` → `onAction({ id, name, detail })` (mirrors `@selection-change → { ids }`). It is NOT a wrapped `CustomEvent`, so reading `e.detail.name` is `undefined` on all 6 (the wrapped-DOM-event mental model is wrong). Keep a `e.name == null && e.detail ? e.detail : e` fallback only for a raw-DOM-event Lit consumer (rete NodeToolbar, Phase 44).

---

## 6. THE ENGINE-WRAPPER RECIPE (the killer pattern Rozie exists for)

Wrapping a vanilla-JS engine (flatpickr, Sortable, Leaflet, TipTap, Chart.js, CodeMirror, FullCalendar, MapLibre, Uppy). Proven template = `examples/SortableList.rozie` + the `packages/ui/*` ports. Steps:

1. **Mount in `$onMount`, return teardown**: `let instance = null; $onMount(() => { instance = new Engine($refs.elOrEl, cfg); return () => instance?.destroy() })`. `instance` is a top-level `let` referenced from a hook → React auto-hoists to `useRef` (`hoistModuleLet`).
2. **Element-dependent config → build in `$onMount`, gate consumer with `r-if`**: `$refs` is null pre-mount (ROZ123 if read eagerly). Put `$data.cfg = [...elementDependentStuff]` in `$onMount`, then `<Engine r-if="$data.cfg" :cfg="$data.cfg" />`. Prefer passing **elements over selector strings** (selectors can't see into Lit's shadow DOM). [[project_refs_only_safe_in_onmount]]
3. **React to prop changes via lazy `$watch`** (not `immediate`): `$watch(() => $props.data, v => { instance.update($snapshot(v)) })`.
4. **`$snapshot(x)`** ONLY when the lib mutates property descriptors (Chart.js `Object.defineProperty` vs Svelte 5 `$state` proxy → `state_descriptors_fixed`). Most engines don't need it — leave it out if unsure (Svelte cost = real deep clone).
5. **`r-external` + `$reconcileAfterDomMutation()`** when the engine moves DOM under a framework-owned container (Sortable, TipTap). Marker = location, sigil = trigger. Load-bearing on Lit only; no-op + byte-identical on the other 5.
6. **`$classSelector('grip')`** for class-as-selector engine config (compile-validated against `<style>`).
7. **`$expose({ … })`** for the imperative handle (focus/clear/flyTo/…). Verb names must not collide with emitted event/prop names (ROZ121) — e.g. a `focus()` expose vs a `focus` event ([[project_next_port_tiptap]] 3rd collision class).
8. **Engine-DOM styling**: engine-created nodes never carry the scope attr → use the **nested `:root { .cm-editor {…} }`** escape hatch (NOT `:global()` → ROZ128). §9.
9. **Portal slots** for engine-rendered slot holes (panels, node-views, popups). §7.

**Collision classes catalogued so far** (name a thing two ways that collapse on some target): prop==slot name (ROZ127, Svelte), expose==event name (ROZ121), event⇄verb (focus/blur, TipTap), model-prop==emit-name (zoom/pitch dropped, MapLibre [[project_next_port_maplibre]]), import-name==component-name (alias the engine import, Cropper), expose-verb==inherited-DOM-method on Lit (`scrollTo`→`scrollToIndex`, Embla), local-const==inherited-DOM-property on Lit (`const nodeType`→`injectedType` shadows `Node.nodeType` TS2416, rete `Port`), **reserved-word prop name** (`<Port in=>` → Svelte `$props()` destructure `let { in } = $props()` is illegal; Dan renamed the attr `in`/`out`→`input`/`output` over a Svelte emitter fix — rete Phase 41), r-for-loop-var==slot-name / `#body` slot-param shadow on Svelte (rename `slide`→`item`, `node` shadow — Embla/rete), **local-name==ref-name self-shadow** (`const X = $refs.X` → `const X = X(.current)` TDZ on React+Svelte — now AUTO-FIXED by the deconflict pre-pass renaming the local `X$local`; the `$refs` analog of the `$props` self-shadow; refs-lowering-cross-target). When adding a port, watch for a new one.

**`$refs`-to-child-component now resolves the $expose handle on ALL SIX** (refs-lowering-cross-target Finding 2, was an Angular parity edge): Angular `$refs.<childComponent>` formerly lowered to the host `ElementRef` (`this.X()?.nativeElement`) so consumer `$refs.child.exposedMethod()` silently no-op'd; it now lowers to the COMPONENT INSTANCE (`viewChild<ChildType>('X')` → `this.X()`), matching React (forwardRef handle) / Vue / Svelte / Solid / Lit. A ref on a plain DOM element still resolves to the element. Detection = `ref.elementTag ∈ <components> localNames ∪ self-name` (`packages/targets/angular/src/rewrite/componentRefs.ts`).

### 6a. CONTROLLED-GRAPH + TYPE-TEMPLATE recipe (rete FlowCanvas, Phase 41 — for graph/canvas engines)

When the engine owns a GRAPH (nodes + edges) the consumer should NOT hand-reconcile. The xyflow `nodeTypes` + controlled-`nodes`/`edges` model, made Vue-natural:

1. **Bind ONE `r-model:graph` object** = the single source of truth: `{ nodes:[{id,type,x,y,data}], connections:[{id?,source,sourceOutput,target,targetInput}] }`. NOT split `:nodes`/`:connections` config arrays, NOT per-instance children.
2. **Type templates declared ONCE** as children: `<NodeType type="source"><template #body="{ node, selected, emit }">…</template><Port output="num" type="number" /><Port input="x" type="string" multiple /></NodeType>`. A `<NodeType>` has NO id/x/y — it is a TEMPLATE; **every** graph node whose `type` matches renders it (render-by-type). Port DIRECTION is the attribute name (`output=`/`input=`), `type` drives validation + color.
3. **The canvas WRITES BACK** — drag rewrites `graph.nodes[i].x/y`; connect/disconnect rewrite `graph.connections`. Emit a **FRESH top-level `{nodes,connections}` object** (immutable applyNodeChanges style — in-place deep mutation is silently dropped on React/Solid/Lit/Angular). Echo-guard with the `programmatic` counter; coalesce/throttle high-frequency drag write-back.
4. **Render-by-type = the reactive `#body` portal, per node.** ONE portal handle PER graph node (a `Set`/map of live handles), NOT one shared handle — a shared `let bodyHandle` that disposes the prior on each call renders only the LAST node of a type (the count-only-VR-masking landmine; surfaced 41-05). Mirror FlowCanvas's per-node `$portals.body` map. The canvas owns per-node disposal; NodeType must NOT dispose siblings.
5. **Automatic typed validation** from `<Port type>` (`:validate-types`, default ON) — resolve src/tgt port types in `$onMount` (NOT a top-level `useCallback` that captures the INITIAL empty registry → React stale-closure → cross-type wrongly allowed, 41-05). `canConnect` is the OPTIONAL custom-rule OVERRIDE (a PURE predicate — no `$data` write / no engine call inside the connectioncreate signal chain). `connection-rejected` fires on either.
6. **Context across the portal boundary doesn't cross** — `<Port>` children stay in the NORMAL child position (so `$inject` resolves tree-scoped on 5/6); only the `#body` teleports. Separate the teleported body slot from the context-consuming config children.
7. **Per-node action in a `#body` (✕ remove etc.)**: TOP-LEVEL handler (NOT slot-scope `emit('remove', node.id)` — slot-scope `emit`/`node` are NOT accessor-rewritten inside an `@event` body on Solid, the foreign-slot accessor limitation). Ride the id on `:data-id`, read it back via `e.target.closest('[data-id]')`, filter into a FRESH graph object. Bind `@pointerup` (NOT `@click` — swallowed by Rete's node-drag; NOT `@pointerdown` — Rete `stopPropagation`s it at the node element, dead on Solid's delegated handler).
8. **Lit object-prop landmines**: a bare boolean attr on an untyped/object-typed prop is `@property({type:Object})` → `JSON.parse('')` THROWS → BIND it (`:multiple="true"`, never bare `multiple`). A `label` you want as a string → `label: { type: String }` (else `JSON.parse("number")` throws). Port colors via the nested `:root{}` engine-DOM escape hatch (§9).
9. **Clean break over two models** — instance `<FlowNode id>` / one-way `:nodes` / flat `<Connection>` are REMOVED; carrying two models is the disjoint being fixed. Edges live ONLY in `graph.connections`.
10. **Connection-gesture signals are ConnectionPlugin-SCOPE** (rete, Phase 44 edit bundle) — `connectionpick` / `connectiondrop` fire on a pipe attached DIRECTLY to `connectionPlugin.addPipe`; they do NOT propagate into `editor.addPipe` or `area.addPipe` (unlike `connectioncreated`/`connectionremoved` = editor-scope, `nodepicked` = area-scope). `connectiondrop` data is `{ initial, socket, created }` — it carries **NO pointer event**, so a drop position comes from `area.area.pointer` (the AreaPlugin's live pointer, ALREADY graph coords), never a client→graph projection of a drop event. **Edit gestures that span the drop (reconnect undo-coalescing, connect-end-on-pane) must DEFER any close/emit to a macrotask** (`setTimeout 0`, microtask fallback): the classic preset emits `connectiondrop` BEFORE its trailing `connectionremoved` + `connectioncreated` writeBacks (verified trace: `drop → connectioncreate → connectioncreated → connectionremove → connectionremoved`), so a synchronous close runs while the writeBacks haven't fired and double-counts/misses. One `connectiondrop` handler can carry multiple `!programmatic`-gated responsibilities (reconnect coalesce-close + connect-end emit) without interfering — they key off different drop shapes (`socket!=null` reconnect vs `socket==null && !created && initial.side=='output'` pane-drop).
11. **A reconnect produces a transient EMPTY `connections` frame** (after remove, before add) — any readout/`$computed`/template reading `graph.connections[0].targetInput` on a reconnect-capable canvas must guard the empty array or it throws mid-gesture.

---

## 7. Slots

- Scoped params: `<slot :item="item" :toggle="() => …">fallback</slot>`; consumer `<template #default="{ item: row }">`. React consumers get a **render-prop** API (`children?: (ctx) => ReactNode`) — the big documented divergence.
- **Slot name == prop name = ROZ127** (Svelte 5 collapses snippets+props into one `$props()` bag). Rename (append engine hook name).
- **Portal slots** (mount-once): `<slot portal />` + `$portals.NAME(content, scope) => disposeFn`. For engine-rendered holes the framework doesn't own.
- **Reactive portal slots**: `<slot portal reactive />` → `{ update, dispose }`, engine-driven in-place re-render (shipped Phase 33: React flushSync / Vue·Lit re-render / Solid signal{equals:false} / Angular Object.assign+detectChanges / Svelte PortalHostReactive). Use for node-views (TipTap mention/callout). [[project_portal_slots_spike]]

---

## 8. Reactivity gotchas by target (when output differs)

- **`structuredClone()` THROWS on a Vue `reactive()` / Svelte `$state` proxy** (rete undo, Phase 44 — collision-class). A bare `structuredClone(someReactiveObj)` silently fails ("could not be cloned") on Vue + Svelte ONLY, leaving snapshot/history empty on those two targets while React/Solid/Lit work — a brutal target-asymmetric trap. **FIX (Phase 45): use the `$clone(x)` sigil** — one author-side call that lowers to `rozieDeepClone(x)` (Vue, from `@rozie/runtime-vue`), `$state.snapshot(x)` on Svelte, and `structuredClone(x)` on the other four, yielding an independent deep DE-PROXIED copy on all six while preserving `Date`/`Map`/`Set` (the old JSON-first workaround — `JSON.parse(JSON.stringify(x))` — was lossy: `Date`→ISO string, `Map`/`Set`→`{}`). **Phase 45-07 (WR-02/WR-06):** the Vue lowering was originally `structuredClone(toRaw(x))`, which still THREW one level deep — a single top-level `toRaw` leaves a NESTED INDEPENDENT reactive proxy / ref (or an array of reactive items, or `$clone({d: src.data}).d` where `src.data` is a live proxy) live, and `structuredClone` rejects it. Svelte's `$state.snapshot` recursively de-proxies and never shared the hole. The fix routes Vue through `rozieDeepClone = structuredClone(deepToRaw(x))` (recursive WeakMap-guarded de-proxy walk), bringing Vue to parity. **Gotcha:** a Vue leaf using `$clone` now needs `@rozie/runtime-vue` in its package.json `dependencies` (rete-vue was the first — its omission broke `@rozie/docs` build with "Rollup failed to resolve @rozie/runtime-vue"). **ROZ135 (warn)** still fires on a bare `structuredClone(<member rooted at $data/$props/$model>)` to steer you to `$clone`. FlowCanvas's hand-rolled `cloneGraph` helper was retired in favor of `$clone` (the dogfood). `$clone(null)`→`null` on all six; it throws (not silent) on functions/DOM nodes (author error, not valid serializable state). See §2 row + §6 step 4 (`$snapshot` is unwrap-only, NOT a deep copy — use `$clone` for any history/undo snapshot).
- **React** (the fragile one — re-runs the body every render):
  - top-level `let X` reassigned & hook-referenced → `useRef` (`hoistModuleLet`); reads/writes rewritten to `.current`.
  - top-level `const X = init` escaping into a useEffect → `useMemo(()=>init,[deps])`.
  - **top-level member-mutated fresh-instance `const/let X = new Set()`/`[]`/`{}` → `useMemo(()=>init,[])`** (FIXED 2026-06-07, [[feedback_react_const_mutinstance_not_stabilized]]). This is the setup-once-persistence guarantee; without it cross-render scratch state resets every render → can infinite-loop if a render side-effect depends on it.
  - lazy `$watch` → `useEffect` w/ a `useRef(true)` first-run skip (ref kept OUT of deps).
  - watched props rewritten to `_<X>Ref.current` to satisfy exhaustive-deps without re-mount churn.
  - **a local named the same as a `ref=` and initialized from `$refs.<sameName>` is renamed `<name>$local`** (`deconflictRefShadows`, refs-lowering-cross-target) — else `const flow = $refs.flow` → `const flow = flow.current` self-shadow TDZ. Surgically gated on an actual `$refs.<name>` read (zero corpus drift).
  - D-62: emitted output may carry a targeted justified `eslint-disable` ([[project_d62_relaxed]]).
- **Solid**: eager memos → reading `$refs` in `$computed`/`$watch`-getter crashes (TDZ). Foreign-slot accessor limitation. `:class` precedence quirk (fixed [[project_next_port_tiptap]]).
- **Lit**: `$watch` props route → `updated()`+`changedProperties.has`; effect route → preact-signals. `r-external` → `keyed(this._rozieReconcileSeq, …)`. Shadow-DOM scoping (adoptedStyleSheets bridge for consumer slots).
- **Angular**: `$onMount` → `ngAfterViewInit` + `inject(DestroyRef)` ([[project_rozie_angular_onmount_emit_bug]]). NgClass import was latent-missing in 13 files (fixed). `::ng-deep` for `:deep`. **`$refs.X` lowers to `this.X()?.nativeElement` for DOM-element refs but to `this.X()` (the COMPONENT INSTANCE via `viewChild<ChildType>`) for a ref on a `<components>` child** (refs-lowering-cross-target Finding 2) — so `$refs.child.exposedMethod()` reaches the $expose handle like the other 5 targets. The `this.` qualifier also makes Angular structurally immune to the React/Svelte ref self-shadow TDZ.
- **Svelte 5**: snippets+props share `$props()` (→ ROZ127). `$state.snapshot` for `$snapshot`. a11y warnings on demo event patterns are status-quo ([[project_example_a11y_warnings_status_quo]]). **`deconflictAccessorShadows` renames a local that shadows a `$props`/`$refs` name + reads `$accessor.<sameName>` to `<name>$local`** (the `const X = $props.X`/`$refs.X` → `const X = X` TDZ fix; both accessors, refs added in refs-lowering-cross-target).
- **Vue**: closest to source; `defineModel`/`defineExpose`/`withDefaults`. Often byte-untouched (e.g. `rozieDisplay` not needed — native `toDisplayString`).

---

## 9. Styling

- `<style>` scoped by default via `[data-rozie-s-<hash>]` attr (React too — class names stay literal in DOM, no class hashing).
- **`:root { --var }`** → global document layer (per-target escape hatch).
- **`:root { .selector {…} }`** (nested) → bare/unscoped → **engine-DOM escape hatch** (reaches engine-created runtime nodes on all 6, incl through Lit shadow via dual-sink). THIS is how you style `.cm-editor`, `.ProseMirror`, flatpickr calendar, etc.
- **`:global()` is forbidden → ROZ128** (works only Vue/Svelte, silently dead on React/Solid/Lit). Use nested `:root`.
- `:deep(.child)` → intra-shadow cross-component reach (Vue passthrough / `::ng-deep` / scoped-compound rewrite). Lit: works in one shadow root, NOT across boundaries.
- `::part(name)` → the ONLY cross-Lit-shadow reach (producer `part="name"`, consumer `Child::part(name)`). Load-bearing on Lit, dropped no-op on other 5. Give it its own rule (don't comma-combine).
- `<style lang="scss">` compiled build-time (sass optional peer dep). `lang="less"` deferred.
- `@portal NAME { }` CSS scoping for portal-slot content ([[project_spike_004_status]], [[project_portal_css_specificity_limitation]]).

---

## 10. Compiler-internals gotchas (when EDITING the emitters)

- **Setup-once preservation is the React emitter's hard job.** Any top-level `<script>` binding holding cross-render mutable state must persist per-instance: reassigned-`let`→`useRef`, escaping-`const`→`useMemo([deps])`, member-mutated-instance-`const`→`useMemo([])`. If you see render loops / reset state on React only, suspect a binding not stabilized. (`packages/targets/react/src/emit/emitScript.ts` + `rewrite/hoistModuleLet.ts`.)
- **Core inlines target `src`** — after editing `packages/targets/*/src`, run `turbo run build --force` (turbo doesn't hash inlined target src into core's cache) ([[feedback_turbo_stale_core_on_target_edit]]).
- **`compile()` vs `lowerToIR`**: some shared passes (e.g. `typeNeutralizeScript`, slot-collision validation) live in `lowerToIR`; unplugin bypasses `compile()` → keep validation in the shared lower path + mirror in `compile()` where noted.
- A new emitter shape ⇒ a matching unplugin `resolveId` rewrite (byte-equal-across-entrypoints is an implicit contract; the consumer-demo build is the only true gate) ([[feedback_unplugin_resolveid_mediation]]).

---

## 11. Verification gates (run ALL at orchestrator level — don't trust subagent "passed")

After ANY emitter/lowering change:
1. `turbo run build --force` (whole repo; core inlines target src).
2. **Rebless dist-parity**: `pnpm --filter dist-parity bootstrap` (after the whole-repo `build --force`) — committed `tests/dist-parity/fixtures/*` drift ([[feedback_dist_parity_rebless_after_emitter_change]]).
3. **Rebless target-* snapshots**: `vitest -u` in affected `@rozie/target-*` (e.g. `ts-passthrough.test.ts`) + core `match-*.test.ts` ([[feedback_target_suite_snapshots_drift_on_emitter_change]]).
4. `turbo run typecheck --force --continue` (via turbo, NOT `pnpm -r` which floods phantom errors — [[feedback_typecheck_via_turbo]]). 6 typecheck gates (tsc/vue-tsc/svelte-check) + react/vue/svelte/solid/lit/angular-typecheck packages.
5. `turbo run test --force --continue` (cold cache — caching once shipped 6/8 matrices red after green local turbo).
6. **VR matrix in the pinned Linux container** (macOS baselines fail every CI cell — kerning + Linux-rendered PNGs): `tools/ci-repro/vr.sh -g 'pattern'` (targeted) then bare `tools/ci-repro/vr.sh` (full). [[feedback_vr_linux_baselines]], [[feedback_vr_macos_text_node_kerning]]. Regen baselines: `vr.sh -u -g pattern`.
7. Consumer-demo e2e for runtime (build-green ≠ dev-green when bundling Node libs — [[feedback_vite_build_vs_dev_node_isms]]); `react-vite-demo test:e2e` mirrors CI ([[feedback_local_gate_mirrors_ci]]).

Other: VR baselines for clock/date engines need `now` pinned too ([[project_vr_fullcalendar_now_pin_datestable]]). Canvas/WebGL-in-shadow static screenshots are tracked deferrals (Chart.js, Lit MapLibre). `.planning/` is gitignored → worktrees disabled, executors sequential on main ([[project_planning_artifacts_gitignored]]).

---

## 12. Process norms (Dan)

- **No auto-push** ([[feedback_no_autopush]]) — stop at commit, wait for explicit push.
- **Concurrent sessions share ONE checkout** ([[feedback_concurrent_sessions_same_checkout]]) — verify branch + status before/after; unexpected commits = STOP and ask.
- Inline fixes over `/gsd-quick` for trivial work; just fix bugs + verify, don't pose process decision-matrices ([[feedback_just_fix_bugs]], [[feedback_inline_fixes_over_gsd_quick]]).
- Planner/roadmapper Write can truncate existing files — paste the `<file_safety>` Edit-only block into planner spawns ([[feedback_planner_write_destruction]]).
- No false-equivalent option menus; state the honest recommendation ([[feedback_no_false_equivalent_options]]).

---

## 13. File map (where to look / copy from)

- Reference components (byte-verified 6-target): `examples/` — Counter, Modal, Dropdown, SearchInput, SortableList, Card, TreeNode, ThemedButton*, typed/Props*.
- VR demos: `examples/demos/*.rozie` (behavioral vs screenshot cells are SEPARATE — never bolt pixels onto a behavioral demo or vice versa).
- Shipped engine-wrapper ports: `packages/ui/{sortable-list,flatpickr,chartjs,codemirror,tiptap,fullcalendar,maplibre,rete,cropper,pdf,embla}/src/*.rozie` (+ per-framework pre-compiled `packages/<fw>/` leaves, colocated helpers, `codegen.mjs` doc-automation — [[project_rozie_ui_distribution_model]]).
- Playground: `pnpm --filter rozie-playground dev` (Monaco + per-target preview + "Compare all targets" grid) ([[project_playground]]).
- Emitters: `packages/targets/{react,vue,svelte,angular,solid,lit}/src/emit/`. Shared lowering: `packages/core/src/ir/` + `lower.ts`.
- Diagnostics registry: `packages/core/src/diagnostics/codes.ts`.

---

## 14. Authoring-critical ROZ codes (the ones I'll actually hit)

ROZ001 (missing envelope), ROZ005 (unescaped block-close in string), ROZ014 (required+default), ROZ109 (malformed `$watch`), ROZ115–121/124 (`$expose` malformed/collision), ROZ122 (empty `$emit` name), ROZ123 (`$refs` read eagerly), ROZ125/126 (Angular CVA multi/no-model), ROZ127 (slot==prop name), ROZ128 (`:global()`), ROZ200/204 (write non-model / model-via-props), ROZ960–963 (`r-model` modifier misuse), ROZ970/973 (multi-root + auto-fallthrough), ROZ975/976 (`$restoreFocus` selector), ROZ978 (bare whole-object sigil). Full list: `codes.ts`.
