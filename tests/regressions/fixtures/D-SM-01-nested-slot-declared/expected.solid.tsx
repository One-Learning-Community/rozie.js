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
    <style>{`.outer { display: block; }`}</style>
    <>
    <div class={"outer"}>
      
      {_props.wrapperSlot ?? <div class={"wrapper-fallback"}>
          {_props.innerSlot}
        </div>}
    </div>
    </>
    </>
  );
}
