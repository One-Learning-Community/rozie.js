import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface RModelNumberTrimProps {}

export default function RModelNumberTrim(_props: RModelNumberTrimProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  const [quantity, setQuantity] = createSignal(0);

  return (
    <>
    <style>{`.rmodel-number-trim[data-rozie-s-dfdb7742] { display: inline-flex; flex-direction: column; gap: 0.25rem; }
    .echo[data-rozie-s-dfdb7742] { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }`}</style>
    <>
    <div class={"rmodel-number-trim"} data-rozie-s-dfdb7742="">
      <input type="text" placeholder="Enter a quantity" value={quantity()} onInput={e => setQuantity((__v => { const __n = parseFloat(__v); return isNaN(__n) ? __v : __n; })(e.currentTarget.value.trim()))} data-rozie-s-dfdb7742="" />
      <p class={"echo"} data-rozie-s-dfdb7742="">Quantity: {quantity()}</p>
    </div>
    </>
    </>
  );
}
