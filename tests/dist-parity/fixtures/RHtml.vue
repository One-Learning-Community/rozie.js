<template>

<div v-html="props.content" class="rhtml" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ content?: string }>(),
  { content: '<strong>safe</strong>' }
);
</script>

<style scoped>
.rhtml { font: 1rem/1.4 system-ui; }
</style>
