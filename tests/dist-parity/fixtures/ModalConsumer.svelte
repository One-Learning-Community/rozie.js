<script lang="ts">
import Modal from './Modal.svelte';
import WrapperModal from './WrapperModal.svelte';

interface Props {
  title?: string;
}

let { title = 'Confirm' }: Props = $props();

let open = $state(true);
let slotName = $state('header');

function onConfirm() {
  open = false;
}
</script>


<div class="modal-consumer">
  <Modal open={open}>{#snippet header({ close })}
      <h2>{title}</h2>
      <button class="close" onclick={close}>×</button>
    {/snippet}{#snippet footer({ close })}
      <button onclick={close}>Cancel</button>
      <button onclick={(e) => { onConfirm(); }}>OK</button>
    {/snippet}
    Are you sure you want to proceed?
    </Modal>

  <Modal open={open} snippets={{ [slotName]: __rozieDynSlot_0 }}>
    Dynamic-name demo body
  {#snippet __rozieDynSlot_0()}
      <span class="dynamic-fill">Dynamic header via slotName</span>
    {/snippet}</Modal>

  <WrapperModal title={title}>{#snippet title()}
      <h2>Re-projected title</h2>
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
