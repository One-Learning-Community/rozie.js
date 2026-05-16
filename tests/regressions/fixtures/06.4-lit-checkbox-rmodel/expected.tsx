import { useControllableState } from '@rozie/runtime-react';
import styles from './CheckboxRModel.module.css';

interface CheckboxRModelProps {
  checked?: boolean;
  defaultValue?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export default function CheckboxRModel(props: CheckboxRModelProps): JSX.Element {
  const [checked, setChecked] = useControllableState({
    value: props.checked,
    defaultValue: props.defaultValue ?? false,
    onValueChange: props.onCheckedChange,
  });

  return (
    <>
    <label className={styles.toggle} data-rozie-s-5898a126="">
      
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} data-rozie-s-5898a126="" />
      <span data-rozie-s-5898a126="">Enabled</span>
    </label>
    </>
  );
}
