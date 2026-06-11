# CodeMirror — the cross-framework code editor

`CodeMirror` is Rozie's data-bound port of [CodeMirror 6](https://codemirror.net/) — the de-facto modular code editor for the web. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. Every framework today carries its own hand-maintained CodeMirror binding ([react-codemirror](https://www.npmjs.com/package/@uiw/react-codemirror), [vue-codemirror](https://www.npmjs.com/package/vue-codemirror), [svelte-codemirror](https://www.npmjs.com/package/svelte-codemirror-editor), [ngx-codemirror](https://www.npmjs.com/package/@ctrl/ngx-codemirror)) — each shuttles a `value` through the `EditorView`/`EditorState` API and forwards changes back out. Rozie collapses all of them (plus the Solid and Lit wrappers that **do not exist upstream**) into one source. See the [CodeMirror libraries comparison](/components/codemirror-comparison) for the full per-framework matrix — including the Angular wrapper that's still on CodeMirror 5.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the imperative handle, the consumer-extensible `:extensions` passthrough, and the per-target recipe for the five `panel` / `topPanel` / `tooltip` / `gutter` / `decoration` portal slots.

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

Each package carries the **five `@codemirror/*` engine peers** — `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-javascript`, and `@codemirror/theme-one-dark` — plus the **`codemirror` meta-package** (it supplies the `basicSetup` bundle; all `^6`) — plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/codemirror-react \
  @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/lang-javascript @codemirror/theme-one-dark codemirror
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
| `theme` | `String \| unknown` | `"light"` | | The built-in strings `"light"` (the editor default) or `"dark"` (the bundled `@codemirror/theme-one-dark`) **or** a CodeMirror `Extension` / `Extension[]` passed straight through (G3) — drop in `@uiw/codemirror-themes`, a `EditorView.theme({…})`, or any theme extension. A non-string `theme` is composed via the `themeCompartment`, so it reconfigures live with no remount, same as the strings. Custom themes also still work through `:extensions` (composed last). |
| `readOnly` | `Boolean` | `false` | | Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure. |
| `height` | `Number` | `240` | | Editor height in pixels (applied to the wrapper's host box). |
| `placeholder` | `String` | `""` | | Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). Empty string ⇒ no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure. |
| `extensions` | `Array` | `[]` | | Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets (theme/keymap/language overrides). The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props don't special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes). |
| `basicSetup` | `Boolean` | `false` | | When `true`, swap the thin manual baseline (line numbers + history + default/history keymaps) for CodeMirror 6's batteries-included [`basicSetup`](https://codemirror.net/docs/ref/#codemirror.basicSetup) bundle — autocomplete, search, bracket matching, code folding, lint gutter, and richer keymaps (G1). The curated `language` / `theme` / `readOnly` / `placeholder` / `extensions` props and the consumer `:extensions` still compose **after** it, so they continue to win. **Construction-time only:** `basicSetup` is read once when the editor is built (it is a large bundle, intentionally with no compartment), so **toggling it at runtime requires a re-mount** — set it as a fixed prop, don't flip it live. |
| `gutterLines` | `Array` | `[]` | | The 1-based line numbers that each get a custom gutter marker rendered by the `gutter` slot (G5). One portal handle mounts per visible marker (see [Slots](#slots)). Out-of-range lines are ignored. Runtime-updatable via a `gutterCompartment` reconfigure — changing the array re-marks the lines with no remount. Only meaningful when the `gutter` slot is filled. |
| `decorations` | `Array` | `[]` | | An array of `{ from, to? }` **0-based document offsets** that each get an inline widget rendered by the `decoration` slot (G5). A point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness. Compute an offset from a line via `view.state.doc.line(n).from`. One portal handle mounts per visible widget. Runtime-updatable via a `decorationCompartment` reconfigure. Only meaningful when the `decoration` slot is filled. |

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

The eight handle method names are clear of all ten prop names (and there are no events), so the `$expose` collision discipline (ROZ121) passes with no renames beyond the React-specific `replaceValue` adjustment above.

## Slots

The wrapper surfaces **five** portal slots — two bottom/top status panels mounted through CodeMirror 6's [`showPanel`](https://codemirror.net/docs/ref/#view.showPanel) facet, a cursor-anchored tooltip through the [`showTooltip`](https://codemirror.net/docs/ref/#view.showTooltip) facet, per-line gutter markers through a custom [`gutter()`](https://codemirror.net/docs/ref/#view.gutter), and inline widget decorations through [`Decoration.widget`](https://codemirror.net/docs/ref/#view.Decoration^widget). Each is **guarded** — fill it and your fragment renders; leave it unfilled and the surface stays absent.

| Slot | Mounts via | Renders | Scope param | Kind | Driven by |
| --- | --- | --- | --- | --- | --- |
| `panel` | CodeMirror's `showPanel` facet (`top: false`) | A status-bar / toolbar strip beneath the editor | `view` | mount-once | — |
| `topPanel` | CodeMirror's `showPanel` facet (`top: true`) | A status strip above the editor | `view` | mount-once | — |
| `tooltip` | CodeMirror's `showTooltip` facet (caret head) | A cursor-anchored tooltip | `view`, `pos` | **reactive** | — |
| `gutter` | A custom `gutter()` (`GutterMarker.toDOM`) | A per-line marker in a dedicated gutter lane | `line`, `view` | **reactive multi-instance** | `gutterLines` prop |
| `decoration` | A `Decoration.widget` set (`WidgetType.toDOM`) | An inline widget at a document position | `from`, `to`, `view` | **reactive multi-instance** | `decorations` prop |

`tooltip` is CodeMirror's first **reactive** portal slot: its fragment mounts **once** and re-renders **in place** as the caret moves (the engine-driven `{ update, dispose }` handle), rather than remounting per keystroke. Its scope carries the live `EditorView` plus `pos` (the caret head).

`gutter` and `decoration` are **reactive multi-instance** slots: the wrapper mounts **one portal handle per visible marker / widget**, so a single slot fill renders an unbounded number of live fragments — one for each line in `gutterLines` (scope: the 1-based `line` + the `view`) or each range in `decorations` (scope: the `from`/`to` offsets + the `view`). CodeMirror mounts a marker/widget's fragment when it scrolls into view and disposes it when it scrolls out, and changing the driving prop reconfigures the marked lines / decorated ranges live with no remount.

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

### Language presets

The base `CodeMirror` import bundles exactly one language (JavaScript) so the import stays lean. For everything else, each leaf ships **curated language presets** via a `/languages` subpath — ready-to-spread `Extension[]` constants you drop into `:extensions` for a robust syntax-highlighting starting point on a common use case. The base component and the `language` prop are unchanged; presets are a purely additive opt-in.

```ts
import { CodeMirror } from '@rozie-ui/codemirror-react';
import { web } from '@rozie-ui/codemirror-react/languages';
// <CodeMirror :extensions={web} />   // HTML + embedded CSS/JS
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';
import { python } from '@rozie-ui/codemirror-vue/languages';

const value = ref('def greet():\n    return "hello"\n');
</script>

<template>
  <CodeMirror v-model:value="value" :extensions="python" />
</template>
```

**Catalog** — each preset is an `Extension[]`; the right column lists the `@codemirror/lang-*` package it pulls into your bundle:

| Preset | What it highlights | Pulls |
| --- | --- | --- |
| `web` (alias `html`) | HTML with auto-embedded CSS + JavaScript | `@codemirror/lang-html` (+ `lang-css`, `lang-javascript` transitively) |
| `css` | Plain CSS | `@codemirror/lang-css` |
| `scss` | SCSS (`sass({ indented: false })`) | `@codemirror/lang-sass` |
| `sass` | Indented Sass syntax | `@codemirror/lang-sass` |
| `vue` | Vue SFC + SCSS `<style lang="scss">` | `@codemirror/lang-vue`, `@codemirror/lang-sass` |
| `javascript` | JavaScript | `@codemirror/lang-javascript` |
| `typescript` | TypeScript | `@codemirror/lang-javascript` |
| `jsx` | JavaScript + JSX | `@codemirror/lang-javascript` |
| `tsx` | TypeScript + JSX | `@codemirror/lang-javascript` |
| `json` | JSON | `@codemirror/lang-json` |
| `markdown` | Markdown | `@codemirror/lang-markdown` |
| `yaml` | YAML | `@codemirror/lang-yaml` |
| `xml` | XML | `@codemirror/lang-xml` |
| `python` | Python | `@codemirror/lang-python` |
| `sql` | SQL | `@codemirror/lang-sql` |

**Tree-shakable by design.** CodeMirror language constructors are pure (no global registration), so the presets are side-effect-free eager exports: a consumer importing only `{ web }` pulls **only** `@codemirror/lang-html` (and the CSS/JS it embeds) — `python`/`sql`/`yaml`/the rest are dropped by your bundler. The base `CodeMirror` import carries none of them.

**Raw constructors for power users.** Compose your own arrays from the raw `@codemirror/lang-*` constructors, re-exported under a `lang` namespace object:

```ts
import { lang } from '@rozie-ui/codemirror-react/languages';
const extensions = [...lang.html(), myCustomExtension];
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

Fill the `panel` slot to mount a status strip at the bottom of the editor — a line/column counter, a dirty indicator, a language picker. The slot's `view` scope param is the live `EditorView`, so the panel can read editor state directly (see [Slots](#slots) for the per-target shapes). The `topPanel` slot is the top-docked sibling (same `view` scope), and `tooltip` mounts a caret-anchored fragment that re-renders in place as the cursor moves (`view` + `pos` scope).

### Per-line gutter markers with the `gutter` slot

The `gutter` slot mounts a custom marker in a dedicated gutter lane on each line listed in the `gutterLines` prop (1-based line numbers; out-of-range lines are ignored). It is a **reactive multi-instance** slot — one portal handle mounts per visible marker — so a single fill renders a marker for every listed line, each handed its own `line` (the 1-based line number) and the live `view`. Changing `gutterLines` re-marks the lines with no remount.

**Vue** (scoped slot):

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';

const value = ref('line one\nline two\nline three\n');
const gutterLines = ref([1, 3]); // mark lines 1 and 3
</script>

<template>
  <CodeMirror v-model:value="value" :gutterLines="gutterLines">
    <template #gutter="{ line }">
      <span class="cm-breakpoint" :title="`line ${line}`">●</span>
    </template>
  </CodeMirror>
</template>
```

**React** (render prop):

```tsx
<CodeMirror
  value={value}
  onValueChange={setValue}
  gutterLines={[1, 3]}
  renderGutter={({ line }) => <span className="cm-breakpoint" title={`line ${line}`}>●</span>}
/>
```

### Inline widget decorations with the `decoration` slot

The `decoration` slot mounts an inline widget at each document position listed in the `decorations` prop — an array of `{ from, to? }` **0-based document offsets** (a point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness). Compute an offset from a line number with `view.state.doc.line(n).from`. Like `gutter`, it is **reactive multi-instance** — one portal handle per visible widget — each handed its `from` / `to` offsets and the live `view`. Changing `decorations` reconfigures the decorated ranges with no remount.

**Vue** (scoped slot):

```vue
<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';

const value = ref('const answer = 42;\n');
// A widget after `const` (offset 5) and after `answer` (offset 12).
const decorations = ref([{ from: 5 }, { from: 12 }]);
</script>

<template>
  <CodeMirror v-model:value="value" :decorations="decorations">
    <template #decoration="{ from }">
      <span class="cm-pin" :data-at="from">📌</span>
    </template>
  </CodeMirror>
</template>
```

**React** (render prop):

```tsx
<CodeMirror
  value={value}
  onValueChange={setValue}
  decorations={[{ from: 5 }, { from: 12 }]}
  renderDecoration={({ from }) => <span className="cm-pin" data-at={from}>📌</span>}
/>
```

## Gotchas

### Why there is no `@change` event

The wrapper deliberately emits **no events** in v1. CodeMirror's `updateListener` extension pushes every document change straight into the two-way `value` model path, so the `r-model:value` binding *is* the change channel — a separate `@change` event would be a redundant emit racing the model path (and a fresh source of echo loops). Consumers observe edits by binding `value`; if you need lower-level change information, reach for the raw `EditorView` via the `getView()` handle and attach your own `updateListener` through `:extensions`.

### The echo-guard keeps two-way binding from ping-ponging

A model two-way binding can ping-pong: the consumer's state signals back into the wrapper's `value` watcher faster than the wrapper's own emit clears. The wrapper solves this once with a `suppressEmit` guard plus a `current === next` short-circuit, shared by both the `value` watcher **and** the `replaceValue` handle verb. A programmatic or prop-driven set never mints a duplicate undo-history entry or echoes back through the model path.

### Consumer `:extensions` run by design

`:extensions` is an arbitrary `Extension[]` that the wrapper composes into the live `EditorState`. Those extensions execute inside the editor by design — that is the entire point of the passthrough (CodeMirror 6 *is* an extension array). Pass only extensions you trust, exactly as you would when building a CodeMirror editor by hand.

### Injection-surface coverage

CodeMirror 6 has many extension-mounted injection points. The wrapper ships five portal slots: the panels (`panel` / `topPanel`, via `showPanel`), the cursor tooltip (`tooltip`, via `showTooltip` — the first **reactive** slot), per-line gutter markers (`gutter`, via a custom `gutter()`), and inline widget decorations (`decoration`, via `Decoration.widget`). The `gutter` and `decoration` slots are **reactive multi-instance** — one portal handle per visible marker / widget. Other CM6 injection points (block widgets, replace/line decorations, atomic ranges) remain a future parity expansion; until then, reach them through a custom extension passed via `:extensions`.

## Cross-references

- [CodeMirror libraries comparison](/components/codemirror-comparison) — the per-framework wrapper matrix, the CM5-vs-CM6 Angular split, and Rozie's own gap status.
- [`CodeMirror.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/src/CodeMirror.rozie) — the canonical wrapper.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
