import type { ReactNode } from 'react';

export interface UpdateExpressionProbeProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (next: number) => void;
}

declare function UpdateExpressionProbe(props: UpdateExpressionProbeProps): JSX.Element;
export default UpdateExpressionProbe;
