<script lang="ts">
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


<div class="backdrop" {...__rozieAttrs} onclick={($event) => { closeOnBackdrop && close(); }}>
  
  <button onclick={close}>Close</button>
</div>


<style>
.backdrop { position: fixed; inset: 0; }
</style>
