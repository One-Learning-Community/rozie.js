<script lang="ts">
import PartCard from './PartCard.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<div {...__rozieAttrs} class={["part-card-consumer", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-7f4fb92a>
  <PartCard title={'Hello'} data-rozie-s-7f4fb92a>
    Cross-shadow styled body content.
  </PartCard>
</div>


<style>
:global {
  .part-card-consumer[data-rozie-s-7f4fb92a] {
    display: inline-flex;
    padding: 0.5rem;
  }
}
</style>
