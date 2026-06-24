<template>

<div class="prop-docs" v-bind="$attrs">
  <span class="label">{{ props.label }}</span>
  <span class="count">{{ props.count }}</span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /**
     * The visible text label for the control.
     * @deprecated Use `text` instead — `label` is retained only for back-compat.
     * @example
     * <PropDocs label="Save" />
     */
    label?: string;
    count?: number;
  }>(),
  { label: '', count: 0 }
);
</script>

<style scoped>
.prop-docs { display: inline-flex; gap: 0.5rem; align-items: center; }
.label { font-weight: 600; }
.count { font-variant-numeric: tabular-nums; }
</style>
