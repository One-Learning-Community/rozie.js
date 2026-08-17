<template>


<div class="r" v-bind="$attrs"><template v-for="x in props.items"><template v-if="x"><slot :name="x"></slot></template></template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ items?: any[] }>(),
  { items: () => [] }
);

defineSlots<{
  [key: string]: ((props: any) => any) | undefined;
}>();

function noop(): void {}
</script>
