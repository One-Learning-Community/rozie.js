<template>

<ul class="list">
  
  <li v-for="item in items" :key="item.id">
    <slot name="item" :item="item" :remaining="remaining">
      {{ item.label }}
    </slot>
  </li>
</ul>

</template>

<script setup lang="ts">
import { computed } from 'vue';

const items = defineModel<unknown[]>('items', { default: () => [] });

defineSlots<{
  item(props: { item: any; remaining: any }): any;
}>();

const remaining = computed(() => items.value.filter(i => !i.done).length);
</script>

<style scoped>
.list { list-style: none; padding: 0; }
</style>
