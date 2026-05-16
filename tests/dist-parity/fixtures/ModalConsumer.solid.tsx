import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import Modal from './Modal';
import WrapperModal from './WrapperModal';

interface ModalConsumerProps {
  title?: string;
}

export default function ModalConsumer(_props: ModalConsumerProps): JSX.Element {
  const _merged = mergeProps({ title: 'Confirm' }, _props);
  const [local, rest] = splitProps(_merged, ['title']);

  const [open, setOpen] = createSignal(true);
  const [slotName, setSlotName] = createSignal('header');

  function onConfirm() {
    setOpen(false);
  }

  return (
    <>
    <style>{`.modal-consumer[data-rozie-s-5d081d3a] { display: flex; flex-direction: column; gap: 1rem; }
    .close[data-rozie-s-5d081d3a] { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .dynamic-fill[data-rozie-s-5d081d3a] { font-weight: bold; }`}</style>
    <>
    <div class={"modal-consumer"} data-rozie-s-5d081d3a="">
      <Modal open={open()} headerSlot={({ close }) => (<>
          <h2 data-rozie-s-5d081d3a="">{local.title}</h2>
          <button class={"close"} onClick={close} data-rozie-s-5d081d3a="">×</button>
        </>)} footerSlot={({ close }) => (<>
          <button onClick={close} data-rozie-s-5d081d3a="">Cancel</button>
          <button onClick={(e) => { onConfirm(); }} data-rozie-s-5d081d3a="">OK</button>
        </>)}>
        Are you sure you want to proceed?
        </Modal>

      <Modal open={open()} slots={{ [slotName()]: () => (<>
          <span class={"dynamic-fill"} data-rozie-s-5d081d3a="">Dynamic header via slotName</span>
        </>) }}>
        Dynamic-name demo body
      </Modal>

      <WrapperModal title={local.title} titleSlot={() => (<>
          <h2 data-rozie-s-5d081d3a="">Re-projected title</h2>
        </>)} actionsSlot={() => (<>
          <button data-rozie-s-5d081d3a="">Wrapper action</button>
        </>)}>
        Body via wrapper's default slot
        </WrapperModal>
    </div>
    </>
    </>
  );
}
