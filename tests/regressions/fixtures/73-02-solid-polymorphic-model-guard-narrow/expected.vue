<template>

<div class="selected" v-bind="$attrs">{{ selected() }}</div>

</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
const __rozieModel_value = defineModel<string | Record<string, any>>('value', { default: '' });
const value = computed<string | Record<string, any>>({
  get: () => __rozieModel_value.value,
  set: (v) => { if (__rozieBound('value')) __rozieVm.emit('update:value', v); else __rozieModel_value.value = v; },
});

// project_solid_polymorphic_model_typeof_narrow_gap / emitter-hardening
// backlog item #11: capturing the guard-and-reread pattern directly (no
// author-side workaround) — the emitter must bind a local before the guard
// so the narrowing holds uniformly on all six targets.
const selected = (): string => typeof value.value === 'string' ? value.value : '';
</script>

<style scoped>
.selected { font-variant-numeric: tabular-nums; }
</style>
