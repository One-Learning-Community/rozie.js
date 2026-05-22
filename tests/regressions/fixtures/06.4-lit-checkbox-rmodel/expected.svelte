<script lang="ts">
interface Props {
  checked?: boolean;
  [key: string]: unknown;
}

let { checked = $bindable(false), ...__rozieAttrs }: Props = $props();
</script>


<label class="toggle" {...__rozieAttrs}>
  
  <input type="checkbox" bind:checked={checked} />
  <span>Enabled</span>
</label>


<style>
.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
</style>
