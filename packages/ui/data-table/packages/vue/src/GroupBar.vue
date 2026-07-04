<template>

<div class="rdt-group-bar">
  
  <span v-for="col in props.groupableColumns" :key="col.id" class="rdt-group-token" part="group-token" draggable="true" @dragstart="onDragStart($event, col.id)">{{ col.label }}</span>

  
  <span :class="['rdt-group-drop-zone', { 'is-over': isOver }]" data-group-drop-zone="" @dragover="onDragOver($event)" @dragleave="onDragLeave($event)" @drop="onDrop($event)">
    
    <span v-if="!props.grouping.length" class="rdt-group-drop-hint">Drag columns here to group</span><span v-for="gk in props.grouping" :key="gk" class="rdt-group-token" part="group-token" data-group-token="">
      {{ gk }}
      <button type="button" class="rdt-group-token-remove" :aria-label="gk" @click="removeKey(gk)">×</button>
    </span>
  </span>

  
  <button v-if="props.grouping.length" type="button" class="rdt-group-clear" @click="clearAll()">Clear</button></div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
     */
    grouping?: any[];
    /**
     * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
     */
    groupableColumns?: any[];
    /**
     * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
     */
    applyGrouping?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
     */
    clearGrouping?: ((...args: any[]) => any) | null;
  }>(),
  { grouping: () => [], groupableColumns: () => [], applyGrouping: null, clearGrouping: null }
);

const draggingId = ref('');
const isOver = ref(false);

// Untyped handler params neutralize to `any` so the native drag-event shapes
// (dataTransfer / preventDefault) typecheck across all six strict leaves — the
// global-filter idiom (see FilterText.rozie). NEVER annotate these params.

const onDragStart = (e: any, id: any) => {
  draggingId.value = id;
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default. Also raises the drop-target highlight.
// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default. Also raises the drop-target highlight.
const onDragOver = (e: any) => {
  if (e) e.preventDefault();
  isOver.value = true;
};

// Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
// crosses onto a child token, so ignore leaves whose relatedTarget is still inside
// the zone (prevents flicker as you hover over existing grouping tokens).
// Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
// crosses onto a child token, so ignore leaves whose relatedTarget is still inside
// the zone (prevents flicker as you hover over existing grouping tokens).
const onDragLeave = (e: any) => {
  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
  isOver.value = false;
};
const onDrop = (e: any) => {
  isOver.value = false;
  const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || draggingId.value;
  draggingId.value = '';
  if (!id) return;
  // Append the dragged column id IF not already in the grouping — read the order
  // from $props.grouping, write the NEW order through applyGrouping.
  if (props.grouping.indexOf(id) !== -1) return;
  const next = props.grouping.concat([id]);
  props.applyGrouping && props.applyGrouping(next);
};
const removeKey = (key: any) => {
  props.applyGrouping && props.applyGrouping(props.grouping.filter((k: any) => k !== key));
};
const clearAll = () => {
  props.clearGrouping && props.clearGrouping();
};
</script>

<style scoped>
.rdt-group-drop-zone {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
  min-width: var(--rdt-group-drop-zone-min, 8rem);
  min-height: 1.75rem;
  padding: var(--rdt-group-drop-zone-pad, 0.1875rem 0.5rem);
  border: 1px dashed var(--rdt-group-drop-zone-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-group-drop-zone-radius, 0.375rem);
  background: var(--rdt-group-drop-zone-bg, transparent);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.rdt-group-drop-zone.is-over {
  border-color: var(--rdt-group-drop-zone-border-over, rgba(37, 99, 235, 0.7));
  background: var(--rdt-group-drop-zone-bg-over, rgba(37, 99, 235, 0.08));
}
.rdt-group-drop-hint {
  opacity: 0.55;
  font-size: 0.8125em;
  user-select: none;
  pointer-events: none;
}
</style>
