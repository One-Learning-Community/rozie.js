<template>

<div class="rdt-group-bar">
  
  <span v-for="col in props.groupableColumns" :key="col.id" class="rdt-group-token" part="group-token" draggable="true" @dragstart="onDragStart($event, col.id)">{{ col.label }}</span>

  
  <span class="rdt-group-drop-zone" data-group-drop-zone="" @dragover="onDragOver($event)" @drop="onDrop($event)">
    <span v-for="gk in props.grouping" :key="gk" class="rdt-group-token" part="group-token" data-group-token="">
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

// Untyped handler params neutralize to `any` so the native drag-event shapes
// (dataTransfer / preventDefault) typecheck across all six strict leaves — the
// global-filter idiom (see FilterText.rozie). NEVER annotate these params.

const onDragStart = (e: any, id: any) => {
  draggingId.value = id;
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default.
// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default.
const onDragOver = (e: any) => {
  if (e) e.preventDefault();
};
const onDrop = (e: any) => {
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
