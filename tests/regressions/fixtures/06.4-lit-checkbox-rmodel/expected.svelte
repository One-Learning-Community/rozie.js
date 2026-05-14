<script lang="ts">
interface Props {
  checked?: boolean;
}

let { checked = $bindable(false) }: Props = $props();
</script>


<label class="toggle">
  
  <input type="checkbox" bind:value={checked} />
  <span>Enabled</span>
</label>


<style>
.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
</style>
