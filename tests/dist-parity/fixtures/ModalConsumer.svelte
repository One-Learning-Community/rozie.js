<script lang="ts">
import Modal from './Modal.svelte';
import WrapperModal from './WrapperModal.svelte';

interface Props {
  title?: string;
}

let { title = 'Confirm' }: Props = $props();

let open1 = $state(true);
let open2 = $state(true);
let open3 = $state(true);
let slotName = $state('header');

function onConfirm() {
  open1 = false;
}
</script>


<div class="modal-consumer">
  <Modal bind:open={open1}>{#snippet header({ close })}
      <h2>{title}</h2>
      <button class="close" onclick={close}>×</button>
    {/snippet}{#snippet footer({ close })}
      <button onclick={close}>Cancel</button>
      <button onclick={(e) => { onConfirm(); }}>OK</button>
    {/snippet}
    Are you sure you want to proceed?
    </Modal>

  <Modal bind:open={open2} snippets={{ [slotName]: __rozieDynSlot_0 }}>
    Dynamic-name demo body
  {#snippet __rozieDynSlot_0()}
      <span class="dynamic-fill">Dynamic header via slotName</span>
    {/snippet}</Modal>

  <WrapperModal bind:open={open3} title={title}>{#snippet brand()}
      <h2>Re-projected brand</h2>
    {/snippet}{#snippet actions()}
      <button>Wrapper action</button>
    {/snippet}
    Body via wrapper's default slot
    </WrapperModal>
</div>


<style>
.modal-consumer { display: flex; flex-direction: column; gap: 1rem; }
.close { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.dynamic-fill { font-weight: bold; }
</style>
