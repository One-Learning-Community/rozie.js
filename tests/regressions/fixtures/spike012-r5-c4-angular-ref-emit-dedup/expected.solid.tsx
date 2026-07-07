import type { JSX } from 'solid-js';
import { createSignal, onMount, splitProps } from 'solid-js';

interface RefEmitDedupProps {
  onSave?: (...args: unknown[]) => void;
}

export default function RefEmitDedup(_props: RefEmitDedupProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);
  onMount(() => {
    void (saveRef as HTMLElement);
  });
  let saveRef: HTMLElement | null = null;

  function go(): void {
    _props.onSave?.(n());
  }

  return (
    <>
    <div {...attrs} class={"red" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-ab8a0b4b="">
      <div ref={(el) => { saveRef = el as HTMLElement; }} data-rozie-s-ab8a0b4b="">x</div>
      <button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { go(); }} data-rozie-s-ab8a0b4b="">go</button>
    </div>
    </>
  );
}
