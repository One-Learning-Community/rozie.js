<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  onSave?: (...args: any[]) => any;
  onCancel?: ((...args: any[]) => any) | null;
  [key: string]: unknown;
}

let {
  onSave = () => {},
  onCancel = null,
  ...__rozieAttrs
}: Props = $props();

let n = $state(0);
</script>

<div {...__rozieAttrs} class={["fpg", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-a5944868><button class="save" onclick={($event) => { (onSave)($event); }} data-rozie-s-a5944868>save</button><button class="cancel" onclick={($event) => { onCancel && onCancel(); }} data-rozie-s-a5944868>cancel</button><span class="n" data-rozie-s-a5944868>{n}</span></div>
