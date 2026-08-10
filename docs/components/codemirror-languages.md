# Language presets

The curated language-preset catalog for [`<CodeMirror>`](/components/codemirror), shipped by every leaf package under the `/languages` subpath.

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

## See also

- [CodeMirror showcase & API](/components/codemirror): the `language` prop, the `:extensions` passthrough, the imperative handle, and the portal slots.
- [CodeMirror libraries comparison](/components/codemirror-comparison): the per-framework wrapper matrix.
