---
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-vue": patch
"@rozie-ui/date-picker-svelte": patch
"@rozie-ui/date-picker-angular": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-lit": patch
---

Fixed: repeated PageUp/PageDown could permanently drop keyboard focus out of the calendar grid onto the page body, most reproducibly on Angular (measured ~1-in-5 presses) but latent on every target.

Two independent bugs combined to cause this:

1. Landing the new focus position after a month swing was a single fixed-frame guess (wait one animation frame, then commit). On slower/loaded renders the framework hadn't yet committed the new month's day cells by then, and once that one guess missed, nothing ever retried — focus was lost for good. This is now outcome-keyed: it polls (bounded to 10 frames, matching the same pattern already used for data-table's virtualization) until the DOM actually shows the new month before committing the new focus target.
2. A second PageUp/PageDown pressed before the first press's landing had finished starting a second, independent landing sequence — the two could interleave and the older one could win with stale data. The newer press now cancels any still-in-flight landing from a previous press before starting its own.

No public API changes.
