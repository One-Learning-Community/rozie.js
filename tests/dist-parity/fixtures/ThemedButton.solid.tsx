import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('ThemedButton-7914ecaa', `.btn[data-rozie-s-7914ecaa] {
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
.btn[data-rozie-s-7914ecaa]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`);

interface ThemedButtonProps {
  label?: string;
  variant?: string;
}

export default function ThemedButton(_props: ThemedButtonProps): JSX.Element {
  const _merged = mergeProps({ label: 'Click me', variant: 'primary' }, _props);
  const [local, attrs] = splitProps(_merged, ['label', 'variant']);

  return (
    <>
    <button style={{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }} {...attrs} class={"btn" + " " + (local.variant) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-7914ecaa="">
      {local.label}
    </button>
    </>
  );
}
