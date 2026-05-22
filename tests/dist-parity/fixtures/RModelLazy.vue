<template>

<div class="rmodel-lazy" v-bind="$attrs">
  <input type="text" v-model.lazy="draft" placeholder="Commit on blur" />
  <p class="echo">Committed: {{ draft }}</p>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const draft = ref('');
</script>

<style scoped>
.rmodel-lazy { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
</style>
