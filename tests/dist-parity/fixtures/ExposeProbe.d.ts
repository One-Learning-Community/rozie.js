import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ExposeProbeProps {
}

export interface ExposeProbeHandle {
  reset(): void;
  focus(): void;
}

declare const ExposeProbe: React.ForwardRefExoticComponent<ExposeProbeProps & React.RefAttributes<ExposeProbeHandle>>;
export default ExposeProbe;
