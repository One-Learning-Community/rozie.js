# CodeMirror — the cross-framework code editor

`CodeMirror` is Rozie's data-bound port of [CodeMirror 6](https://codemirror.net/) — the de-facto modular code editor for the web. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. Every framework today carries its own hand-maintained CodeMirror binding ([react-codemirror](https://www.npmjs.com/package/@uiw/react-codemirror), [vue-codemirror](https://www.npmjs.com/package/vue-codemirror), [svelte-codemirror](https://www.npmjs.com/package/svelte-codemirror-editor), [ngx-codemirror](https://www.npmjs.com/package/@ctrl/ngx-codemirror)) — each shuttles a `value` through the `EditorView`/`EditorState` API and forwards changes back out. Rozie collapses all of them (plus the Solid and Lit wrappers that **do not exist upstream**) into one source.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the imperative handle, the consumer-extensible `:extensions` passthrough, and the per-target recipe for the one `panel` portal slot.

The full source for `CodeMirror.rozie` lives in the [`@rozie-ui/codemirror` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/src/CodeMirror.rozie).

## The `@rozie-ui/codemirror` packages

`CodeMirror` ships as six pre-compiled, per-framework packages generated from a single `CodeMirror.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/codemirror-react` | `npm i @rozie-ui/codemirror-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/react/README.md) |
| `@rozie-ui/codemirror-vue` | `npm i @rozie-ui/codemirror-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/vue/README.md) |
| `@rozie-ui/codemirror-svelte` | `npm i @rozie-ui/codemirror-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/svelte/README.md) |
| `@rozie-ui/codemirror-angular` | `npm i @rozie-ui/codemirror-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/angular/README.md) |
| `@rozie-ui/codemirror-solid` | `npm i @rozie-ui/codemirror-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/solid/README.md) |
| `@rozie-ui/codemirror-lit` | `npm i @rozie-ui/codemirror-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/packages/lit/README.md) |

Each package carries the **five `@codemirror/*` engine peers** — `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, and `@codemirror/theme-one-dark` (all `^6`) — plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/codemirror-react \
  @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/lang-javascript @codemirror/theme-one-dark
```

CodeMirror 6 has **no large "options bag"** — everything is an `Extension`. Anything the curated prop surface doesn't special-case (other languages, custom themes, line-wrapping, autocomplete, linting, key-bindings) comes through the first-class `:extensions` passthrough, which the wrapper composes **last** so consumer extensions win CodeMirror's last-registered-wins facets. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `CodeMirror.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The two-way value is `value` — the editor's document text as a **string**. Typing in the editor writes the new text back through the two-way path (CodeMirror's `updateListener` extension), and a consumer write reflects into the live document. There are **no events** — the two-way `value` binding *is* the change channel (see [Why there is no `@change` event](#why-there-is-no-change-event)).

### React

```tsx
import { useState } from 'react';
import { CodeMirror } from '@rozie-ui/codemirror-react';
import { lineWrapping } from '@codemirror/view';

