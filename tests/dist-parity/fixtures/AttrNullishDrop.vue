<template>

<div class="attr-nullish-drop" v-bind="$attrs">
  <span :data-x="cond ? 'v' : undefined" :aria-expanded="(cond ? 'true' : 'false') ?? undefined" :title="maybeNull">probe</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const cond = ref(false);
const maybeNull = ref<any>(null);
</script>
