/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/sortable-list.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`getInstance`, `toArray`, `sort`, `option` — the Phase-21 `$expose({ ... })`
 * call in SortableList.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121): none of these 4 verbs collides with a declared
 * prop name (items/itemKey/handle/group/animation/disabled/options/labelFor/
 * ghostClass/chosenClass/dragClass/filter/easing/forceFallback/swapThreshold/
 * cloneable) or with the 5 events (change/add/remove/start/end). `option` is a
 * distinct identifier from the `options` prop, so there is no collision.
 */
export const handleManifest = {
  getInstance:
    'Return the underlying SortableJS instance for direct API access (the raw-engine escape hatch — `save`, `closest`, etc. are one hop away). `null` before mount and after destroy.',
  toArray:
    'Return the current order as an array of `data-id` strings (each row carries `data-id="<key>"`). `[]` before mount.',
  sort: 'Reorder the list by an array of `data-id` strings — `sort(order, useAnimation = true)`.',
  option:
    'Read or set a live SortableJS option — `option(name)` gets, `option(name, value)` sets. The runtime escape hatch for options beyond the curated props.',
};

export default handleManifest;
