<template>

<div class="selected" v-bind="$attrs">{{ selected() }}</div>

</template>

<script setup lang="ts">
const value = defineModel<string | Record<string, any>>('value', { default: '' });

// project_solid_polymorphic_model_typeof_narrow_gap / emitter-hardening
// backlog item #11: capturing the guard-and-reread pattern directly (no
// author-side workaround) — the emitter must bind a local before the guard
// so the narrowing holds uniformly on all six targets.
const selected = (): string => typeof value.value === 'string' ? value.value : '';
</script>

<style scoped>
.selected { font-variant-numeric: tabular-nums; }
</style>
