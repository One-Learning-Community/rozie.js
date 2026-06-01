import type { ComponentRef } from 'react';
import Flatpickr from './Flatpickr';

export { Flatpickr };
export { default } from './Flatpickr';

/** The `$expose` imperative handle received via `ref` — { clear, openPicker, closePicker, selectDate, jumpToDate }. */
export type FlatpickrHandle = ComponentRef<typeof Flatpickr>;
