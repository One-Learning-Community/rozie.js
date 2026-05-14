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
    <style>{`.panel { border: 1px solid rgba(0, 0, 0, 0.1); }`}</style>
    <>
    <section class={"panel"}>
      {<Show when={_props.headerSlot || local.title}><header>
        
        {_props.headerSlot ?? local.title}
      </header></Show>}<div class={"body"}>
        {resolved()}
      </div>
    </section>
    </>
    </>
  );
}
