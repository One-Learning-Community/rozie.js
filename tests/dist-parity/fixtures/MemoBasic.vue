<template>

<div class="probe" v-bind="$attrs">
  <input :value="query" @input="query = $event.target.value" />
  <ul>
    <li v-for="item in filtered()" :key="item">{{ item }}</li>
  </ul>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ items?: any[] }>(),
  { items: () => [] }
);

const query = ref('');

const filteredCache = {
  keys: null as any[] | null,
  val: null as any
};
const filtered = () => {
  const __rozieMemoKey = [props.items, query.value];
  const __rozieMemoPrev = filteredCache.keys;
  if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
    return filteredCache.val;
  }
  const __rozieMemoVal = props.items.filter((item: any) => item.includes(query.value));
  filteredCache.keys = __rozieMemoKey;
  filteredCache.val = __rozieMemoVal;
  return __rozieMemoVal;
};
</script>

<style scoped>
.probe {
  display: block;
  padding: 0.5rem;
}
</style>
