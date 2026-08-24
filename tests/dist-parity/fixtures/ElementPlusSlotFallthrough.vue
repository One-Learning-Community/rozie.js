<template>

<slot name="header"></slot>
<div :class="['epsf-root', 'epsf-root--' + props.variant]" v-bind="$attrs">chrome</div>
<slot></slot>
<slot name="footer"></slot>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ variant?: string }>(),
  { variant: 'primary' }
);

defineSlots<{
  header(props: {  }): any;
  default(props: {  }): any;
  footer(props: {  }): any;
}>();
</script>

<style scoped>
.epsf-root {
  display: block;
  padding: 0.5rem;
  border: 1px solid #ddd;
}
</style>
