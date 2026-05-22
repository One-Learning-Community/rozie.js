import { useState } from 'react';
import styles from './RModelNumberTrim.module.css';

interface RModelNumberTrimProps {}

export default function RModelNumberTrim(props: RModelNumberTrimProps): JSX.Element {
  const [quantity, setQuantity] = useState(0);

  return (
    <>
    <div className={styles["rmodel-number-trim"]} data-rozie-s-dfdb7742="">
      <input type="text" placeholder="Enter a quantity" value={quantity} onChange={e => setQuantity(Number.isNaN(Number.parseFloat(e.target.value.trim())) ? e.target.value.trim() : Number.parseFloat(e.target.value.trim()))} data-rozie-s-dfdb7742="" />
      <p className={styles.echo} data-rozie-s-dfdb7742="">Quantity: {quantity}</p>
    </div>
    </>
  );
}
