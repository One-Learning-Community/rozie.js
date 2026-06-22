import type { ReactNode } from 'react';

export interface EditorCheckboxProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

declare function EditorCheckbox(props: EditorCheckboxProps): JSX.Element;
export default EditorCheckbox;
