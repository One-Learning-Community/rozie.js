<template>

<div class="attr-nullish-drop" v-bind="$attrs">
  <span :data-x="cond ? 'v' : undefined" :aria-expanded="(cond ? 'true' : 'false') ?? undefined" :title="maybeNull">probe</span>
  <span class="attr-nullish-drop-prop" :title="props.maybeNullProp">probe-prop</span>
  <i v-for="c in loopItems" :key="c" class="attr-nullish-drop-loop" :title="props.maybeNullProp">{{ c }}</i>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ maybeNullProp?: string | null }>(),
  { maybeNullProp: null }
);

const cond = ref(false);
const maybeNull = ref<any>(null);
const loopItems = ref(['a', 'b']);
</script>
