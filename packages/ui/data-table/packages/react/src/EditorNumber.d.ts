import type { ReactNode } from 'react';

export interface EditorNumberProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

declare function EditorNumber(props: EditorNumberProps): JSX.Element;
export default EditorNumber;
