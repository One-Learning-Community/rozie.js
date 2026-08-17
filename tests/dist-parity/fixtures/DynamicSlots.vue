<template>

<div class="dynamic-slots" v-bind="$attrs">

  
  <slot name="cell-total" :value="props.total">
    <strong>{{ props.total }}</strong>
  </slot>

  
  <div v-for="col in props.columns" :key="col.key">
    <slot :name="`cell-${col.key}`" :row="props.row" :value="props.row[col.key]">
      <span>{{ props.row[col.key] }}</span>
    </slot>
  </div>

  
  <slot :name="freeSlotName" :label="freeSlotName">
    <em>fallback</em>
  </slot>

  
  <slot name="headerCell" :title="props.heading">
    <h2>{{ props.heading }}</h2>
  </slot>

</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ columns?: any[]; row?: Record<string, any>; total?: number; heading?: string }>(),
  { columns: () => [], row: () => ({}), total: 0, heading: 'Header' }
);

defineSlots<{
  'cell-total'(props: { value: any }): any;
  [key: `cell-${string}`]: ((props: { row: any; value: any }) => any) | undefined;
  [key: string]: ((props: any) => any) | undefined;
  headerCell(props: { title: any }): any;
}>();

const freeSlotName = ref('freeform');
</script>
