import type { ReactNode } from 'react';

export interface ToolbarProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function Toolbar(props: ToolbarProps): JSX.Element;
export default Toolbar;
