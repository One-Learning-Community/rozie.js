<script lang="ts">
interface Props {
  badges?: any[];
  [key: string]: unknown;
}

let { badges = (() => [])(), ...__rozieAttrs }: Props = $props();
</script>


<div class="badge-grid" {...__rozieAttrs}>
  {#each badges as badge (badge)}<span class="badge badge--neutral">
    {badge}
  </span>{/each}
</div>


<style>
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
