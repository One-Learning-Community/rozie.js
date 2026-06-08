/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/cropper.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in Cropper.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): none of these verbs
 * collides with an emitted event name (NO bare `crop`/`zoom` — exposed as
 * `showCropBox`/`zoomTo`/`zoomBy`), the React `data`-model auto-setter (NO
 * `setData` — set via the two-way `data` binding; `getData` reads it), or a Lit
 * reserved lifecycle name.
 */
export const handleManifest = {
  getCropper: 'Return the underlying Cropper.js instance for direct API access (the engine escape hatch).',
  getData: 'Return the current crop box as `{ x, y, width, height, rotate, scaleX, scaleY }`, or null before mount.',
  getCroppedCanvas:
    'Return an `HTMLCanvasElement` drawn from the cropped area — `getCroppedCanvas(opts?)` (Cropper `GetCroppedCanvasOptions`). Null before mount.',
  getCroppedDataURL:
    'Convenience: the cropped area as a `toDataURL()` string — `getCroppedDataURL(opts?)` (same options as getCroppedCanvas). Null before mount.',
  reset: 'Reset the image and crop box to their initial states.',
  clear: 'Clear (hide) the crop box. Pair with `showCropBox()` to re-show it.',
  showCropBox: 'Show the crop box (Cropper `crop()`) — re-enables cropping after `clear()`.',
  replace: 'Replace the image with a new source URL — `replace(url)`.',
  rotateTo: 'Rotate the image to an absolute degree — `rotateTo(deg)`.',
  rotateBy: 'Rotate the image by a relative degree (Cropper `rotate()`) — `rotateBy(deg)`.',
  zoomTo: 'Zoom the canvas to an absolute ratio — `zoomTo(ratio)`.',
  zoomBy: 'Zoom the canvas by a relative ratio (Cropper `zoom()`) — `zoomBy(ratio)`.',
  scaleX: 'Flip/scale the image horizontally — `scaleX(n)` (e.g. -1 to flip).',
  scaleY: 'Flip/scale the image vertically — `scaleY(n)` (e.g. -1 to flip).',
  enable: 'Enable (unfreeze) the cropper.',
  disable: 'Disable (freeze) the cropper.',
  setAspectRatio: 'Set the crop box aspect ratio — `setAspectRatio(ratio)` (NaN for free).',
  setDragMode: "Set the drag mode — `setDragMode('crop' | 'move' | 'none')`.",
};

export default handleManifest;
