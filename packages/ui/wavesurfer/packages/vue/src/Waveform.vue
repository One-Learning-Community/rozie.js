<template>

<div class="rozie-waveform" ref="containerRef" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The audio URL the waveform loads. Bound at construction and reconciled at runtime — changing it calls the engine `load(url)`.
     * @example
     * <Waveform :src="audioUrl" r-model:currentTime="time" />
     */
    src?: string | null;
    /**
     * The waveform height in pixels. Reconciled at runtime via `setOptions`.
     */
    height?: number;
    /**
     * The color of the unplayed portion of the waveform. Reconciled at runtime via `setOptions`.
     */
    waveColor?: string;
    /**
     * The color of the played (progress) portion of the waveform. Reconciled at runtime via `setOptions`.
     */
    progressColor?: string;
    /**
     * The color of the playback cursor. Reconciled at runtime via `setOptions`.
     */
    cursorColor?: string;
    /**
     * The width of the playback cursor in pixels. Reconciled at runtime via `setOptions`.
     */
    cursorWidth?: number;
    /**
     * Draw the waveform as bars of this pixel width. `null` (default) renders a continuous waveform. Reconciled at runtime via `setOptions`.
     */
    barWidth?: Record<string, any> | null;
    /**
     * The pixel gap between bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
     */
    barGap?: Record<string, any> | null;
    /**
     * The corner radius of bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
     */
    barRadius?: Record<string, any> | null;
    /**
     * The minimum pixels-per-second zoom level. Reconciled at runtime via `zoom`.
     */
    minPxPerSec?: number;
    /**
     * Playback volume (`0`–`1`). Reconciled at runtime via `setVolume`.
     */
    volume?: number;
    /**
     * Playback speed multiplier. Reconciled at runtime via `setPlaybackRate`.
     */
    playbackRate?: number;
    /**
     * Begin playback as soon as the audio is ready. Construction-only.
     */
    autoplay?: boolean;
    /**
     * Normalize the waveform by its largest peak (wavesurfer's `normalize` option). Reconciled at runtime via `setOptions`.
     */
    normalizeAmplitude?: boolean;
    /**
     * Hide the horizontal scrollbar when the waveform is zoomed wider than its container. Construction-only.
     */
    hideScrollbar?: boolean;
    /**
     * Disable click/seek interaction with the waveform (the engine defaults to interactive). Construction-only.
     */
    disableInteraction?: boolean;
    /**
     * Disable drag-to-seek across the waveform (the engine defaults to drag-seekable). Construction-only.
     */
    disableDragToSeek?: boolean;
    /**
     * Render a time-ruler beneath the waveform (the wavesurfer Timeline plugin). Construction-only in v1 — toggling after mount is a no-op.
     */
    timeline?: boolean;
    /**
     * Show a hover cursor with a time label as the pointer moves over the waveform (the wavesurfer Hover plugin). Construction-only in v1 — toggling after mount is a no-op.
     */
    hover?: boolean;
    /**
     * The line color of the Hover plugin cursor (only applies when `hover` is enabled). Construction-only in v1.
     */
    hoverColor?: string | null;
    /**
     * Allow drawing new regions by dragging over empty waveform space (Regions plugin `enableDragSelection`). Requires `regions` to be an array. Construction-only in v1.
     */
    dragToCreateRegions?: boolean;
    /**
     * Default fill color for drag-created regions (only applies when `dragToCreateRegions` is on). Construction-only in v1.
     */
    regionColor?: string | null;
    /**
     * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`peaks`, `duration`, `sampleRate`, `mediaControls`, `splitChannels`, …).
     */
    options?: Record<string, any>;
  }>(),
  { src: null, height: 128, waveColor: '#8a2be2', progressColor: '#5a189a', cursorColor: '#333333', cursorWidth: 1, barWidth: null, barGap: null, barRadius: null, minPxPerSec: 1, volume: 1, playbackRate: 1, autoplay: false, normalizeAmplitude: false, hideScrollbar: false, disableInteraction: false, disableDragToSeek: false, timeline: false, hover: false, hoverColor: null, dragToCreateRegions: false, regionColor: null, options: () => ({}) }
);

