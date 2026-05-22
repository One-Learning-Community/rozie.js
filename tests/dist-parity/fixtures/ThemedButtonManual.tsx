import { clsx } from '@rozie/runtime-react';
import styles from './ThemedButtonManual.module.css';

interface ThemedButtonManualProps {
  label?: string;
  variant?: string;
}

export default function ThemedButtonManual(_props: ThemedButtonManualProps): JSX.Element {
  const props: ThemedButtonManualProps & { label: string; variant: string } = {
    ..._props,
    label: _props.label ?? 'Click me',
    variant: _props.variant ?? 'primary',
  };

  return (
    <>
    <button className={clsx(styles.btn, props.variant)} style={{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }} {...attrs} data-rozie-s-671f0616="">
      {props.label}
    </button>
    </>
  );
}
