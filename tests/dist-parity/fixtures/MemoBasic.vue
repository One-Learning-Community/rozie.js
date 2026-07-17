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
  keys: null,
  val: null,
  has: false
};
const filtered = () => {
  const __rozieMemoKey = [props.items, query.value];
  if (filteredCache.has && filteredCache.keys.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === filteredCache.keys[i])) {
    return filteredCache.val;
  }
  const __rozieMemoVal = props.items.filter((item: any) => item.includes(query.value));
  filteredCache.keys = __rozieMemoKey;
  filteredCache.val = __rozieMemoVal;
  filteredCache.has = true;
  return __rozieMemoVal;
};
</script>

<style scoped>
.probe {
  display: block;
  padding: 0.5rem;
}
</style>
