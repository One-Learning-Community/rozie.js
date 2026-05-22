<script lang="ts">
interface Props {
  items?: any[];
  [key: string]: unknown;
}

let { items = $bindable((() => [])()), ...__rozieAttrs }: Props = $props();

const remaining = $derived(items.filter((i: any) => !i.done).length);
</script>


<div class="count" {...__rozieAttrs}>{remaining}</div>


<style>
.count { font-variant-numeric: tabular-nums; }
</style>
