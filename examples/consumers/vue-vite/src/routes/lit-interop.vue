<template>
  <!--
    Phase 06.4 P3 SC5 — Vue 3 consuming a compiled Lit custom element.

    Per RESEARCH.md Pattern 11 + CONTEXT.md <specifics>: Vue 3 needs
    `app.config.compilerOptions.isCustomElement` set so it does NOT try to
    resolve `<rozie-counter>` as a Vue component. That's wired in src/main.ts
    + vite.config.ts.

    Property binding: `:value="counterValue"` (Vue normalises Boolean / Number
    types automatically for custom-element attributes).
    Event binding:    `@value-change="onValueChange"` — Vue's native syntax.
  -->
  <div>
    <h2>Lit Interop (Vue)</h2>
    <p>Vue 3 consuming compiled Lit <code>&lt;rozie-counter&gt;</code>.</p>
    <rozie-counter
      :value="counterValue"
      :step="1"
      :min="-10"
      :max="10"
      @value-change="onValueChange"
    ></rozie-counter>
    <p>
      Parent-tracked value:
      <span data-testid="parent-value">{{ counterValue }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import '../lit-fixtures/Counter.lit';

const counterValue = ref<number>(5);
const onValueChange = (e: Event) => {
  counterValue.value = (e as CustomEvent).detail as number;
};
</script>
