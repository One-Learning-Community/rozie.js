import { useState } from 'react';
import styles from './ModalConsumer.module.css';
import Modal from './Modal';
import WrapperModal from './WrapperModal';

interface ModalConsumerProps {
  title?: string;
}

export default function ModalConsumer(_props: ModalConsumerProps): JSX.Element {
  const props: ModalConsumerProps = {
    ..._props,
    title: _props.title ?? 'Confirm',
  };
  const [open, setOpen] = useState(true);
  const [slotName, setSlotName] = useState('header');

  function onConfirm() {
    setOpen(false);
  }

  return (
    <>
    <div className={styles["modal-consumer"]} data-rozie-s-5d081d3a="">
      <Modal open={open} renderHeader={({ close }) => (<>
          <h2 data-rozie-s-5d081d3a="">{props.title}</h2>
          <button className={styles.close} onClick={close} data-rozie-s-5d081d3a="">×</button>
        </>)} renderFooter={({ close }) => (<>
          <button onClick={close} data-rozie-s-5d081d3a="">Cancel</button>
          <button onClick={(e) => { onConfirm(); }} data-rozie-s-5d081d3a="">OK</button>
        </>)} children={<>
        Are you sure you want to proceed?
        </>} />

      <Modal open={open} children={<>
        Dynamic-name demo body
      </>} slots={{ [slotName]: () => (<>
          <span className={styles["dynamic-fill"]} data-rozie-s-5d081d3a="">Dynamic header via slotName</span>
        </>) }} />

      <WrapperModal title={props.title} renderTitle={() => (<>
          <h2 data-rozie-s-5d081d3a="">Re-projected title</h2>
        </>)} renderActions={() => (<>
          <button data-rozie-s-5d081d3a="">Wrapper action</button>
        </>)} children={<>
        Body via wrapper's default slot
        </>} />
    </div>
    </>
  );
}
