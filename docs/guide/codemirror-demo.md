---
title: CodeMirror — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';
import { json as jsonLang, python as pythonLang } from '@rozie-ui/codemirror-vue/languages';

// An in-memory starter document — network-free, so the demo works offline and in
// CI. Typing in the editor writes straight back through the two-way `value` model.
const JS_SAMPLE = `// Edit me — this is the real @rozie-ui/codemirror-vue package.
function greet(name) {
  return \`hello, \${name}!\`;
}

const answer = 42;
greet("Rozie");
`;

const cm = ref();
const code = ref(JS_SAMPLE);

const language = ref<'javascript' | 'json' | 'python'>('javascript');
const theme = ref<'light' | 'dark'>('light');

// For JSON / Python the bundled `language` prop falls back to plain text, so we
// feed the matching preset through `:extensions` (the curated `/languages`
// subpath). JavaScript is the one bundled language and needs no extension.
const extensions = computed(() => {
  if (language.value === 'json') return jsonLang;
  if (language.value === 'python') return pythonLang;
  return [];
});

const out = ref('');
const grabValue = () => { out.value = cm.value?.getValue() ?? ''; };

const lineCount = computed(() => code.value.split('\n').length);
const charCount = computed(() => code.value.length);
</script>

# CodeMirror — live demo

This is the **real `@rozie-ui/codemirror-vue` package** running on this page (VitePress is itself a Vue app). Type in the editor below, toggle the language and theme, then **Get value** to read the live document straight off the imperative handle. Everything here is driven by the same `CodeMirror.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="cm-live">
  <div class="cm-live__controls">
    <button :class="{ 'cm-live__active': language === 'javascript' }" @click="language = 'javascript'">JavaScript</button>
    <button :class="{ 'cm-live__active': language === 'json' }" @click="language = 'json'">JSON</button>
    <button :class="{ 'cm-live__active': language === 'python' }" @click="language = 'python'">Python</button>
    <span class="cm-live__sep" />
    <button :class="{ 'cm-live__active': theme === 'light' }" @click="theme = 'light'">Light</button>
    <button :class="{ 'cm-live__active': theme === 'dark' }" @click="theme = 'dark'">Dark</button>
    <span class="cm-live__sep" />
    <button @click="cm?.focus()">Focus</button>
    <button @click="cm?.insertText('// TODO\n')">Insert TODO</button>
    <button class="cm-live__primary" @click="grabValue">Get value ▸</button>
  </div>

  <div class="cm-live__stage">
    <CodeMirror
      ref="cm"
      v-model:value="code"
      :language="language"
      :theme="theme"
      :extensions="extensions"
      placeholder="Type some code…"
      :height="320"
    />
  </div>

  <div class="cm-live__readout">
    <code>{{ lineCount }} lines · {{ charCount }} chars · {{ language }} · {{ theme }}</code>
  </div>

  <div v-if="out" class="cm-live__output">
    <strong>Handle <code>getValue()</code></strong>
    <pre>{{ out }}</pre>
  </div>
</div>
</ClientOnly>

The document is two-way bound with `v-model:value` — the readout above updates live as you type, the language/theme toggles reconfigure the live editor **without a remount** (cursor, history, and scroll position are preserved), and the buttons drive the imperative handle (`focus`, `insertText`, `getValue`). The JSON/Python toggles feed the curated `@rozie-ui/codemirror-vue/languages` presets through `:extensions`, since the bundled `language` prop ships JavaScript only. See the [full API](/guide/codemirror) for the complete prop/handle/slot surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/codemirror/src/CodeMirror.rozie{html}[CodeMirror.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/codemirror-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/codemirror/packages/react/src/CodeMirror.tsx[React]
<<< ../../packages/ui/codemirror/packages/vue/src/CodeMirror.vue[Vue]
<<< ../../packages/ui/codemirror/packages/svelte/src/CodeMirror.svelte[Svelte]
<<< ../../packages/ui/codemirror/packages/angular/src/CodeMirror.ts[Angular]
<<< ../../packages/ui/codemirror/packages/solid/src/CodeMirror.tsx[Solid]
<<< ../../packages/ui/codemirror/packages/lit/src/CodeMirror.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same two-way `value`, same eight-verb imperative handle, same five portal slots, all from the one source above.

## See also

- [CodeMirror — showcase & API](/guide/codemirror) — install, quick starts for all six frameworks, the `:extensions` passthrough, the language presets, and the full prop/handle/slot reference.
- [CodeMirror libraries comparison](/guide/codemirror-comparison) — how `@rozie-ui/codemirror` stacks up against the per-framework wrappers (including the Angular binding still on CodeMirror 5).

<style scoped>
.cm-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.cm-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.cm-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.cm-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.cm-live__controls button.cm-live__active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.cm-live__controls button.cm-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.cm-live__controls button.cm-live__primary:hover {
  color: #fff;
}
.cm-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.cm-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.cm-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.cm-live__output {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
}
.cm-live__output pre {
  margin-top: 0.5rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.78rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  overflow: auto;
}
</style>
