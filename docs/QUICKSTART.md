# Quick Start

Three ways to see a `.rozie` file compile to Vue today. Pick whichever fits your workflow.

## Prerequisites

```bash
pnpm install
```

## Option 1 — CLI (fastest one-shot)

```bash
pnpm --filter @rozie/cli build       # one-time build of the CLI

# print Vue SFC to stdout
node packages/cli/dist/bin.cjs build examples/Counter.rozie

# write to file
node packages/cli/dist/bin.cjs build examples/Counter.rozie --out Counter.vue

# also write source map alongside
node packages/cli/dist/bin.cjs build examples/Counter.rozie --out Counter.vue --source-map
```

Targets other than `vue` are not yet implemented and exit with code 2:

```bash
node packages/cli/dist/bin.cjs build examples/Counter.rozie --target react
# stderr: rozie build: target 'react' not yet shipped — see ROADMAP.md (Phase 4)
```

The CLI is a Phase 6 deliverable; what's here is a working spike landed during a quick task.

## Option 2 — Live Vite demo (full pipeline + HMR)

```bash
pnpm --filter @rozie/unplugin build  # one-time build of the unplugin
cd examples/consumers/vue-vite
pnpm dev                              # http://localhost:5173 with HMR
```

Edit any of `examples/Counter.rozie`, `examples/SearchInput.rozie`, `examples/Dropdown.rozie`, `examples/TodoList.rozie`, `examples/Modal.rozie` — the demo's page switcher reflects changes live.

To run the Phase 3 Playwright suite (6 specs, 5 success criteria + Modal OQ4):

```bash
pnpm test:e2e
```

## Option 3 — Locked snapshots (no run needed)

The Phase 3 emitter pinned the expected output for every reference example:

```bash
cat packages/targets/vue/fixtures/Counter.vue.snap
cat packages/targets/vue/fixtures/SearchInput.vue.snap
cat packages/targets/vue/fixtures/Dropdown.vue.snap
cat packages/targets/vue/fixtures/TodoList.vue.snap
cat packages/targets/vue/fixtures/Modal.vue.snap
```

Per-block snapshots (`*.script.snap`, `*.template.snap`, `*.style.snap`) are also locked alongside the whole-SFC ones.

## Iterating on a new `.rozie` file

```bash
# 1. write your component
$EDITOR examples/MyComponent.rozie

# 2. compile + inspect
node packages/cli/dist/bin.cjs build examples/MyComponent.rozie

# 3. or drop it into the demo for a real mount
cp examples/MyComponent.rozie examples/consumers/vue-vite/src/
# then add a route in src/App.vue and import it
```

## Known caveats

- Source maps are currently sparse — emitVue produces mostly synthetic bytes, so the `[rozie] Source map generated with empty mappings` warning fires on most files. Real byte-level mapping is a follow-up.
- Only the `vue` target works. React lands in Phase 4, Svelte and Angular in Phase 5.
- The CLI is wired through `node packages/cli/dist/bin.cjs ...` — there's no global `rozie` command yet. `pnpm link --global` from `packages/cli/` after a build would give you one.

## Where to go next

- [`README.md`](../README.md) — project pitch + package status
- [`CLAUDE.md`](../CLAUDE.md) — full tech-stack rationale and decision log
- [`.planning/ROADMAP.md`](../.planning/ROADMAP.md) — phase breakdown and what's coming
- [`packages/targets/vue/README.md`](../packages/targets/vue/README.md) — Vue emitter API if you want to call `emitVue()` directly
