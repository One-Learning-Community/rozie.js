<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  items?: any[];
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let { items = __defaultItems, ...__rozieAttrs }: Props = $props();

let query = $state('');

const filteredCache = {
  keys: null,
  val: null,
  has: false
};
const filtered = () => {
  const __rozieMemoKey = [items, query];
  if (filteredCache.has && filteredCache.keys.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === filteredCache.keys[i])) {
    return filteredCache.val;
  }
  const __rozieMemoVal = items.filter((item: any) => item.includes(query));
  filteredCache.keys = __rozieMemoKey;
  filteredCache.val = __rozieMemoVal;
  filteredCache.has = true;
  return __rozieMemoVal;
};
</script>

<div {...__rozieAttrs} class={["probe", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-fcb74b54><input value={query} oninput={($event) => { query = $event.target.value; }} data-rozie-s-fcb74b54 /><ul data-rozie-s-fcb74b54>{#each filtered() as item (item)}<li data-rozie-s-fcb74b54>{rozieDisplay(item)}</li>{/each}</ul></div>

<style>
:global {
  .probe[data-rozie-s-fcb74b54] {
    display: block;
    padding: 0.5rem;
  }
}
</style>
