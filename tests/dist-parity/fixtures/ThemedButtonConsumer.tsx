import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './ThemedButtonConsumer.module.css';
import ThemedButton from './ThemedButton';
import ThemedButtonManual from './ThemedButtonManual';
import ThemedButtonListenersManual from './ThemedButtonListenersManual';
import ThemedButtonAllManual from './ThemedButtonAllManual';

interface ThemedButtonConsumerProps {}

export default function ThemedButtonConsumer(props: ThemedButtonConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [onClick, setOnClick] = useState(() => {});
  const [onMouseEnter, setOnMouseEnter] = useState(() => {});

  return (
    <>
    <div {...attrs} className={clsx(styles["themed-button-consumer"], (attrs.className as string | undefined))} {...attrs} data-rozie-s-14b8cbaa="">
      <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" className={styles["extra-variant"]} style={{ "--btn-bg": "#ef4444" }} label={'Auto'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" className={styles["extra-variant"]} style={{ "--btn-bg": "#10b981" }} label={'Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonListenersManual id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" className={styles["extra-variant"]} style={{ "--btn-bg": "#f59e0b" }} label={'Listeners Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonAllManual id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" className={styles["extra-variant"]} style={{ "--btn-bg": "#8b5cf6" }} label={'All Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />
    </div>
    </>
  );
}
