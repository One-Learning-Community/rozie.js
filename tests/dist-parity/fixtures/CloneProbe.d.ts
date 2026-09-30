import type { ReactNode } from 'react';

export interface CloneProbeProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function CloneProbe(props: CloneProbeProps): JSX.Element;
export default CloneProbe;
