<template>

<div class="badge-grid">
  <span v-for="badge in props.badges" :key="badge" class="badge badge--neutral">
    {{ badge }}
  </span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ badges?: any[] }>(),
  { badges: () => [] }
);
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  font-weight: 600;
}
.badge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.badge {
  padding: 2px 8px;
}
.badge--neutral {
  color: #ffffff;
  background: #6b7280;
}
.badge--success {
  color: #ffffff;
  background: #16a34a;
}
.badge--warning {
  color: #ffffff;
  background: #d97706;
}
.badge--danger {
  color: #ffffff;
  background: #dc2626;
}
.badge-grid--gap-1 {
  gap: 4px;
}
.badge-grid--gap-2 {
  gap: 8px;
}
.badge-grid--gap-3 {
  gap: 12px;
}
</style>
