<script lang="ts">
import Producer from './producer.svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>

<Producer title={'Hello'} data-rozie-s-bd0c3708>Body text</Producer>
