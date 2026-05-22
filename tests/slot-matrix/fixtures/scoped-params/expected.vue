<template>

<div class="scoped-params-fixture" v-bind="$attrs">
  <slot name="item" :value="props.label"></slot>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ label?: string }>(),
  { label: 'item' }
);

defineSlots<{
  item(props: { value: any }): any;
}>();
</script>
