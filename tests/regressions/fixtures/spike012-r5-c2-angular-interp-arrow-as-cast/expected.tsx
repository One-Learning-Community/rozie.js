import { useState } from 'react';

interface InterpArrowAsCastProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {}

export default function InterpArrowAsCast(props: InterpArrowAsCastProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [items, setItems] = useState([1, 2, 3]);

  function noop(): void {}

  return (
    <>
    <div {...attrs} data-rozie-s-8efa13ea="">{items.filter(x => x as number > 1).length}</div>
    </>
  );
}
