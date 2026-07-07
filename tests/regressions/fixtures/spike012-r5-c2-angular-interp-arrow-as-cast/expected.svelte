<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let items = $state([1, 2, 3]);

function noop(): void {}
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-8efa13ea>{items.filter(x => x as number > 1).length}</div>
