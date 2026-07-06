import type { JSX } from 'solid-js';
import { createSignal, onCleanup, onMount, splitProps } from 'solid-js';

interface DestructuredMountLocalCleanupProps {}

export default function DestructuredMountLocalCleanup(_props: DestructuredMountLocalCleanupProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [ticks, setTicks] = createSignal(0);
  onMount(() => {
    const {
      timer
    } = {
      timer: setInterval(() => {
        setTicks(ticks() + 1);
      }, 1000)
    };
    onCleanup(() => clearInterval(timer));
  });

  return (
    <>
    <div {...attrs} class={"ticks" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-8b5f2e3e="">{ticks()}</div>
    </>
  );
}
