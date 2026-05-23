import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './ModalConsumer.module.css';
import Modal from './Modal';
import WrapperModal from './WrapperModal';

interface ModalConsumerProps {
  title?: string;
}

export default function ModalConsumer(_props: ModalConsumerProps): JSX.Element {
  const props: ModalConsumerProps & { title: string } = {
    ..._props,
    title: _props.title ?? 'Confirm',
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, ...rest } = _props as ModalConsumerProps & Record<string, unknown>;
    void title;
    return rest;
  })();
  const [open1, setOpen1] = useState(true);
  const [open2, setOpen2] = useState(true);
  const [open3, setOpen3] = useState(true);
  const [slotName, setSlotName] = useState('header');

  function onConfirm() {
    setOpen1(false);
  }

  return (
    <>
    <div {...attrs} className={clsx(styles["modal-consumer"], (attrs.className as string | undefined))} {...attrs} data-rozie-s-5d081d3a="">
      <Modal open={open1} onOpenChange={setOpen1} data-rozie-s-5d081d3a="" renderHeader={({ close }) => (<>
          <h2 data-rozie-s-5d081d3a="">{props.title}</h2>
          <button className={styles.close} onClick={close} data-rozie-s-5d081d3a="">×</button>
        </>)} renderFooter={({ close }) => (<>
          <button onClick={close} data-rozie-s-5d081d3a="">Cancel</button>
          <button onClick={($event) => { onConfirm(); }} data-rozie-s-5d081d3a="">OK</button>
        </>)} children={<>
        Are you sure you want to proceed?
        </>} />

      <Modal open={open2} onOpenChange={setOpen2} data-rozie-s-5d081d3a="" children={<>
        Dynamic-name demo body
      </>} slots={{ [slotName]: () => (<>
          <span className={styles["dynamic-fill"]} data-rozie-s-5d081d3a="">Dynamic header via slotName</span>
        </>) }} />

      <WrapperModal open={open3} onOpenChange={setOpen3} title={props.title} data-rozie-s-5d081d3a="" renderBrand={() => (<>
          <h2 data-rozie-s-5d081d3a="">Re-projected brand</h2>
        </>)} renderActions={() => (<>
          <button data-rozie-s-5d081d3a="">Wrapper action</button>
        </>)} children={<>
        Body via wrapper's default slot
        </>} />
    </div>
    </>
  );
}
