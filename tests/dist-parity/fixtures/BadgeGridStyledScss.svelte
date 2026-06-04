<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  badges?: any[];
  [key: string]: unknown;
}

let __defaultBadges = (() => [])();

let { badges = __defaultBadges, ...__rozieAttrs }: Props = $props();
</script>


<div {...__rozieAttrs} class={["badge-grid", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-44801268>
  {#each badges as badge (badge)}<span class="badge badge--neutral" data-rozie-s-44801268>
    {rozieDisplay(badge)}
  </span>{/each}
</div>


<style>
:global {
  .badge[data-rozie-s-44801268] {
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    font-weight: 600;
  }
  .badge-grid[data-rozie-s-44801268] {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .badge[data-rozie-s-44801268] {
    padding: 2px 8px;
  }
  .badge--neutral[data-rozie-s-44801268] {
    color: #ffffff;
    background: #6b7280;
  }
  .badge--success[data-rozie-s-44801268] {
    color: #ffffff;
    background: #16a34a;
  }
  .badge--warning[data-rozie-s-44801268] {
    color: #ffffff;
    background: #d97706;
  }
  .badge--danger[data-rozie-s-44801268] {
    color: #ffffff;
    background: #dc2626;
  }
  .badge-grid--gap-1[data-rozie-s-44801268] {
    gap: 4px;
  }
  .badge-grid--gap-2[data-rozie-s-44801268] {
    gap: 8px;
  }
  .badge-grid--gap-3[data-rozie-s-44801268] {
    gap: 12px;
  }
}
</style>
