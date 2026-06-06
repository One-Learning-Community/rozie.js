<script lang="ts">
import Modal from './Modal.svelte';
import WrapperModal from './WrapperModal.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  title?: string;
  [key: string]: unknown;
}

let { title = 'Confirm', ...__rozieAttrs }: Props = $props();

let open1 = $state(true);
let open2 = $state(true);
let open3 = $state(true);
let slotName = $state('header');

function onConfirm() {
  open1 = false;
}
</script>

<div {...__rozieAttrs} class={["modal-consumer", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-5d081d3a><Modal bind:open={open1} data-rozie-s-5d081d3a>{#snippet header({ close })}<h2 data-rozie-s-5d081d3a>{title}</h2><button class="close" onclick={close} data-rozie-s-5d081d3a>×</button>{/snippet}{#snippet footer({ close })}<button onclick={close} data-rozie-s-5d081d3a>Cancel</button><button onclick={($event) => { onConfirm(); }} data-rozie-s-5d081d3a>OK</button>{/snippet}
    Are you sure you want to proceed?
    </Modal><Modal bind:open={open2} data-rozie-s-5d081d3a snippets={{ [slotName]: __rozieDynSlot_0 }}>
    Dynamic-name demo body
  {#snippet __rozieDynSlot_0()}<span class="dynamic-fill" data-rozie-s-5d081d3a>Dynamic header via slotName</span>{/snippet}</Modal><WrapperModal bind:open={open3} title={title} data-rozie-s-5d081d3a>{#snippet brand()}<h2 data-rozie-s-5d081d3a>Re-projected brand</h2>{/snippet}{#snippet actions()}<button data-rozie-s-5d081d3a>Wrapper action</button>{/snippet}
    Body via wrapper's default slot
    </WrapperModal></div>

<style>
:global {
  .modal-consumer[data-rozie-s-5d081d3a] { display: flex; flex-direction: column; gap: 1rem; }
  .close[data-rozie-s-5d081d3a] { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
  .dynamic-fill[data-rozie-s-5d081d3a] { font-weight: bold; }
}
</style>
