<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let items = $state([{
  id: 'a',
  label: 'A'
}, {
  id: 'b',
  label: 'B'
}]);

const removeItem = (id: any) => {
  items = items.filter((x: any) => x.id !== id);
};
</script>


<ul {...__rozieAttrs} use:applyListeners={__rozieAttrs}>
  {#each items as e (e.id)}<li>
    <span>{e.label}</span>
    
    <button type="button" onclick={($event) => { removeItem(e.id); }}>×</button>
  </li>{/each}
</ul>

