---
"@rozie/runtime-angular": patch
---

Fast key presses no longer drop updates on Angular. A two-way (`model: true`) prop that the consumer binds read the old value until Angular's next change detection, a task after the write, and keyboard events run before it. A component that reads its value and writes the next one (number-field ArrowUp, sortable-list ArrowDown) built each press on the stale value: ten quick ArrowUp presses on a number field moved it by one, and sortable-list keyboard reordering moved the wrong row. A write is now held until the consumer answers; any value the consumer sends wins at once, and a refused write still goes back to the consumer's value one task later.
