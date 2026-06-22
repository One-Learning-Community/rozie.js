import type { ReactNode } from 'react';

export interface EditorDateProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

declare function EditorDate(props: EditorDateProps): JSX.Element;
export default EditorDate;
