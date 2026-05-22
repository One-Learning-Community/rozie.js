<template>

<div class="rbind-probe">
  <span :class="['a', 'b']" v-bind="{ id: 'x' }">canonical</span>
  <span v-bind="{ id: 'y' }" :class="['b', 'a']">reordered</span>
</div>

</template>

<script setup lang="ts">

</script>

<style scoped>
.rbind-probe {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.a { color: #1f2937; }
.b { font-weight: 700; }
</style>
