import type { JSX } from 'solid-js';
import { createSignal, onMount, splitProps } from 'solid-js';

interface RefSuffixCollisionProps {}

export default function RefSuffixCollision(_props: RefSuffixCollisionProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);
  onMount(() => {
    setN((box2Ref as HTMLElement).childElementCount + boxRef);
  });
  let box2Ref: HTMLElement | null = null;

  const boxRef = 7;

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-3039287c=""><div ref={(el) => { box2Ref = el as HTMLElement; }} data-rozie-s-3039287c="">x</div></div>
    </>
  );
}
