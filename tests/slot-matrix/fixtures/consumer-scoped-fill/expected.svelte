<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<Producer data-rozie-s-bd0c3708>{#snippet header({ close })}
    <button onclick={close} data-rozie-s-bd0c3708>×</button>
  {/snippet}
  Body text
</Producer>

