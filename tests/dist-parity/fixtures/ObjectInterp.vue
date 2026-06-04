<template>

<div class="object-interp" v-bind="$attrs">
  <p :class="`card--${obj}`" :data-x="obj">{{ obj }}</p>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const obj = ref({
  a: 1,
  b: [2, 3]
});
</script>
