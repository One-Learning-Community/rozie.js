import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import ThemedButton from './ThemedButton';
import ThemedButtonManual from './ThemedButtonManual';

interface ThemedButtonConsumerProps {}

export default function ThemedButtonConsumer(_props: ThemedButtonConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

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
    <div class={"themed-button-consumer"} {...attrs} data-rozie-s-14b8cbaa="">
      <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class={"extra-variant"} style="--btn-bg: #ef4444" label={'Auto'} />

      <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class={"extra-variant"} style="--btn-bg: #10b981" label={'Manual'} />
    </div>
    </>
    </>
  );
}
