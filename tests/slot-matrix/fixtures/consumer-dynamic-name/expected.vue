<template>

<Producer><template #[slotName]>Dynamic fill</template></Producer>

</template>

<script setup lang="ts">
import Producer from './producer.vue';

import { ref } from 'vue';

const slotName = ref('a');
</script>
