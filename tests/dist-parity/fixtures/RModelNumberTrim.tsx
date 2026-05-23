import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './RModelNumberTrim.module.css';

interface RModelNumberTrimProps {}

export default function RModelNumberTrim(props: RModelNumberTrimProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [quantity, setQuantity] = useState(0);

  return (
    <>
    <div {...attrs} className={clsx(styles["rmodel-number-trim"], (attrs.className as string | undefined))} data-rozie-s-dfdb7742="">
      <input type="text" placeholder="Enter a quantity" value={quantity} onChange={e => setQuantity(Number.isNaN(Number.parseFloat(e.target.value.trim())) ? e.target.value.trim() : Number.parseFloat(e.target.value.trim()))} data-rozie-s-dfdb7742="" />
      <p className={styles.echo} data-rozie-s-dfdb7742="">Quantity: {quantity}</p>
    </div>
    </>
  );
}