/**
 * The interactive regions as an array of `{ id?, start, end?, content?, color?, drag?, resize? }`. Providing an array (even empty) registers the Regions plugin at construction. Two-way (`model: true`): user create / drag / resize / remove writes the updated array back (round-trip-guarded); a consumer write reconciles the live regions (add / update / remove by `id`).
 */
const regions = defineModel<unknown>('regions', { default: undefined });
/**
 * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
 */
const currentTime = defineModel<unknown>('currentTime', { default: undefined });

const emit = defineEmits<{
  ready: [...args: any[]];
  playing: [...args: any[]];
  paused: [...args: any[]];
  finished: [...args: any[]];
  timeupdate: [...args: any[]];
  seeking: [...args: any[]];
  interaction: [...args: any[]];
  loading: [...args: any[]];
  error: [...args: any[]];
  regionCreated: [...args: any[]];
  regionUpdated: [...args: any[]];
  regionRemoved: [...args: any[]];
  regionClicked: [...args: any[]];
  regionIn: [...args: any[]];
  regionOut: [...args: any[]];
}>();

const containerRef = ref<HTMLElement>();

// Default import is `WaveSurfer` (≠ the component name `Waveform`, so no import⇄
// component collision — Cropper had to alias; we don't). Plugin factories are
// separate v7 entry points.
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import HoverPlugin from 'wavesurfer.js/plugins/hover';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';

// null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
// strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
// and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
// splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
// be out of scope in teardown (TS2304).
// null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
// strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
// and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
// splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
// be out of scope in teardown (TS2304).
let ws: any = null;
// Regions plugin instance + its two guards (all top-level for the Solid teardown
// scope, same reason as `ws`). `regionsReady` gates the reconcile until the audio
// is decoded (addRegion needs a known duration). `reconciling` is the re-entrancy
// guard: while a controlled reconcile mutates the engine, the region-event
// handlers must NOT emit or write back (that would fight the incoming update) —
// only genuine USER edits (outside reconcile) drive the model + emits.
// Regions plugin instance + its two guards (all top-level for the Solid teardown
// scope, same reason as `ws`). `regionsReady` gates the reconcile until the audio
// is decoded (addRegion needs a known duration). `reconciling` is the re-entrancy
// guard: while a controlled reconcile mutates the engine, the region-event
// handlers must NOT emit or write back (that would fight the incoming update) —
// only genuine USER edits (outside reconcile) drive the model + emits.
let regionsPlugin: any = null;
let regionsReady = false;
let reconciling = false;

// Serialize an engine Region to the plain descriptor shape the two-way `regions`
// model carries. Pure (no sigils) — safe at top level.
// Serialize an engine Region to the plain descriptor shape the two-way `regions`
// model carries. Pure (no sigils) — safe at top level.
const serializeRegion = (r: any) => ({
  id: r.id,
  start: r.start,
  end: r.end,
  color: r.color,
  content: r.content && r.content.textContent ? r.content.textContent : undefined,
  drag: r.drag,
  resize: r.resize
});

// Value-equality guard (by id + rounded start/end) that stops the
// user-edit → writeback → $model.regions → $watch → reconcile loop from
// oscillating (the Cropper `sameData` idiom, generalized to a list).
// Value-equality guard (by id + rounded start/end) that stops the
// user-edit → writeback → $model.regions → $watch → reconcile loop from
// oscillating (the Cropper `sameData` idiom, generalized to a list).
const sameRegions = (list: any, engineRegions: any) => {
  if (!Array.isArray(list) || list.length !== engineRegions.length) return false;
  const key = (r: any) => `${r.id}:${Math.round((r.start ?? 0) * 1000)}:${Math.round((r.end ?? 0) * 1000)}`;
  const a = list.map(key).sort();
  const b = engineRegions.map(key).sort();
  return a.every((k: any, i: any) => k === b[i]);
};

