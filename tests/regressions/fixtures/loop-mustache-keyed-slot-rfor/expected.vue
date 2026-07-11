<template>


<div class="r" v-bind="$attrs"><template v-for="row in props.rows" :key="row.id"><slot :name="row"></slot></template></div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ rows?: any[] }>(),
  { rows: () => [] }
);

defineSlots<{
  default(props: { name: any }): any;
}>();

function noop(): void {}
</script>
