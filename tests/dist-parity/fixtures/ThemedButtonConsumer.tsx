import styles from './ThemedButtonConsumer.module.css';
import ThemedButton from './ThemedButton';
import ThemedButtonManual from './ThemedButtonManual';

interface ThemedButtonConsumerProps {}

export default function ThemedButtonConsumer(props: ThemedButtonConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={styles["themed-button-consumer"]} {...attrs} data-rozie-s-14b8cbaa="">
      <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" className={styles["extra-variant"]} style="--btn-bg: #ef4444" label={'Auto'} />

      <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" className={styles["extra-variant"]} style="--btn-bg: #10b981" label={'Manual'} />
    </div>
    </>
  );
}