// Push the live engine regions back into the two-way `regions` model (serialized).
// No-op while `reconciling` — a controlled update must not echo back onto itself.
// Push the live engine regions back into the two-way `regions` model (serialized).
// No-op while `reconciling` — a controlled update must not echo back onto itself.
const writeBackRegions = () => {
  if (!regionsPlugin || reconciling) return;
  regions.value = regionsPlugin.getRegions().map(serializeRegion);
};

// Reconcile the live engine regions to match a consumer-provided descriptor list:
// update-by-id, add the new, remove the missing. Guarded by `reconciling` so the
// add/remove/setOptions calls don't trigger writeBackRegions mid-flight. If any
// region was added WITHOUT a consumer id, echo the engine state (now carrying the
// assigned ids) back once so the two-way binding gains them.
// Reconcile the live engine regions to match a consumer-provided descriptor list:
// update-by-id, add the new, remove the missing. Guarded by `reconciling` so the
// add/remove/setOptions calls don't trigger writeBackRegions mid-flight. If any
// region was added WITHOUT a consumer id, echo the engine state (now carrying the
// assigned ids) back once so the two-way binding gains them.
const reconcileRegions = (list: any) => {
  if (!regionsPlugin || !Array.isArray(list)) return;
  const current = regionsPlugin.getRegions();
  if (sameRegions(list, current)) return;
  reconciling = true;
  let addedWithoutId = false;
  // Build the id→region map with a no-arg `new Map()` (infers Map<any, any>) — a
  // `new Map(current.map(...))` over the `any`-typed engine list infers
  // Map<unknown, unknown>, so `.setOptions` would fail the strict leaf typecheck.
  const byId = new Map();
  for (const r of current as any) byId.set(r.id, r);
  const keep = new Set();
  for (const desc of list as any) {
    if (!desc || typeof desc.start !== 'number') continue;
    if (desc.id != null && byId.has(desc.id)) {
      byId.get(desc.id).setOptions({
        start: desc.start,
        end: desc.end,
        color: desc.color,
        drag: desc.drag,
        resize: desc.resize,
        content: desc.content
      });
      keep.add(desc.id);
    } else {
      const created = regionsPlugin.addRegion({
        id: desc.id,
        start: desc.start,
        end: desc.end,
        color: desc.color,
        content: desc.content,
        drag: desc.drag,
        resize: desc.resize
      });
      keep.add(created.id);
      if (desc.id == null) addedWithoutId = true;
    }
  }
  for (const r of current as any) {
    if (!keep.has(r.id)) r.remove();
  }
  reconciling = false;
  if (addedWithoutId) writeBackRegions();
};

