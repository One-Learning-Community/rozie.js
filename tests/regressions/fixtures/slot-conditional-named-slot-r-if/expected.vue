<template>


<div class="r" v-bind="$attrs"><template v-if="props.show"><slot name="header"></slot></template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ show?: boolean }>(),
  { show: false }
);

defineSlots<{
  header(props: {  }): any;
}>();

function noop(): void {}
</script>
