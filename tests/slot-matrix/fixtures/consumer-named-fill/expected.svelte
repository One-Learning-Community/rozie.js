<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<Producer>{#snippet header()}
    <h2>Custom Header</h2>
  {/snippet}
  Custom body content
</Producer>

