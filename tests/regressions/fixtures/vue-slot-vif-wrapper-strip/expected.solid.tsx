import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';

interface PresenceSlotFallbackProps {
  title?: string;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function PresenceSlotFallback(_props: PresenceSlotFallbackProps): JSX.Element {
  const _merged = mergeProps({ title: '' }, _props);
  const [local, rest] = splitProps(_merged, ['title', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <style>{`.panel[data-rozie-s-224e77e7] { border: 1px solid rgba(0, 0, 0, 0.1); }`}</style>
    <>
    <section class={"panel"} data-rozie-s-224e77e7="">
      {<Show when={_props.headerSlot || local.title}><header data-rozie-s-224e77e7="">
        
        {_props.headerSlot ?? local.title}
      </header></Show>}<div class={"body"} data-rozie-s-224e77e7="">
        {resolved()}
      </div>
    </section>
    </>
    </>
  );
}
