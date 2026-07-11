<template>


<div class="r" v-bind="$attrs"><template v-if="props.show"><slot :title="props.title"></slot></template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ show?: boolean; title?: string }>(),
  { show: false, title: '' }
);

defineSlots<{
  default(props: { title: any }): any;
}>();

function noop(): void {}
</script>
