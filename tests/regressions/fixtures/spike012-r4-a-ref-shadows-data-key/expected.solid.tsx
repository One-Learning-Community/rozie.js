import type { JSX } from 'solid-js';
import { createSignal, onMount, splitProps } from 'solid-js';

interface RefShadowsDataKeyProps {}

export default function RefShadowsDataKey(_props: RefShadowsDataKeyProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [box, setBox] = createSignal(0);
  const [n, setN] = createSignal(0);
  onMount(() => {
    setN((box$localRef as HTMLElement).childElementCount + box());
  });
  let box$localRef: HTMLElement | null = null;

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-89956078="">
      <div ref={(el) => { box$localRef = el as HTMLElement; }} data-rozie-s-89956078="">x</div>
    </div>
    </>
  );
}
