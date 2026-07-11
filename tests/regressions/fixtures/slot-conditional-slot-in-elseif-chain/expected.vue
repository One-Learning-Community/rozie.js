<template>


<div class="r" v-bind="$attrs"><span v-if="props.mode === 0">zero</span><template v-else-if="props.mode === 1"><slot></slot></template><span v-else>other</span></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ mode?: number }>(),
  { mode: 0 }
);

defineSlots<{
  default(props: {  }): any;
}>();

function noop(): void {}
</script>
