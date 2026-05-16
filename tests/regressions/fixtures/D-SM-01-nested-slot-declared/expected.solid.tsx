import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NestedSlotDeclaredProps {
  wrapperSlot?: JSX.Element;
  innerSlot?: JSX.Element;
}

export default function NestedSlotDeclared(_props: NestedSlotDeclaredProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <style>{`.outer[data-rozie-s-3bc5be6c] { display: block; }`}</style>
    <>
    <div class={"outer"} data-rozie-s-3bc5be6c="">
      
      {_props.wrapperSlot ?? <div class={"wrapper-fallback"} data-rozie-s-3bc5be6c="">
          {_props.innerSlot}
        </div>}
    </div>
    </>
    </>
  );
}
