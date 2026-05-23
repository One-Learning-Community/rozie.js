import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface RModelLazyProps {}

export default function RModelLazy(_props: RModelLazyProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [draft, setDraft] = createSignal('');

  return (
    <>
    <style>{`.rmodel-lazy[data-rozie-s-34fe9f5a] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
    .echo[data-rozie-s-34fe9f5a] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }`}</style>
    <>
    <div {...attrs} class={"rmodel-lazy" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...attrs} data-rozie-s-34fe9f5a="">
      <input type="text" placeholder="Commit on blur" value={draft()} onChange={e => setDraft(e.currentTarget.value)} data-rozie-s-34fe9f5a="" />
      <p class={"echo"} data-rozie-s-34fe9f5a="">Committed: {draft()}</p>
    </div>
    </>
    </>
  );
}
