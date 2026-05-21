<template>

<ul>
  <li v-for="e in items" :key="e.id">
    <span>{{ e.label }}</span>
    
    <button type="button" @click="removeItem(e.id)">×</button>
  </li>
</ul>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const items = ref([{
  id: 'a',
  label: 'A'
}, {
  id: 'b',
  label: 'B'
}]);

const removeItem = (id: any) => {
  items.value = items.value.filter((x: any) => x.id !== id);
};
</script>
