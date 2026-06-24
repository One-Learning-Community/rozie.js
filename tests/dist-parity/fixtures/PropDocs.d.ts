import type { ReactNode } from 'react';

export interface PropDocsProps {
  /**
   * The visible text label for the control.
   * @deprecated Use `text` instead — `label` is retained only for back-compat.
   * @example
   * <PropDocs label="Save" />
   */
  label?: string;
  count?: number;
}

declare function PropDocs(props: PropDocsProps): JSX.Element;
export default PropDocs;
