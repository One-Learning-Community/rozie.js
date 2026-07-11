<template>


<div class="r" v-bind="$attrs"><template v-for="x in props.items"><slot :name="x"></slot></template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ items?: any[] }>(),
  { items: () => [] }
);

defineSlots<{
  default(props: { name: any }): any;
}>();

function noop(): void {}
</script>
