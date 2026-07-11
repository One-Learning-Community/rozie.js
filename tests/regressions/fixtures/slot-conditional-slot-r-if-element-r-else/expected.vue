<template>


<div class="r" v-bind="$attrs"><template v-if="props.show"><slot></slot></template><p v-else>nothing</p></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ show?: boolean }>(),
  { show: false }
);

defineSlots<{
  default(props: {  }): any;
}>();

function noop(): void {}
</script>
