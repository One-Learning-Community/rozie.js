---
title: TextField — live demo
---

<script setup lang="ts">
import { computed, ref } from 'vue';
import TextField from '@rozie-ui/text-field-vue';

const email = ref('');
const touched = ref(false);
const emailError = computed(() =>
  touched.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) ? 'Enter a valid email address.' : '',
);
const notes = ref('');
const search = ref('');
const lastEvent = ref('—');
const searchBox = ref();
</script>

# TextField — live demo

This is the **real `@rozie-ui/text-field-vue` package** running on this page (VitePress is itself a Vue app), built from this repo's workspace rather than npm: no `@rozie-ui/text-field` target has published yet. The same `TextField` component, with the same API, ships for React, Vue, Svelte, Angular, Solid, and Lit.

<ClientOnly>
<div class="tf-live">

  <div class="tf-live__cell">
    <div class="tf-live__head"><strong>Validation</strong> <span class="tf-live__muted">— error on blur</span></div>
    <TextField
      v-model:modelValue="email"
      label="Email"
      type="email"
      autocomplete="email"
      description="We never share it."
      :error="emailError"
      required
      @change="touched = true"
    />
    <code class="tf-live__readout">modelValue: {{ JSON.stringify(email) }}</code>
  </div>

  <div class="tf-live__cell">
    <div class="tf-live__head"><strong>Autosize + counter</strong> <span class="tf-live__muted">— 2 to 6 rows</span></div>
    <TextField
      v-model:modelValue="notes"
      label="Notes"
      multiline
      autosize
      :rows="2"
      :maxRows="6"
      :maxLength="280"
      showCount
    />
  </div>

  <div class="tf-live__cell">
    <div class="tf-live__head">
      <strong>Slots + handle</strong>
      <span class="tf-live__sep" />
      <button @click="searchBox?.select()">select()</button>
      <button @click="searchBox?.clear()">clear()</button>
    </div>
    <TextField
      ref="searchBox"
      v-model:modelValue="search"
      type="search"
      aria-label="Search"
      placeholder="Search docs"
      @enter="(e) => (lastEvent = 'enter: ' + e.value)"
    >
      <template #prefix><span aria-hidden="true">⌕</span></template>
      <template #suffix><kbd>Enter</kbd></template>
    </TextField>
    <code class="tf-live__readout">{{ lastEvent }}</code>
  </div>

</div>
</ClientOnly>

The email field shows the error only after its first `change` (blur), the usual "don't scold while typing" pattern, and the control gets `aria-invalid="true"` with the message linked through `aria-describedby`. The notes field grows from two rows to six, then scrolls. The search field has no visible label, so it takes `ariaLabel`; its buttons call the imperative handle through Vue's `ref`.

## What ships for each framework

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/text-field/src/TextField.rozie{html}[TextField.rozie — the source]

…and Rozie compiles it to six framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/text-field-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/text-field/packages/react/src/TextField.tsx[React]
<<< ../../packages/ui/text-field/packages/vue/src/TextField.vue[Vue]
<<< ../../packages/ui/text-field/packages/svelte/src/TextField.svelte[Svelte]
<<< ../../packages/ui/text-field/packages/angular/src/TextField.ts[Angular]
<<< ../../packages/ui/text-field/packages/solid/src/TextField.tsx[Solid]
<<< ../../packages/ui/text-field/packages/lit/src/TextField.ts[Lit]

:::

## See also

- [TextField — showcase & API](/components/text-field) — install, quick start, theming, accessibility, and the full reference.
- [Text field comparison](/components/text-field-comparison) — what `@rozie-ui/text-field` replaces in each framework, and what it deliberately does not do.

<style scoped>
.tf-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
}
.tf-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.tf-live__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.tf-live__sep {
  flex: 1;
}
.tf-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.85em;
}
.tf-live__head button {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 0.85em;
}
.tf-live__readout {
  font-size: 0.8em;
}
/* Tokens inherit, so setting them on an ancestor is enough. */
.tf-live {
  --rozie-text-field-bg: var(--vp-c-bg);
  --rozie-text-field-color: var(--vp-c-text-1);
  --rozie-text-field-border-color: var(--vp-c-divider);
  --rozie-text-field-description-color: var(--vp-c-text-2);
  --rozie-text-field-placeholder-color: var(--vp-c-text-3);
  --rozie-text-field-focus-color: var(--vp-c-brand-1);
}
</style>
