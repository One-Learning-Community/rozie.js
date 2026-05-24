<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<Producer data-rozie-s-bd0c3708>{#snippet header()}
    <h2 data-rozie-s-bd0c3708>Custom Header</h2>
  {/snippet}
  Custom body content
</Producer>

