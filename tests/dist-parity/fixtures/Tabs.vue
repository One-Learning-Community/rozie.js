<template>

<div class="tabs" data-tabs="" role="tablist" v-bind="$attrs">
  <slot></slot>
</div>

</template>

<script setup lang="ts">
import { provide, ref } from 'vue';

defineSlots<{
  default(props: {  }): any;
}>();

const active = ref(0);
const registered = ref(0);

// Children call register() during their own setup to claim the next index.
const register = () => {
  const index = registered.value;
  registered.value = index + 1;
  return index;
};

// NOTE: this helper is intentionally NOT named `setActive` — React
// auto-generates a `setActive` setter for the `$data.active` state field, and a
// same-named user function collides with it (ROZ524: "already declared" +
// infinite recursion when `$data.active = v` rewrites to `setActive(v)`). The
// PROVIDED key is still `setActive` (the consumer-facing API); only the local
// implementation name differs.
// NOTE: this helper is intentionally NOT named `setActive` — React
// auto-generates a `setActive` setter for the `$data.active` state field, and a
// same-named user function collides with it (ROZ524: "already declared" +
// infinite recursion when `$data.active = v` rewrites to `setActive(v)`). The
// PROVIDED key is still `setActive` (the consumer-facing API); only the local
// implementation name differs.
const selectActive = (index: any) => {
  active.value = index;
};

// Publish the active-index API. `get active()` keeps the read live (D-3 /
// REQ-29) so every injected Tab updates when the active selection changes —
// no prop is passed between Tabs and any Tab.

provide('tabs', {
  get active() {
    return active.value;
  },
  setActive: selectActive,
  register
});
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0.25rem;
  font-family: system-ui, -apple-system, sans-serif;
}
</style>
