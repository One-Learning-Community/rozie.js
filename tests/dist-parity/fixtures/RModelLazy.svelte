<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let draft = $state('');
</script>

<div {...__rozieAttrs} class={["rmodel-lazy", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-34fe9f5a><input type="text" value={draft} onchange={($event) => draft = $event.currentTarget.value} placeholder="Commit on blur" data-rozie-s-34fe9f5a /><p class="echo" data-rozie-s-34fe9f5a>Committed: {draft}</p></div>

<style>
:global {
  .rmodel-lazy[data-rozie-s-34fe9f5a] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
  .echo[data-rozie-s-34fe9f5a] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
}
</style>
