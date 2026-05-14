<script lang="ts">
interface Props {
  closeOnBackdrop?: boolean;
}

let { closeOnBackdrop = true }: Props = $props();

let open = $state(false);

const close = () => {
  open = false;
};
</script>


<div class="backdrop" onclick={(e) => { closeOnBackdrop && close(); }}>
  
  <button onclick={close}>Close</button>
</div>


<style>
.backdrop { position: fixed; inset: 0; }
</style>