export function Demo() {
  const [value, setValue] = useState('const greeting = "hello";\n');
  return (
    <CodeMirror
      value={value}
      onValueChange={setValue}
      language="javascript"
      theme="dark"
      placeholder="Type some code…"
      extensions={[lineWrapping]}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';
import { lineWrapping } from '@codemirror/view';

const value = ref('const greeting = "hello";\n');
const extensions = [lineWrapping];
</script>

<template>
  <CodeMirror
    v-model:value="value"
    language="javascript"
    theme="dark"
    placeholder="Type some code…"
    :extensions="extensions"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import CodeMirror from '@rozie-ui/codemirror-svelte';
  import { lineWrapping } from '@codemirror/view';

  let value = $state('const greeting = "hello";\n');
</script>

<CodeMirror
  bind:value
  language="javascript"
  theme="dark"
  placeholder="Type some code…"
  extensions={[lineWrapping]}
/>
```

### Angular

```ts
import { Component } from '@angular/core';
import { CodeMirror } from '@rozie-ui/codemirror-angular';
import { lineWrapping } from '@codemirror/view';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CodeMirror],
  template: `
    <CodeMirror
      [(value)]="value"
      language="javascript"
      theme="dark"
      placeholder="Type some code…"
      [extensions]="extensions"
    />
  `,
})
export class DemoComponent {
  value = 'const greeting = "hello";\n';
  extensions = [lineWrapping];
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { CodeMirror } from '@rozie-ui/codemirror-solid';
import { lineWrapping } from '@codemirror/view';

export function Demo() {
  const [value, setValue] = createSignal('const greeting = "hello";\n');
  return (
    <CodeMirror
      value={value()}
      onValueChange={setValue}
      language="javascript"
      theme="dark"
      placeholder="Type some code…"
      extensions={[lineWrapping]}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/codemirror-lit';
import { lineWrapping } from '@codemirror/view';

// <rozie-code-mirror> is a custom element. Bind `value` as a property and
// listen for the `value-change` event (the two-way change channel).
const el = document.querySelector('rozie-code-mirror');
el.value = 'const greeting = "hello";\n';
el.language = 'javascript';
el.theme = 'dark';
el.placeholder = 'Type some code…';
el.extensions = [lineWrapping];
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
```

## API

### Props

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `value` | `String` | `""` | ✓ | The two-way document text. Typing in the editor writes back through the model path; a consumer write reflects into the live document (echo-guarded so a programmatic set doesn't ping-pong). This is the **only** change channel — there are no events. |
| `language` | `String` | `"javascript"` | | Convenience language. `"javascript"` loads the bundled `@codemirror/lang-javascript`; any other value falls back to plain text (no syntax highlighting, no throw). Add other languages through `:extensions`. Runtime-updatable via a `langCompartment` reconfigure — switching the prop re-highlights without a remount. |
| `theme` | `String` | `"light"` | | `"light"` (the editor default) or `"dark"` (the bundled `@codemirror/theme-one-dark`). Runtime-updatable via a `themeCompartment` reconfigure. Custom themes come through `:extensions`. |
| `readOnly` | `Boolean` | `false` | | Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure. |
| `height` | `Number` | `240` | | Editor height in pixels (applied to the wrapper's host box). |
| `placeholder` | `String` | `""` | | Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). Empty string ⇒ no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure. |
| `extensions` | `Array` | `[]` | | Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets (theme/keymap/language overrides). The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props don't special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes). |

There is **no Emits section.** CodeMirror's `updateListener` → two-way `value` path is the only change channel (consumers bind `r-model:value`). See [Why there is no `@change` event](#why-there-is-no-change-event).

### Imperative handle

Beyond props, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getView` | Return the underlying CodeMirror `EditorView` for direct API access (the raw-engine escape hatch). `null` before mount and after destroy. |
| `focus` | Focus the editor. |
| `getValue` | Return the current document text as a string. |
| `replaceValue` | Replace the document text — `replaceValue(text)`. Routes through the **same** suppress-echo guard as the `value` prop watcher, so a programmatic replace doesn't ping-pong back through the model path. |
| `dispatch` | Dispatch a raw CodeMirror transaction — `dispatch(tr)`. |
| `insertText` | Insert text at the current main selection — `insertText(text)`. |
| `getSelection` | Return the main selection range (`{ anchor, head, from, to }`) or `null` before mount. |
| `setSelection` | Set the selection — `setSelection(posNumber | { anchor, head })`. |

::: tip The verb is `replaceValue`, not `setValue`
The "set the document text" verb is named `replaceValue` rather than `setValue`. A `value` model prop makes the React target auto-generate a `setValue` state setter, so a `setValue` handle verb is a hard collision (ROZ524) on React. `replaceValue` preserves the value-setter semantics collision-free across all six targets.
:::

**React example:**

```tsx
import { useRef } from 'react';
import { CodeMirror, type CodeMirrorHandle } from '@rozie-ui/codemirror-react';

const cm = useRef<CodeMirrorHandle>(null);
// <CodeMirror ref={cm} ... />
cm.current?.focus();
const text = cm.current?.getValue();
cm.current?.insertText('// inserted at the cursor\n');
```

The eight handle method names are clear of all seven prop names (and there are no events), so the `$expose` collision discipline (ROZ121) passes with no renames beyond the React-specific `replaceValue` adjustment above.

## Slots

The wrapper surfaces **one** portal slot — `panel` — mounted through CodeMirror 6's [`showPanel`](https://codemirror.net/docs/ref/#view.showPanel) facet (a panel extension whose DOM element is the portal host). It is the status-bar idiom: a strip mounted at the **bottom** of the editor (`top: false`). The slot is **guarded** — fill it and your fragment renders in the panel; leave it unfilled and the editor shows no panel. The slot receives one scope param, `view` — the live `EditorView`.

| Slot | Mounts via | Renders | Scope param |
| --- | --- | --- | --- |
| `panel` | CodeMirror's `showPanel` facet (bottom) | A status-bar / toolbar strip beneath the editor | `view` |

Portal slots unlock the "foreign-engine cell rendering" pattern: CodeMirror owns the panel `<div>`, but the consumer's framework-native fragment is mounted inside it (on the panel's `mount()`) and disposed when the panel is torn down (`destroy()`). See [the portal-slot primitive](/examples/portal-list) for the underlying mechanism. Each target fills `#panel` through its native imperative-render API:

**React** (render prop):

```tsx
<CodeMirror
  value={value}
  onValueChange={setValue}
  renderPanel={({ view }) => (
    <span className="cm-status">Lines: {view.state.doc.lines}</span>
  )}
/>
```

**Solid** (render prop):

```tsx
<CodeMirror
  value={value()}
  onValueChange={setValue}
  panel={({ view }) => (
    <span class="cm-status">Lines: {view.state.doc.lines}</span>
  )}
/>
```

**Vue** (scoped slot):

```vue
<CodeMirror v-model:value="value">
  <template #panel="{ view }">
    <span class="cm-status">Lines: {{ view.state.doc.lines }}</span>
  </template>
</CodeMirror>
```

**Svelte** (snippet):

```svelte
<CodeMirror bind:value>
  {#snippet panel({ view })}
    <span class="cm-status">Lines: {view.state.doc.lines}</span>
  {/snippet}
</CodeMirror>
```

**Angular** (content child `<ng-template>`):

```html
<CodeMirror [(value)]="value">
  <ng-template #panel let-view="view">
    <span class="cm-status">Lines: {{ view.state.doc.lines }}</span>
  </ng-template>
</CodeMirror>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-code-mirror');
el.panel = ({ view }) => html`<span class="cm-status">Lines: ${view.state.doc.lines}</span>`;
```

On every target the wrapper's `$portals.panel(node, { view })` closure mounts the consumer's fragment into the engine-owned panel container and returns a dispose handle the engine calls on panel teardown.

## Recipes

### Switching languages at runtime

`language` is a convenience prop wired to a dedicated `langCompartment`. Changing it dispatches a `langCompartment.reconfigure(...)` — the syntax highlighting swaps **without remounting** the editor, so cursor, history, and scroll position are preserved. The bundled language is JavaScript; any other value falls back to plain text (no throw):

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';

const value = ref('const x = 1;');
const language = ref('javascript');
</script>

<template>
  <button @click="language = 'plain'">Plain text</button>
  <CodeMirror v-model:value="value" :language="language" />
</template>
```

### Adding other languages and themes via `:extensions`

The bundled set is intentionally thin (one language, one dark theme). Everything else comes through the `:extensions` passthrough — import the CodeMirror extension you want and pass it in. Because the wrapper composes consumer extensions **last**, they win CodeMirror's last-registered-wins facets, so a passed-in language or theme overrides the bundled ones:

```bash
npm i @codemirror/lang-python @codemirror/theme-solarized
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';
import { python } from '@codemirror/lang-python';
import { solarizedLight } from '@codemirror/theme-solarized';

const value = ref('def greet():\n    return "hello"\n');
const extensions = [python(), solarizedLight];
</script>

<template>
  <CodeMirror v-model:value="value" :extensions="extensions" />
</template>
```

### Reconfiguring `:extensions` at runtime

The `extensions` array is wrapped in its own `extensionsCompartment`, so swapping the bound array reconfigures the live editor **without a remount** (same machinery as the bundled theme/readOnly/language/placeholder compartments). Bind a reactive array and replace it:

```vue
<CodeMirror v-model:value="value" :extensions="extensions" />
<!-- extensions.value = [...baseExts, lintExt] — reconfigures in place -->
```

### Driving the editor from the handle

The eight `$expose` verbs cover the imperative surface props alone can't express. Grab the handle and call `focus()` / `getValue()` / `replaceValue()` / `insertText()` / `getSelection()` / `setSelection()`, or reach the raw engine via `getView()`:

```tsx
const cm = useRef<CodeMirrorHandle>(null);
// <CodeMirror ref={cm} ... />
<button onClick={() => cm.current?.focus()}>Focus</button>
<button onClick={() => cm.current?.insertText('TODO\n')}>Insert TODO</button>
<button onClick={() => console.log(cm.current?.getValue())}>Log value</button>
```

### Adding a status bar with the `panel` slot

Fill the `panel` slot to mount a status strip at the bottom of the editor — a line/column counter, a dirty indicator, a language picker. The slot's `view` scope param is the live `EditorView`, so the panel can read editor state directly (see [Slots](#slots) for the per-target shapes).

## Gotchas

### Why there is no `@change` event

The wrapper deliberately emits **no events** in v1. CodeMirror's `updateListener` extension pushes every document change straight into the two-way `value` model path, so the `r-model:value` binding *is* the change channel — a separate `@change` event would be a redundant emit racing the model path (and a fresh source of echo loops). Consumers observe edits by binding `value`; if you need lower-level change information, reach for the raw `EditorView` via the `getView()` handle and attach your own `updateListener` through `:extensions`.

### The echo-guard keeps two-way binding from ping-ponging

A model two-way binding can ping-pong: the consumer's state signals back into the wrapper's `value` watcher faster than the wrapper's own emit clears. The wrapper solves this once with a `suppressEmit` guard plus a `current === next` short-circuit, shared by both the `value` watcher **and** the `replaceValue` handle verb. A programmatic or prop-driven set never mints a duplicate undo-history entry or echoes back through the model path.

### Consumer `:extensions` run by design

`:extensions` is an arbitrary `Extension[]` that the wrapper composes into the live `EditorState`. Those extensions execute inside the editor by design — that is the entire point of the passthrough (CodeMirror 6 *is* an extension array). Pass only extensions you trust, exactly as you would when building a CodeMirror editor by hand.

### The `panel` slot is the only injection surface in v1

CodeMirror 6 has many extension-mounted injection points (tooltips, gutter markers, line/widget/replace decorations). v1 ships exactly one portal slot — `panel` — proving the `showPanel`-mounted injection pattern. Broader injection surfaces are a future parity expansion; until then, reach them through a custom extension passed via `:extensions`.

## Cross-references

- [`CodeMirror.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/src/CodeMirror.rozie) — the canonical wrapper.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
