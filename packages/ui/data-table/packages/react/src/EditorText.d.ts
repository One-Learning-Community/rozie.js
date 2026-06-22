import type { ReactNode } from 'react';

export interface EditorTextProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

declare function EditorText(props: EditorTextProps): JSX.Element;
export default EditorText;
