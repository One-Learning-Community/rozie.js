<!--
  PropDefaultCoercion runtime probe page — Phase 16 SPEC R1/R5 D-05 arm.
  Mounts the canonical examples/PropDefaultCoercion.rozie in three modes
  (instance1 / instance2 / override) so the Playwright spec can verify
  declared-default coercion + D-02 once-per-instance factory semantics +
  consumer-override pass-through on Vue.
-->
<template>
  <main class="pdc-page">
    <h2>PropDefaultCoercion</h2>
    <div class="pdc-nav">
      <button data-testid="pdc-mode-instance1" @click="mode = 'instance1'">instance1</button>
      <button data-testid="pdc-mode-instance2" @click="mode = 'instance2'">instance2</button>
      <button data-testid="pdc-mode-override" @click="mode = 'override'">override</button>
    </div>
    <p>Mode: <span data-testid="pdc-mode">{{ mode }}</span></p>
    <PropDefaultCoercionRozie v-if="mode === 'instance1'" :key="'instance1'" />
    <PropDefaultCoercionRozie v-else-if="mode === 'instance2'" :key="'instance2'" />
    <PropDefaultCoercionRozie
      v-else
      :key="'override'"
      :a="'override'"
      :e="[1, 2]"
    />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PropDefaultCoercionRozie from '../../../../PropDefaultCoercion.rozie';

type Mode = 'instance1' | 'instance2' | 'override';
const mode = ref<Mode>('instance1');
</script>

<style scoped>
.pdc-page { padding: 1rem; }
.pdc-nav { display: flex; gap: 0.25rem; margin-bottom: 0.5rem; }
</style>
