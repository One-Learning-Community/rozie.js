import { useCallback, useState } from 'react';

interface EventLoopVarShadowProps {}

export default function EventLoopVarShadow(props: EventLoopVarShadowProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [items, setItems] = useState([{
    id: 'a',
    label: 'A'
  }, {
    id: 'b',
    label: 'B'
  }]);

  const removeItem = useCallback((id: any) => {
    setItems(prev => prev.filter((x: any) => x.id !== id));
  }, []);

  return (
    <>
    <ul {...attrs} data-rozie-s-a955b18d="">
      {items.map((e) => <li key={e.id} data-rozie-s-a955b18d="">
        <span data-rozie-s-a955b18d="">{e.label}</span>
        
        <button type="button" onClick={($event) => { removeItem(e.id); }} data-rozie-s-a955b18d="">×</button>
      </li>)}
    </ul>
    </>
  );
}
