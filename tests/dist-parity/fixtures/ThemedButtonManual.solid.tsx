import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';

interface ThemedButtonManualProps {
  label?: string;
  variant?: string;
}

export default function ThemedButtonManual(_props: ThemedButtonManualProps): JSX.Element {
  const _merged = mergeProps({ label: 'Click me', variant: 'primary' }, _props);
  const [local, attrs] = splitProps(_merged, ['label', 'variant']);

  return (
    <>
    <style>{`.btn[data-rozie-s-671f0616] {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      background: var(--btn-bg, #3b82f6);
      color: var(--btn-fg, #ffffff);
      font: inherit;
      cursor: pointer;
    }
    .btn[data-rozie-s-671f0616]:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }`}</style>
    <>
    <button class={"btn" + " " + local.variant} style={{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }} {...attrs} data-rozie-s-671f0616="">
      {local.label}
    </button>
    </>
    </>
  );
}
