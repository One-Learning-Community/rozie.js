import type { ReactNode } from 'react';
import Inner from './inner';

interface WrapperProps {
  renderTitle?: ReactNode;
  children?: ReactNode;
}

export default function Wrapper(props: WrapperProps): JSX.Element {
  return (
    <>
    <Inner renderHeader={() => (<>
        {props.renderTitle ?? "default title"}
      </>)} children={<>{props.children ?? "default body"}</>} />
    </>
  );
}
