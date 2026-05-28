<template>

<div class="part-card-consumer" v-bind="$attrs">
  <PartCard :title="'Hello'">
    Cross-shadow styled body content.
  </PartCard>
</div>

</template>

<script setup lang="ts">
import PartCard from './PartCard.vue';


</script>

<style scoped>
.part-card-consumer {
  display: inline-flex;
  padding: 0.5rem;
}
</style>
