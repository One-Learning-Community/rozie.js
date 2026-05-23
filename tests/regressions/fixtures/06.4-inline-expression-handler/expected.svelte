<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  closeOnBackdrop?: boolean;
  [key: string]: unknown;
}

let { closeOnBackdrop = true, ...__rozieAttrs }: Props = $props();

let open = $state(false);

const close = () => {
  open = false;
};
</script>


<div {...__rozieAttrs} class={["backdrop", (__rozieAttrs)?.class]} onclick={($event) => { closeOnBackdrop && close(); }} use:applyListeners={__rozieAttrs}>
  
  <button onclick={close}>Close</button>
</div>


<style>
.backdrop { position: fixed; inset: 0; }
</style>
