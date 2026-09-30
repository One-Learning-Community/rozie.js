import type { ReactNode } from 'react';

export interface ClassSelectorProbeProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function ClassSelectorProbe(props: ClassSelectorProbeProps): JSX.Element;
export default ClassSelectorProbe;
