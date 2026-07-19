# @rozie-ui/lexical-vue

Idiomatic **vue** `LexicalEditor` — Cross-framework rich-text editor wrapping Meta’s Lexical — one Rozie source, idiomatic React / Vue / Svelte / Angular / Solid packages. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

This package ships `LexicalEditor` (the default export) alongside `HistoryPlugin`, `LinkPlugin`, `ListPlugin`, `RichTextPlugin`, `Toolbar` (named exports).

## Install

```bash
npm i @rozie-ui/lexical-vue
```

Peer dependencies: `lexical` + `vue`.

All Lexical `$`-API is authored in the **namespace-import form** (`import * as lexical from 'lexical'; lexical.$getRoot()`) — the one cross-target-safe convention (named `$`-imports break the Svelte compiler).

## LexicalEditor

### Usage

```vue
<script setup lang="ts">
import LexicalEditor from '@rozie-ui/lexical-vue';
</script>

<template>
  <LexicalEditor aria-label="Post body" />
</template>
```

### Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `nodes` | `Array` | `[]` |  |  | Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed after the built-in RichText/List/Link + `@mention` `MentionNode` set (the reference DecoratorNode is registered by the shell itself; these consumer nodes are composed last so they win). |
| `namespace` | `String` | `""` |  |  | The Lexical editor `namespace` (scopes clipboard/collaboration). Falls back to `rozie-lexical` when left empty. |
| `ariaLabel` | `String` | `null` |  |  | Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region. |
| `theme` | `Object` | `{}` |  |  | Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes. |

### Slots

| Slot | Params |
| --- | --- |
| (default) |  |

## HistoryPlugin

### Usage

See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.

### Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `delay` | `Number` | `300` |  |  | Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately. |

## LinkPlugin

### Usage

See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.

## ListPlugin

### Usage

See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.

## RichTextPlugin

### Usage

See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.

## Toolbar

### Usage

See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.
