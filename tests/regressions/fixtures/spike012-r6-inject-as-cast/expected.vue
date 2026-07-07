<template>

<div class="r" v-bind="$attrs"><button @click="theme && theme.cycle()">{{ theme && theme.color }}</button></div>

</template>

<script setup lang="ts">
import { inject } from 'vue';

const theme = (inject('theme')) as {
  color: string;
  cycle: () => void;
} | undefined;
</script>
