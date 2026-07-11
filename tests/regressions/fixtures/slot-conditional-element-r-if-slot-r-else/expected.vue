<template>


<div class="r" v-bind="$attrs"><p v-if="!props.show">nothing</p><template v-else><slot></slot></template></div>

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
