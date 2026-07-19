# Lexical — the cross-framework rich-text editor

`LexicalEditor` is Rozie's port of [Lexical](https://lexical.dev/) — Meta's extensible, framework-agnostic rich-text editor. One `.rozie` source ships idiomatic **React, Vue, Svelte, Angular, Solid, and Lit** consumers from a single wrapper. Lexical's own binding ecosystem is the thinnest of any major editor: **Angular and Lit have no maintained wrapper at all**, Vue and Solid are stale (pinned many minors behind core), and Svelte's is bus-factor-1. Rozie collapses all six targets into one source. See the [Lexical libraries comparison](/components/lexical-comparison) for the full matrix, and the [roadmap](#roadmap-staging) for what still lands in v1.1 (Markdown-shortcuts + Tables).

This page is the **show-and-tell**: the compositional API (the `<LexicalEditor>` shell + plugin children + the selection-reading `<Toolbar>`), the four core plugins, the `$inject` contract for custom children, the props, and the deliberately-unstyled posture. For a custom node, see the [decorator authoring recipe](/components/lexical-recipe-decorator); for the dense prop table see the [API reference](/components/lexical-api).

The full source for `LexicalEditor.rozie` lives in the [`@rozie-ui/lexical` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/src/LexicalEditor.rozie).

## The `@rozie-ui/lexical` packages

`LexicalEditor` ships as six pre-compiled, per-framework packages generated from a single set of `.rozie` sources via the package's `codegen.mjs`. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/lexical-react` | `npm i @rozie-ui/lexical-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/react/README.md) |
| `@rozie-ui/lexical-vue` | `npm i @rozie-ui/lexical-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/vue/README.md) |
| `@rozie-ui/lexical-svelte` | `npm i @rozie-ui/lexical-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/svelte/README.md) |
| `@rozie-ui/lexical-angular` | `npm i @rozie-ui/lexical-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/angular/README.md) |
| `@rozie-ui/lexical-solid` | `npm i @rozie-ui/lexical-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/solid/README.md) |
| `@rozie-ui/lexical-lit` | `npm i @rozie-ui/lexical-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/packages/lit/README.md) |

**Lit ships today** as the 6th target — a Lit web component that hosts the editor in an **open shadow root**. It carries the one parity caveat the other five don't: a **browser-version floor of Chrome 137+ / Firefox 142+ / Safari 17+** (Lexical resolves selection across the shadow boundary via `getComposedRanges`, which those versions gate). See the [decorator recipe's Lit section](/components/lexical-recipe-decorator#lit-the-open-shadow-root-target) for the shadow-DOM obligations, and the [roadmap](#roadmap-staging) for what remains in v1.1.

Each package carries the Lexical engine peers — `lexical` plus `@lexical/rich-text`, `@lexical/history`, `@lexical/list`, `@lexical/link`, and `@lexical/utils` (all pinned in `^0.48.0` lockstep) — alongside its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or — for the Lit target — `lit` plus `@lit/context` and `@lit-labs/preact-signals`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/lexical-react lexical @lexical/rich-text @lexical/history @lexical/list @lexical/link @lexical/utils
```

## Composition — a shell plus plugin children

Unlike a batteries-everything editor, `@rozie-ui/lexical` mirrors Lexical's own **compositional** model. `<LexicalEditor>` is the shell: it creates the editor, binds it to a contenteditable host, registers the RichText baseline, wires the `@mention` decorator bridge, and **shares the live editor instance** with any children nested inside it. Plugins and the toolbar are *separate components* you compose in as children — each one `$inject`s the shared editor and drives it imperatively.

**Vue:**

```vue
<script setup lang="ts">
import LexicalEditor, {
  Toolbar,
  HistoryPlugin,
  ListPlugin,
  LinkPlugin,
} from '@rozie-ui/lexical-vue';
</script>

<template>
  <LexicalEditor aria-label="Post body">
    <Toolbar />
    <HistoryPlugin />
    <ListPlugin />
    <LinkPlugin />
  </LexicalEditor>
</template>
```

**React:**

```tsx
import {
  LexicalEditor,
  Toolbar,
  HistoryPlugin,
  ListPlugin,
  LinkPlugin,
} from '@rozie-ui/lexical-react';

export function Editor() {
  return (
    <LexicalEditor ariaLabel="Post body">
      <Toolbar />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
    </LexicalEditor>
  );
}
```

