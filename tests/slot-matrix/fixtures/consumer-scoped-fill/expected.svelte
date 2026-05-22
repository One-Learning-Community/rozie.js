<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<Producer>{#snippet header({ close })}
    <button onclick={close}>×</button>
  {/snippet}
  Body text
</Producer>

