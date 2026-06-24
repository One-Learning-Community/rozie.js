---
title: Tags — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Tags from '@rozie-ui/tags-vue';

const skills = ref<string[]>(['rozie', 'vue', 'headless']);
const emails = ref<string[]>([]);
const lastAdded = ref<string | null>(null);

const skillsBox = ref();

function onAdd(e: { value: string; tokens: string[] }) {
  lastAdded.value = e.value;
}

// reject anything that isn't a plausible email; normalize to lower-case
function emailValidator(candidate: string) {
  return /^\S+@\S+\.\S+$/.test(candidate) ? candidate.toLowerCase() : false;
}
</script>

# Tags — live demo

This is the **real `@rozie-ui/tags-vue` package** running on this page (VitePress is itself a Vue app). Type a tag and press Enter or comma, paste a comma-separated list (it bulk-adds), backspace through an empty input to delete the last tag, or click a chip's × to remove it — then watch the two-way bound array update. Everything below is driven by the same `Tags.rozie` source that compiles to all six frameworks, built on one native `<input>` plus framework-rendered chips with **no engine and no required CSS**.

<ClientOnly>
<div class="tags-live">

  <div class="tags-live__cell">
    <div class="tags-live__head">
      <strong>Skills</strong>
      <span class="tags-live__muted">— Enter / comma to add, paste to bulk-add, max 8</span>
      <span class="tags-live__sep" />
      <button @click="skillsBox?.clear()">clear()</button>
      <button @click="skillsBox?.focus()">focus()</button>
    </div>
    <Tags
      ref="skillsBox"
      v-model:modelValue="skills"
      placeholder="Add a skill…"
      aria-label="Skills"
      :max="8"
      @add="onAdd"
    />
    <code class="tags-live__readout">value: {{ JSON.stringify(skills) }}</code>
  </div>

  <div class="tags-live__cell">
    <div class="tags-live__head"><strong>Emails</strong> <span class="tags-live__muted">— per-token validate + normalize (lower-cased)</span></div>
    <Tags
      v-model:modelValue="emails"
      placeholder="name@example.com…"
      aria-label="Emails"
      :validate="emailValidator"
    />
    <code class="tags-live__readout">value: {{ JSON.stringify(emails) }}</code>
  </div>

  <div class="tags-live__cell">
    <div class="tags-live__head"><strong>@add</strong> <span class="tags-live__muted">— fires when a Skill is committed</span></div>
    <code class="tags-live__readout">last added: {{ lastAdded === null ? '—' : JSON.stringify(lastAdded) }}</code>
  </div>

</div>
</ClientOnly>

`modelValue` is two-way bound with `v-model:modelValue` — the readout updates the instant you add or remove, and a consumer write flows back in. The **Skills** instance caps at `:max="8"` (the input disables once full) and its buttons drive the imperative handle (`clear()`, `focus()`) grabbed through Vue's `ref`. The **Emails** instance passes a `:validate` function that rejects non-emails and lower-cases accepted ones — a rejected candidate is silently dropped. See the [full API](/components/tags-api) for every prop, event, handle verb, the scoped `#tag` slot, plus theming and accessibility reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/tags/src/Tags.rozie{html}[Tags.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/tags-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/tags/packages/react/src/Tags.tsx[React]
<<< ../../packages/ui/tags/packages/vue/src/Tags.vue[Vue]
<<< ../../packages/ui/tags/packages/svelte/src/Tags.svelte[Svelte]
<<< ../../packages/ui/tags/packages/angular/src/Tags.ts[Angular]
<<< ../../packages/ui/tags/packages/solid/src/Tags.tsx[Solid]
<<< ../../packages/ui/tags/packages/lit/src/Tags.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `add` / `remove` / `change` events, same two-way `modelValue`, same scoped `#tag` slot, same imperative handle — all from the one source above, with no third-party engine behind it.

## See also

- [Tags — showcase](/components/tags) — overview, quick start, theming, and the full reference.
- [Headless tags input comparison](/components/tags-comparison) — how `@rozie-ui/tags` stacks up against react-tag-input, vue3-tags-input, ngx-chips, Tagify, and the per-framework token-input libraries.

<style scoped>
.tags-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.tags-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.tags-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.tags-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.tags-live__head button {
  font: inherit;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.tags-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.tags-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.tags-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
