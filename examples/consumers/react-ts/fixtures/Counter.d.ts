import type { ReactNode } from 'react';

export interface CounterProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'value' | 'defaultValue' | 'onValueChange' | 'step' | 'min' | 'max' | 'children' | 'dangerouslySetInnerHTML'> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

declare function Counter(props: CounterProps): JSX.Element;
export default Counter;