// Build the engine. The whole config object is untyped (ws is `any`) so the
// constructor's options + event-callback params are unchecked against wavesurfer's
// strict types (the Cropper buildCropper idiom).
// Build the engine. The whole config object is untyped (ws is `any`) so the
// constructor's options + event-callback params are unchecked against wavesurfer's
// strict types (the Cropper buildCropper idiom).
const buildWaveSurfer = () => {
  let plugins = [];
  plugins = [];
  if (props.timeline) plugins.push(TimelinePlugin.create());
  if (props.hover) plugins.push(HoverPlugin.create({
    lineColor: props.hoverColor ?? undefined
  }));
  // Regions plugin is registered when `regions` is an array (even empty).
  regionsPlugin = null;
  if (Array.isArray(regions.value)) {
    regionsPlugin = RegionsPlugin.create();
    plugins.push(regionsPlugin);
  }
  let cfg: any = null;
  cfg = {
    ...props.options,
    container: containerRef.value,
    url: props.src ?? undefined,
    height: props.height,
    waveColor: props.waveColor,
    progressColor: props.progressColor,
    cursorColor: props.cursorColor,
    cursorWidth: props.cursorWidth,
    barWidth: props.barWidth ?? undefined,
    barGap: props.barGap ?? undefined,
    barRadius: props.barRadius ?? undefined,
    minPxPerSec: props.minPxPerSec,
    autoplay: props.autoplay,
    normalize: props.normalizeAmplitude,
    hideScrollbar: props.hideScrollbar,
    interact: !props.disableInteraction,
    dragToSeek: !props.disableDragToSeek,
    plugins: plugins
  };
  ws = WaveSurfer.create(cfg);

  // ── engine events → emits + the two-way currentTime writeback ──────────────
  ws.on('ready', (duration: any) => {
    // Regions can only be placed once the duration is known — do the initial
    // reconcile + drag-selection wiring here, then open the gate for prop-driven
    // reconciles. ($watch is lazy, so it never fires at mount; this is the only
    // place initial regions get added.)
    if (regionsPlugin) {
      regionsReady = true;
      if (props.dragToCreateRegions) {
        regionsPlugin.enableDragSelection({
          color: props.regionColor ?? undefined
        });
      }
      reconcileRegions(regions.value);
    }
    emit('ready', duration);
  });
  ws.on('play', () => emit('playing'));
  ws.on('pause', () => emit('paused'));
  ws.on('finish', () => emit('finished'));
  ws.on('timeupdate', (t: any) => {
    // Echo the live position into the two-way model, then emit. The reverse
    // $watch below is value-equality-guarded, so this write does not loop.
    currentTime.value = t;
    emit('timeupdate', t);
  });
  ws.on('seeking', (t: any) => emit('seeking', t));
  ws.on('interaction', (t: any) => emit('interaction', t));
  ws.on('loading', (percent: any) => emit('loading', percent));
  ws.on('error', (err: any) => emit('error', err));

  // ── regions plugin events → emits + two-way `regions` writeback ────────────
  // Each is a no-op during a controlled reconcile (the `reconciling` guard) so a
  // programmatic add/update/remove does not echo back or double-emit; only genuine
  // user gestures (drag-create, drag/resize, delete) drive the model + emits.
  if (regionsPlugin) {
    regionsPlugin.on('region-created', (region: any) => {
      if (reconciling) return;
      emit('regionCreated', serializeRegion(region));
      writeBackRegions();
    });
    regionsPlugin.on('region-updated', (region: any) => {
      if (reconciling) return;
      emit('regionUpdated', serializeRegion(region));
      writeBackRegions();
    });
    regionsPlugin.on('region-removed', (region: any) => {
      if (reconciling) return;
      emit('regionRemoved', serializeRegion(region));
      writeBackRegions();
    });
    regionsPlugin.on('region-clicked', (region: any) => {
      emit('regionClicked', serializeRegion(region));
    });
    // Playback entered/left a region — pure notifications (no writeback), so they
    // fire regardless of the reconcile guard. The events for active-segment
    // highlighting, transcript/karaoke sync, and loop-a-region.
    regionsPlugin.on('region-in', (region: any) => {
      emit('regionIn', serializeRegion(region));
    });
    regionsPlugin.on('region-out', (region: any) => {
      emit('regionOut', serializeRegion(region));
    });
  }
};
// ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
// Collision-clear across all six targets: canonical media verbs play/pause/
// playPause kept (the emits were renamed playing/paused/finished to dodge ROZ121);
// no setCurrentTime (React model auto-setter, ROZ524 — use setTime); no Lit
// reserved lifecycle name (update/render/firstUpdated/updated/willUpdate/requestUpdate).
function play() {
  if (ws) ws.play();
}
function pause() {
  if (ws) ws.pause();
}
function playPause() {
  if (ws) ws.playPause();
}
function stop() {
  if (ws) ws.stop();
}
function seekTo(progress: any) {
  if (ws) ws.seekTo(progress);
}
function setTime(seconds: any) {
  if (ws) ws.setTime(seconds);
}
function setVolume(v: any) {
  if (ws) ws.setVolume(v);
}
function setPlaybackRate(rate: any) {
  if (ws) ws.setPlaybackRate(rate);
}
function setZoom(pxPerSec: any) {
  if (ws) ws.zoom(pxPerSec);
}
function load(url: any) {
  if (ws) ws.load(url);
}
function isPlaying() {
  return ws ? ws.isPlaying() : false;
}
function getDuration() {
  return ws ? ws.getDuration() : 0;
}
function getCurrentTime() {
  return ws ? ws.getCurrentTime() : 0;
}
function getWaveSurfer() {
  return ws;
}
// Regions imperative surface (active only when the `regions` array registered the
// plugin). `addRegion` returns the created engine Region; NO `setRegions` verb
// (the React `regions`-model auto-setter, ROZ524 — drive the list via the two-way
// binding instead).
// Regions imperative surface (active only when the `regions` array registered the
// plugin). `addRegion` returns the created engine Region; NO `setRegions` verb
// (the React `regions`-model auto-setter, ROZ524 — drive the list via the two-way
// binding instead).
function addRegion(opts: any) {
  return regionsPlugin ? regionsPlugin.addRegion(opts) : null;
}
function clearRegions() {
  if (regionsPlugin) regionsPlugin.clearRegions();
}
function getRegions() {
  return regionsPlugin ? regionsPlugin.getRegions() : [];
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // $refs read ONLY here (ROZ123). The container is the engine's attach target.
  buildWaveSurfer();
  _cleanup_0 = () => {
    if (ws) ws.destroy();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.src, (v: any) => {
  if (ws && typeof v === 'string' && v) ws.load(v);
});
watch(() => props.height, (v: any) => {
  if (ws) ws.setOptions({
    height: v
  });
});
watch(() => props.waveColor, (v: any) => {
  if (ws) ws.setOptions({
    waveColor: v
  });
});
watch(() => props.progressColor, (v: any) => {
  if (ws) ws.setOptions({
    progressColor: v
  });
});
watch(() => props.cursorColor, (v: any) => {
  if (ws) ws.setOptions({
    cursorColor: v
  });
});
watch(() => props.cursorWidth, (v: any) => {
  if (ws) ws.setOptions({
    cursorWidth: v
  });
});
watch(() => props.barWidth, (v: any) => {
  if (ws) ws.setOptions({
    barWidth: v ?? undefined
  });
});
watch(() => props.barGap, (v: any) => {
  if (ws) ws.setOptions({
    barGap: v ?? undefined
  });
});
watch(() => props.barRadius, (v: any) => {
  if (ws) ws.setOptions({
    barRadius: v ?? undefined
  });
});
watch(() => props.normalizeAmplitude, (v: any) => {
  if (ws) ws.setOptions({
    normalize: v
  });
});
watch(() => props.volume, (v: any) => {
  if (ws && typeof v === 'number') ws.setVolume(v);
});
watch(() => props.playbackRate, (v: any) => {
  if (ws && typeof v === 'number') ws.setPlaybackRate(v);
});
watch(() => props.minPxPerSec, (v: any) => {
  if (ws && typeof v === 'number' && v > 0) ws.zoom(v);
});
watch(() => currentTime.value, (v: any) => {
  // Round-trip guard: skip if the incoming value already matches the engine
  // position (the timeupdate → $model → $watch echo), else seek.
  if (!ws || typeof v !== 'number') return;
  if (Math.abs(v - ws.getCurrentTime()) < 0.05) return;
  ws.setTime(v);
});
watch(() => regions.value, (list: any) => {
  // Controlled reconcile of the live regions to match the incoming list.
  // Gated on `regionsReady` (duration known) and value-equality-guarded inside
  // reconcileRegions so a writeback echo doesn't loop.
  if (!regionsReady) return;
  reconcileRegions(list);
});

defineExpose({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer, addRegion, clearRegions, getRegions });
</script>

<style scoped>
.rozie-waveform {
  width: 100%;
}
</style>
