<template>

<dl class="rdt-detail-panel">
  
  <div v-for="pair in entries()" :key="pair.key" class="rdt-detail-entry">
    <dt class="rdt-detail-key">{{ pair.key }}</dt>
    <dd class="rdt-detail-value">{{ pair.value }}</dd>
  </div>
</dl>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ row?: Record<string, any> | null }>(),
  { row: null }
);

// Plain setup-once helper (NOT $computed — a $computed can't be aliased; the
// EditorSelect plain-function lesson). Build `[{ key, value }]` from the row's own
// enumerable keys, String-coercing each value. A null row yields an empty list.
const entries = () => {
  const r = props.row;
  if (!r) return [];
  return Object.keys(r).map((key: any) => ({
    key,
    value: r[key] == null ? '' : String(r[key])
  }));
};
</script>
