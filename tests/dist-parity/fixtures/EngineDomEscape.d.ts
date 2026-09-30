import type { ReactNode } from 'react';

export interface EngineDomEscapeProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function EngineDomEscape(props: EngineDomEscapeProps): JSX.Element;
export default EngineDomEscape;