The RichText baseline (typing, formatting commands, paste handling) is registered by the shell itself, so a bare `<LexicalEditor />` is already an editable surface. Add plugins to opt into more behavior, and add `<Toolbar />` for the selection-reading formatting controls. On every target, a child that mounts inside the shell reads the **same editor identity** — there is no prop-drilling of the editor handle.

### The `$inject('rozie-lexical-editor')` contract for custom children {#inject-contract}

Every built-in plugin and the toolbar work by `$inject`-ing a shared context token the shell `$provide`s. That token is the public extension seam: **any custom child you author can join the same editor** by injecting it. The shell provides a late-bound getter object so the identity is stable at init while the live editor late-binds once the shell's mount hook runs:

```js
// Inside a custom plugin .rozie authored against @rozie-ui/lexical:
const editorCtx = $inject('rozie-lexical-editor')

$onMount(() => {
  // Defer one microtask so the parent shell's $onMount (which creates the editor)
  // has run — on React/Vue/Solid a child's mount hook fires BEFORE its parent's.
  let teardown = null
  let disposed = false
  queueMicrotask(() => {
    if (disposed) return
    const editor = editorCtx.instance   // ← the live Lexical editor, or null before mount
    if (!editor) return
    teardown = editor.registerUpdateListener(({ editorState }) => {
      /* … your behavior … */
    })
  })
  return () => {
    disposed = true
    teardown?.()
  }
})
```

The read is always `editorCtx.instance` — the getter key is `instance` (not `editor`), and it returns the live editor or `null` before the shell has mounted / after it tears down. This is the exact contract the RichText / History / List / Link plugins and the toolbar use.

## Plugins

`@rozie-ui/lexical` v1.0 ships **four core plugins**, each a behavior-only child component that registers against the shared editor in its mount hook and tears the registration down on unmount. Together they exercise all three of Lexical's extension mechanisms — command, listener, and node-transform:

| Plugin | Mechanism | What it registers |
| --- | --- | --- |
| `RichTextPlugin` | baseline | The rich-text baseline (`registerRichText`) — the explicit compositional counterpart to the shell's own baseline (idempotent; redundant when nested, provided for bare-editor composition). |
| `HistoryPlugin` | **listener** | Undo / redo via `registerHistory` with a `delay` prop (default `300`ms) controlling the undo-coalescing window. |
| `ListPlugin` | **node-transform** | Bulleted / numbered list normalization + insert/remove list commands (`registerList`). |
| `LinkPlugin` | **command** | Link toggling over `TOGGLE_LINK_COMMAND` (`null` = unlink / a URL string = link). |

