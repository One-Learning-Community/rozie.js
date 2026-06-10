import type { ReactNode } from 'react';

export interface LayerProps {
  id: string;
  type?: string;
  paint?: unknown;
  layout?: unknown;
  source?: string;
  beforeId?: string;
}

declare function Layer(props: LayerProps): JSX.Element;
export default Layer;
