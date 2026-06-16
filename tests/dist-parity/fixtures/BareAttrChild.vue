<template>

<div class="bare-attr-child" :data-combobox="props.combobox" v-bind="$attrs">
  combobox = {{ props.combobox }}
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ combobox?: boolean }>(),
  { combobox: false }
);
</script>
