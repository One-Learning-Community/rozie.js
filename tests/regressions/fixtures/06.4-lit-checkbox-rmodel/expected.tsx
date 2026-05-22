import { useControllableState } from '@rozie/runtime-react';
import styles from './CheckboxRModel.module.css';

interface CheckboxRModelProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export default function CheckboxRModel(props: CheckboxRModelProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { checked, defaultValue, onCheckedChange, defaultChecked, ...rest } = props as CheckboxRModelProps & Record<string, unknown>;
    void checked; void defaultValue; void onCheckedChange; void defaultChecked;
    return rest;
  })();
  const [checked, setChecked] = useControllableState({
    value: props.checked,
    defaultValue: props.defaultChecked ?? false,
    onValueChange: props.onCheckedChange,
  });

  return (
    <>
    <label className={styles.toggle} {...attrs} data-rozie-s-5898a126="">
      
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} data-rozie-s-5898a126="" />
      <span data-rozie-s-5898a126="">Enabled</span>
    </label>
    </>
  );
}
