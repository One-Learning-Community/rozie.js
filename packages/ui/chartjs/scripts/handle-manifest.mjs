/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/chartjs.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`getChart`, `updateChart`, `resizeChart`, `resetChart`, `renderChart`,
 * `stopChart`, `clearChart`, `toBase64Image` — the Phase 21 `$expose({ ... })`
 * call in Chart.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline: the verb-style passthroughs are SUFFIXED with `Chart`
 * (`updateChart`, not `update`) because bare `update`/`render` collide with
 * LitElement's reactive-lifecycle methods (`update(changedProperties)` /
 * `render()`) and would shadow them on the Lit leaf — the Chart.js analog of
 * CodeMirror's setValue->replaceValue ($expose-verb-vs-framework-reserved-method)
 * lesson. The visibility/active-element family (setDatasetVisibility etc.) is
 * collision-clear as-is; the animated hide/show are suffixed `hideDataset`/
 * `showDataset` for convention + dataset-vs-element disambiguation. None of the
 * 15 names collides with the 11 props
 * (data/options/type/height/width/plugins/updateMode/redraw/ariaLabel/
 * datasetIdKey/destroyDelay) or the 3 emits (click/datasetClick/hover).
 */
export const handleManifest = {
  getChart:
    'Return the underlying Chart.js instance for direct API access (e.g. `getChart().update()`).',
  updateChart:
    'Re-render the chart after mutating its data/options — `updateChart(mode?)` (Chart.js `update` mode string).',
  resizeChart:
    'Resize the chart to its container, or to explicit dimensions — `resizeChart(width?, height?)`.',
  resetChart: 'Reset the chart elements to their initial (pre-animation) state.',
  renderChart: 'Re-render the chart from its current state without recalculating the scales.',
  stopChart: 'Stop the current animation loop (returns the instance).',
  clearChart: 'Clear the chart canvas (returns the instance).',
  toBase64Image:
    'Export the current canvas as a base64-encoded PNG data URL — `toBase64Image(type?, quality?)`.',
  setDatasetVisibility:
    'Set a dataset visible/hidden INSTANTLY — `setDatasetVisibility(datasetIndex, visible)`. Drives a custom external legend.',
  isDatasetVisible:
    'Whether a dataset is currently visible — `isDatasetVisible(datasetIndex)`. Pairs with `setDatasetVisibility` for custom-legend styling.',
  hideDataset:
    'Hide a dataset (or a single element) with ANIMATION — `hideDataset(datasetIndex, dataIndex?)` (Chart.js `hide`).',
  showDataset:
    'Show a previously-hidden dataset (or element) with ANIMATION — `showDataset(datasetIndex, dataIndex?)` (Chart.js `show`).',
  setActiveElements:
    'Programmatically set the active/hovered elements (open the tooltip from external interaction) — `setActiveElements([{ datasetIndex, index }])`.',
  getActiveElements:
    'Return the currently active/hovered elements (mirror hover state into sibling UI).',
  getDatasetMeta:
    'Return a dataset’s computed metadata (pixel geometry, controller) for positioning custom overlays — `getDatasetMeta(datasetIndex)`.',
};

export default handleManifest;
