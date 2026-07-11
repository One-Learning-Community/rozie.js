<template>


<div class="r" v-bind="$attrs"><template v-for="x in props.items">{{ x }}</template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ items?: any[] }>(),
  { items: () => [] }
);

function noop(): void {}
</script>
