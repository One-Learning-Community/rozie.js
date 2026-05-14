<script lang="ts">
interface Props {
  items?: unknown[];
}

let { items = $bindable((() => [])()) }: Props = $props();

const remaining = $derived(items.filter(i => !i.done).length);
</script>


<div class="count">{remaining}</div>


<style>
.count { font-variant-numeric: tabular-nums; }
</style>
