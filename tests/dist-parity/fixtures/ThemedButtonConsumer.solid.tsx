import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import ThemedButton from './ThemedButton';
import ThemedButtonManual from './ThemedButtonManual';
import ThemedButtonListenersManual from './ThemedButtonListenersManual';
import ThemedButtonAllManual from './ThemedButtonAllManual';

interface ThemedButtonConsumerProps {}

export default function ThemedButtonConsumer(_props: ThemedButtonConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [onClick, setOnClick] = createSignal(() => {});
  const [onMouseEnter, setOnMouseEnter] = createSignal(() => {});

  return (
    <>
    <style>{`.themed-button-consumer[data-rozie-s-14b8cbaa] {
      display: inline-flex;
      gap: 0.75rem;
      padding: 0.5rem;
    }
    .extra-variant[data-rozie-s-14b8cbaa] {
      font-weight: 600;
    }`}</style>
    <>
    <div {...attrs} class={"themed-button-consumer" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...attrs} data-rozie-s-14b8cbaa="">
      <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" style="--btn-bg: #ef4444" class={"extra-variant"} label={'Auto'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" style="--btn-bg: #10b981" class={"extra-variant"} label={'Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonListenersManual id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" style="--btn-bg: #f59e0b" class={"extra-variant"} label={'Listeners Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />

      <ThemedButtonAllManual id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" style="--btn-bg: #8b5cf6" class={"extra-variant"} label={'All Manual'} onClick={onClick} onMouseEnter={onMouseEnter} data-rozie-s-14b8cbaa="" />
    </div>
    </>
    </>
  );
}
