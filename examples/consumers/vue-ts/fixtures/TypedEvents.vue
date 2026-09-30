<template>

  <div class="typed-events" v-bind="$attrs">
    <button class="bump" @click="bump()">+</button>
    <button class="clear" @click="clear()" @dblclick="emit('select', count)">reset</button>
    <button class="open" @click="emit('row-open', { index: count })">open</button>
    <slot name="row" :count="count" :tone="props.tone"></slot>
  </div>

</template>

<script lang="ts">
export type Count = number;
export interface PingPayload {
  count: Count;
  label: string;
}

export interface TypedEventsHandle {
  bump: () => void;
  clear: (...args: any[]) => any;
  getCount: () => number;
  jump: (to: number) => void;
}
</script>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ tone?: string }>(),
  { tone: 'info' }
);

const emit = defineEmits<{
  ping: [payload: PingPayload];
  reset: [];
  select: [payload: number];
  'row-open': [payload: {
  index: number;
}];
}>();

defineSlots<{
  row(props: { count: Count; tone: string }): any;
}>();

const count = ref(0);

function bump() {
  const next = count.value + 1;
  count.value = next;
  emit('ping', {
    count: next,
    label: props.tone
  });
}
function clear() {
  count.value = 0;
  emit('reset');
}
function getCount() {
  return count.value;
}
function jump(...a: any[]) {
  count.value = a.length;
}

defineExpose({ bump, clear, getCount, jump } as TypedEventsHandle);
</script>
