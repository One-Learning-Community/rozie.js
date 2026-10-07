---
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-vue": patch
"@rozie-ui/date-picker-svelte": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-lit": patch
---

`focus()` now moves keyboard focus into the calendar when it is called from outside the picker. It used to update the active day (the roving `tabindex="0"` and its outline) but leave DOM focus where it was, unless focus was already inside the picker — so a picker opened in a popover could not be reached from the keyboard. In the months and years views `focus()` lands on that panel's current cell; it used to do nothing there.
