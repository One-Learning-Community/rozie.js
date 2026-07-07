import type { JSX } from 'solid-js';
import { createSignal, onMount, splitProps } from 'solid-js';

interface RefSuffixCollisionProps {}

export default function RefSuffixCollision(_props: RefSuffixCollisionProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);
  onMount(() => {
    setN((boxRef as HTMLElement).childElementCount + boxRef);
  });
  let boxRef: HTMLElement | null = null;

  const boxRef$local = 7;

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-54e18fa1=""><div ref={(el) => { boxRef = el as HTMLElement; }} data-rozie-s-54e18fa1="">x</div></div>
    </>
  );
}
