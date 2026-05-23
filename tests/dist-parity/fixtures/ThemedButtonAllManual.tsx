import { clsx } from '@rozie/runtime-react';
import styles from './ThemedButtonAllManual.module.css';

interface ThemedButtonAllManualProps {
  label?: string;
  variant?: string;
}

export default function ThemedButtonAllManual(_props: ThemedButtonAllManualProps): JSX.Element {
  const props: ThemedButtonAllManualProps & { label: string; variant: string } = {
    ..._props,
    label: _props.label ?? 'Click me',
    variant: _props.variant ?? 'primary',
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, variant, ...rest } = _props as ThemedButtonAllManualProps & Record<string, unknown>;
    void label; void variant;
    return rest;
  })();

  return (
    <>
    <button style={{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }} {...attrs} className={clsx(clsx(styles.btn, props.variant), (attrs.className as string | undefined))} {...attrs} data-rozie-s-de172510="">
      {props.label}
    </button>
    </>
  );
}
