import type { ReactNode } from 'react';

export interface EditorSelectProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
  options?: unknown[];
}

declare function EditorSelect(props: EditorSelectProps): JSX.Element;
export default EditorSelect;
