import type { ReactNode } from 'react';

export interface UpdateExpressionProbeProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'value' | 'defaultValue' | 'onValueChange' | 'children' | 'dangerouslySetInnerHTML'> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (next: number) => void;
}

declare function UpdateExpressionProbe(props: UpdateExpressionProbeProps): JSX.Element;
export default UpdateExpressionProbe;
