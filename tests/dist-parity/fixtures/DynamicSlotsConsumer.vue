<template>

<div class="dynamic-slots-consumer" v-bind="$attrs">
  <DynamicSlots :columns="[{ key: 'status' }, { key: 'score' }]" :row="{ status: 'Active', score: 42 }" :total="7"><template #cell-status="{ row, value }">
      <span class="status">{{ value }}</span>
    </template><template #cell-score="{ row, value }">
      <span class="score">{{ value }}</span>
    </template><template #cell-total="{ value }">
      <strong>{{ value }}</strong>
    </template><template #headerCell="{ title }">
      <h2>{{ title }}</h2>
    </template><template #[dynamicFillKey]="{ label }">
      <em>{{ label }}</em>
    </template></DynamicSlots>
</div>

</template>

<script setup lang="ts">
import DynamicSlots from './DynamicSlots.vue';

import { ref } from 'vue';

const dynamicFillKey = ref('freeform');
</script>
