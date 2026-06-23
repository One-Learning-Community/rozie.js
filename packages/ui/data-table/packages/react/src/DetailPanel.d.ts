import type { ReactNode } from 'react';

export interface DetailPanelProps {
  row?: (unknown) | null;
}

declare function DetailPanel(props: DetailPanelProps): JSX.Element;
export default DetailPanel;