Markdown-shortcuts and Tables are **v1.1** — see the [roadmap](#roadmap-staging).

## The selection-reading toolbar

`<Toolbar />` is a **bidirectional** formatting toolbar (bold / italic / link / list). Its buttons `dispatchCommand(...)` against the shared editor **and** reflect the current selection state — each button lights up when the caret sits inside matching formatting, driven by `registerUpdateListener`. Every button carries a `mousedown`-preventDefault so pressing it never collapses the caret selection.

The toolbar is a **separate component** (never inlined into the shell) so you can omit it, restyle it, or replace it wholesale with your own controls wired through the same `$inject` contract. Its list / link buttons only take effect when the corresponding `<ListPlugin />` / `<LinkPlugin />` is also nested (the toolbar dispatches; the plugin owns the mutation) — so the showcase composition nests the full plugin set alongside it.

## The `@mention` decorator node

The family ships **one reference `DecoratorNode`** — an inline `@mention` chip — proving the neutral-descriptor **decorator bridge** end-to-end across all six targets. A `DecoratorNode.decorate()` returns a framework-neutral `{ component, props }` descriptor, and a small per-target **mount bridge** renders it with the framework's native render primitive (React `createPortal`, Vue `Teleport`, Solid `render`, Angular `createComponent`, Lit `render(html\`…\`)`). This is the extensibility story for rendering framework components as custom editor nodes; the full walkthrough — including how to author your own decorator node — is the [decorator authoring recipe](/components/lexical-recipe-decorator).

## API

### Props

The full prop surface of `<LexicalEditor>` (also rendered — auto-generated and drift-checked from the `.rozie` IR — on the [API reference page](/components/lexical-api)):

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `Array` | `[]` | Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed **after** the built-in RichText / List / Link + `@mention` `MentionNode` set (composed last so they win). |
| `namespace` | `String` | `""` | The Lexical editor `namespace` (scopes clipboard / collaboration). Falls back to `rozie-lexical` when left empty. |
| `ariaLabel` | `String` | `null` | Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region. |
| `theme` | `Object` | `{}` | Lexical `theme` object mapping node / format types to CSS class names. The styling hook for this deliberately-unstyled primitive — bring your own design-system classes. |

## The namespace-import authoring convention {#namespace-import-convention}

::: warning Authoring rule — this affects you only if you author your own `.rozie` plugins
All Lexical `$`-prefixed API **must** be imported in the **namespace form**:

```js
import * as lexical from 'lexical'
// then call it as a PROPERTY access:
const selection = lexical.$getSelection()
const root = lexical.$getRoot()
```

**Never** import the `$`-functions by name:

```js
// ✗ BREAKS the Svelte compiler with `dollar_prefix_invalid`
import { $getSelection, $getRoot } from 'lexical'
```
:::

**Why.** Svelte reserves the `$` prefix for its own runes/stores, so a named import beginning with `$` (`import { $getSelection }`) is a hard Svelte compile error (`dollar_prefix_invalid`). Routing every `$`-call through a namespace makes it an ordinary **property access** (`lexical.$getSelection()`), which Svelte does not reserve — the one form that compiles cleanly across all targets. Rozie passes both forms through verbatim; this is a Svelte-platform constraint, not a Rozie one, and it is enforced across every `.rozie` in the family. (Ordinary non-`$` named imports — `registerRichText`, `HeadingNode`, `mergeRegister` — are unaffected and imported normally.)

Consumers of the pre-compiled packages never see this — it only matters if you author your own plugin `.rozie` against the family.

## Scope & posture {#scope-posture}

`@rozie-ui/lexical` is a **deliberately-unstyled primitive**. The editor shell, the four plugins, the decorator bridge, and the selection-reading toolbar are the product; visual design is yours:

- **Unopinionated toolbar.** The toolbar ships minimal, design-system-agnostic styling — restyle it, or replace it with your own controls via the `$inject` contract. The link button links to a fixed sample href (no prompt UI) so the primitive stays dependency-free and SSR/test-safe; wire your own URL UX against `LinkPlugin`'s `TOGGLE_LINK_COMMAND`.
- **`theme` is the styling hook.** Pass a Lexical `theme` object mapping node / format types to your own CSS classes.
- **No collaboration.** There is no `@lexical/yjs` / collaboration path in scope.
- **No SSR/hydration path.** The editor instantiates inside the mount hook only (no top-level DOM), so it is import-safe under SSR, but there is no server-rendered-document hydration story.

## Roadmap / staging {#roadmap-staging}

`@rozie-ui/lexical` now ships **all six targets**. The editor above plus the Lit web component are shipping today; a focused, smaller set of items remains explicitly deferred to **v1.1** so nothing here is a surprise gap:

| Item | Stage | Notes |
| --- | --- | --- |
| React / Vue / Svelte / Angular / Solid targets | **Shipping** | Today. |
| **Lit target + Lit decorator bridge** | **Shipping** | Graduated from v1.1 staging. Hosts the editor in an **open shadow root**; carries the one parity caveat — a **browser-version floor: Chrome 137+ / Firefox 142+ / Safari 17+** (Lexical resolves cross-shadow selection via `getComposedRanges`). See the [decorator recipe's Lit section](/components/lexical-recipe-decorator#lit-the-open-shadow-root-target). |
| Editor shell + RichText / History / List / Link plugins | **Shipping** | Today. |
| Selection-reading toolbar | **Shipping** | Today. |
| `@mention` decorator node + 6 per-target bridges | **Shipping** | Today (incl. the Lit bridge). |
| **Markdown-shortcuts plugin** | **v1.1** | Deferred. |
| **Tables plugin** | **v1.1** | Deferred. |

Lit carries a browser floor and open-shadow-DOM obligations the other five don't (theme CSS injected per shadow root, `getComposedRanges` selection, the Chrome 137+/FF 142+/Safari 17+ floor); the full obligation list is in the [decorator recipe's Lit section](/components/lexical-recipe-decorator#lit-the-open-shadow-root-target).

## Cross-references

- [`LexicalEditor.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/src/LexicalEditor.rozie) — the canonical shell.
- [Lexical — API reference](/components/lexical-api) — the auto-generated, drift-checked prop table.
- [Lexical libraries comparison](/components/lexical-comparison) — the per-framework wrapper matrix + the market gap.
- [Lexical — live demo](/components/lexical-demo) — the toolbar + editor running live on this page.
- [Decorator node authoring recipe](/components/lexical-recipe-decorator) — write a custom node + its per-target mount bridge (incl. the Lit open-shadow-root bridge + its browser floor).
- [`$provide` / `$inject` — cross-component context](/guide/features)
