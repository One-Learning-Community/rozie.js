<template>

<label class="toggle">
  
  <input type="checkbox" v-model="checked" />
  <span>Enabled</span>
</label>

</template>

<script setup lang="ts">
const checked = defineModel<boolean>('checked', { default: false });
</script>

<style scoped>
.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
</style>
