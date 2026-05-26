import { clsx } from '@rozie/runtime-react';
import styles from './ThemedButtonManual.module.css';

interface ThemedButtonManualProps {
  label?: string;
  variant?: string;
}

export default function ThemedButtonManual(_props: ThemedButtonManualProps): JSX.Element {
  const props: Omit<ThemedButtonManualProps, 'label' | 'variant'> & { label: string; variant: string } = {
    ..._props,
    label: _props.label ?? 'Click me',
    variant: _props.variant ?? 'primary',
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, variant, ...rest } = _props as ThemedButtonManualProps & Record<string, unknown>;
    void label; void variant;
    return rest;
  })();

  return (
    <>
    <button style={{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }} {...attrs} className={clsx(clsx(styles.btn, props.variant), (attrs.className as string | undefined))} data-rozie-s-671f0616="">
      {props.label}
    </button>
    </>
  );
}
