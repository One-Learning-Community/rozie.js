<template>

<div class="dynamic-slots" v-bind="$attrs">

  
  <slot name="cell-total" :value="props.total">
    <strong>{{ props.total }}</strong>
  </slot>

  
  <slot :name="`cell-${props.cellKey}`" :row="props.row" :value="props.row[props.cellKey]">
    <span>{{ props.row[props.cellKey] }}</span>
  </slot>

  
  <slot :name="`row-${props.freeSlotName}`">
    <em>fallback</em>
  </slot>

</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ row?: Record<string, any>; total?: number; cellKey?: string; freeSlotName?: string }>(),
  { row: () => ({}), total: 0, cellKey: 'status', freeSlotName: 'freeform' }
);

defineSlots<{
  'cell-total'(props: { value: any }): any;
  [key: `cell-${string}`]: ((props: { row: any; value: any }) => any) | undefined;
  [key: `row-${string}`]: (() => any) | undefined;
}>();
</script>
