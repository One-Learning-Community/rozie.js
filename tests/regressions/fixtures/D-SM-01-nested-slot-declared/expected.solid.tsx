import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NestedSlotDeclaredProps {
  wrapperSlot?: JSX.Element;
  innerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function NestedSlotDeclared(_props: NestedSlotDeclaredProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <style>{`.outer[data-rozie-s-3bc5be6c] { display: block; }`}</style>
    <>
    <div {...attrs} class={"outer" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...attrs} data-rozie-s-3bc5be6c="">
      
      {(_props.wrapperSlot ?? _props.slots?.['wrapper']?.({})) ?? <div class={"wrapper-fallback"} data-rozie-s-3bc5be6c="">
          {(_props.innerSlot ?? _props.slots?.['inner']?.({}))}
        </div>}
    </div>
    </>
    </>
  );
}
