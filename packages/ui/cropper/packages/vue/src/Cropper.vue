<template>

<div class="rozie-cropper" v-bind="$attrs">
  <img class="rozie-cropper-img" ref="imageElRef" :src="props.src" alt="" />
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ src?: string; aspectRatio?: number; viewMode?: number; dragMode?: string; disabled?: boolean; guides?: boolean; center?: boolean; background?: boolean; movable?: boolean; rotatable?: boolean; scalable?: boolean; zoomable?: boolean; zoomOnWheel?: boolean; cropBoxMovable?: boolean; cropBoxResizable?: boolean; autoCrop?: boolean; autoCropArea?: number; responsive?: boolean; options?: Record<string, any> }>(),
  { src: '', aspectRatio: NaN, viewMode: 0, dragMode: 'crop', disabled: false, guides: true, center: true, background: true, movable: true, rotatable: true, scalable: true, zoomable: true, zoomOnWheel: true, cropBoxMovable: true, cropBoxResizable: true, autoCrop: true, autoCropArea: 0.8, responsive: true, options: () => ({}) }
);

const data = defineModel<unknown>('data', { default: undefined });

const emit = defineEmits<{
  ready: [...args: any[]];
  cropstart: [...args: any[]];
  cropmove: [...args: any[]];
  cropend: [...args: any[]];
  crop: [...args: any[]];
  zoom: [...args: any[]];
}>();

const imageElRef = ref<HTMLElement>();

// The engine default-import is aliased `CropperEngine` — a bare `import Cropper`
// would collide with the component name `Cropper` (the rozie `name`), which the
// emitters declare as a local `Cropper` class/function across React/Solid/Lit
// (TS2440 import-conflict + a cascade of "not newable" errors). MapLibre dodged
// this for free (its import was `maplibregl` ≠ `MapLibre`); same-named single-word
// engines must alias.
import CropperEngine from 'cropperjs';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// instance is the Cropper (whose strict Options/Data types the loosely-typed
// .rozie props don't satisfy), and imgEl holds the <img> the engine attaches to
// (queried from the ref'd container in $onMount). Both are the `let x = null`
// idiom the engine-wrapper recipe relies on.
// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// instance is the Cropper (whose strict Options/Data types the loosely-typed
// .rozie props don't satisfy), and imgEl holds the <img> the engine attaches to
// (queried from the ref'd container in $onMount). Both are the `let x = null`
// idiom the engine-wrapper recipe relies on.
let instance: any = null;
let imgEl: any = null;
// Gate that suppresses the engine's SETUP-time `crop` events from writing the
// two-way `$model.data`. Cropper fires an initial `crop` with its OWN default box
// (autoCropArea) BEFORE the `ready` callback runs, and the `setData($props.data)`
// inside `ready` fires another. Writing those transient engine-internal boxes to
// `$model.data` is wrong — and on unified-model targets (Vue defineModel / Svelte
// $bindable / Angular model() signal, where the model read and write share ONE
// local) the pre-ready write CLOBBERS the very `$props.data` that `ready` then
// reads, so the consumer's initial `:data` crop box is lost and the default box is
// applied instead. (React/Solid read the external prop and Lit's property binding
// is controlled, so the write doesn't change their read — which is why only the
// template-emit family regressed.) We flip this true at the END of `ready`, after
// the initial box is applied, so only genuine post-init user crops drive the model.
// Gate that suppresses the engine's SETUP-time `crop` events from writing the
// two-way `$model.data`. Cropper fires an initial `crop` with its OWN default box
// (autoCropArea) BEFORE the `ready` callback runs, and the `setData($props.data)`
// inside `ready` fires another. Writing those transient engine-internal boxes to
// `$model.data` is wrong — and on unified-model targets (Vue defineModel / Svelte
// $bindable / Angular model() signal, where the model read and write share ONE
// local) the pre-ready write CLOBBERS the very `$props.data` that `ready` then
// reads, so the consumer's initial `:data` crop box is lost and the default box is
// applied instead. (React/Solid read the external prop and Lit's property binding
// is controlled, so the write doesn't change their read — which is why only the
// template-emit family regressed.) We flip this true at the END of `ready`, after
// the initial box is applied, so only genuine post-init user crops drive the model.
let cropReady = false;

// pure crop-box equality (rounded px + exact transform) — no sigils, safe at top
// level. The round-trip guard that stops the setData→crop→$model.data→$watch loop.
// pure crop-box equality (rounded px + exact transform) — no sigils, safe at top
// level. The round-trip guard that stops the setData→crop→$model.data→$watch loop.
const sameData = (a: any, b: any) => {
  if (!a || !b) return false;
  return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height) && a.rotate === b.rotate && a.scaleX === b.scaleX && a.scaleY === b.scaleY;
};

// Construct (or, on a future option change, re-construct) the engine. The whole
// options object is a null-let `any` so the constructor's 2nd arg is unchecked —
// the event-callback `e` params (CustomEvent) would otherwise fail the strict
// react/solid/lit tsc against Cropper's Options callback types (the MapLibre
// mapOptions idiom). restoreData re-applies the crop box if we ever rebuild.
// Construct (or, on a future option change, re-construct) the engine. The whole
// options object is a null-let `any` so the constructor's 2nd arg is unchecked —
// the event-callback `e` params (CustomEvent) would otherwise fail the strict
// react/solid/lit tsc against Cropper's Options callback types (the MapLibre
// mapOptions idiom). restoreData re-applies the crop box if we ever rebuild.
const buildCropper = (restoreData: any) => {
  let cfg: any = null;
  cfg = {
    ...props.options,
    aspectRatio: props.aspectRatio,
    viewMode: props.viewMode,
    dragMode: props.dragMode,
    guides: props.guides,
    center: props.center,
    background: props.background,
    movable: props.movable,
    rotatable: props.rotatable,
    scalable: props.scalable,
    zoomable: props.zoomable,
    zoomOnWheel: props.zoomOnWheel,
    cropBoxMovable: props.cropBoxMovable,
    cropBoxResizable: props.cropBoxResizable,
    autoCrop: props.autoCrop,
    autoCropArea: props.autoCropArea,
    responsive: props.responsive,
    ready: (e: any) => {
      if (restoreData) instance.setData(restoreData);else if (data.value) instance.setData(data.value);
      if (props.disabled) instance.disable();
      // Initial box is applied — from here on, real user crops drive the model.
      cropReady = true;
      emit('ready');
    },
    cropstart: (e: any) => emit('cropstart', {
      action: e.detail && e.detail.action
    }),
    cropmove: (e: any) => emit('cropmove', {
      action: e.detail && e.detail.action
    }),
    cropend: (e: any) => emit('cropend', {
      action: e.detail && e.detail.action
    }),
    // continuous crop → emit + drive the two-way model (guarded reverse $watch).
    crop: (e: any) => {
      // Suppress the engine's setup-time crops (the default box before `ready`, and
      // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
      // pre-init `crop` and (b) on unified-model targets clobber the consumer's
      // initial `:data`. Genuine user crops fire after `cropReady`.
      if (!cropReady) return;
      emit('crop', e.detail);
      if (e.detail) data.value = e.detail;
    },
    zoom: (e: any) => emit('zoom', {
      ratio: e.detail && e.detail.ratio,
      oldRatio: e.detail && e.detail.oldRatio
    })
  };
  instance = new CropperEngine(imgEl, cfg);
};
// ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
// 18 verbs, all collision-clear across the three classes documented at the top:
// no bare `crop`/`zoom` (event⇄verb ROZ121 — exposed as showCropBox/zoomTo/zoomBy),
// no `setData` (React data-model auto-setter ROZ524 — set via two-way `data`), and
// none match a Lit reserved lifecycle name (update/render/firstUpdated/updated/
// willUpdate/requestUpdate).
function getCropper() {
  return instance;
}
function getData() {
  return instance ? instance.getData() : null;
}
function getCroppedCanvas(opts: any) {
  return instance ? instance.getCroppedCanvas(opts) : null;
}
function getCroppedDataURL(opts: any) {
  if (!instance) return null;
  const canvas = instance.getCroppedCanvas(opts);
  return canvas ? canvas.toDataURL() : null;
}
function reset() {
  if (instance) instance.reset();
}
function clear() {
  if (instance) instance.clear();
}
function showCropBox() {
  if (instance) instance.crop();
}
function replace(url: any) {
  if (instance) instance.replace(url);
}
function rotateTo(deg: any) {
  if (instance) instance.rotateTo(deg);
}
function rotateBy(deg: any) {
  if (instance) instance.rotate(deg);
}
function zoomTo(ratio: any) {
  if (instance) instance.zoomTo(ratio);
}
function zoomBy(ratio: any) {
  if (instance) instance.zoom(ratio);
}
function scaleX(n: any) {
  if (instance) instance.scaleX(n);
}
function scaleY(n: any) {
  if (instance) instance.scaleY(n);
}
function enable() {
  if (instance) instance.enable();
}
function disable() {
  if (instance) instance.disable();
}
function setAspectRatio(ratio: any) {
  if (instance) instance.setAspectRatio(ratio);
}
function setDragMode(mode: any) {
  if (instance) instance.setDragMode(mode);
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
  // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
  // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
  // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
  imgEl = imageElRef.value;
  buildCropper(null);
  _cleanup_0 = () => {
    if (instance) instance.destroy();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.src, (v: any) => {
  if (instance && typeof v === 'string' && v) instance.replace(v);
});
watch(() => props.aspectRatio, (v: any) => {
  if (instance) instance.setAspectRatio(v);
});
watch(() => props.dragMode, (v: any) => {
  if (instance && typeof v === 'string') instance.setDragMode(v);
});
watch(() => props.disabled, (v: any) => {
  if (!instance) return;
  if (v) instance.disable();else instance.enable();
});
watch(() => data.value, (v: any) => {
  if (!instance || !v) return;
  if (sameData(v, instance.getData())) return;
  instance.setData(v);
});

defineExpose({ getCropper, getData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, enable, disable, setAspectRatio, setDragMode });
</script>

<style scoped>
.rozie-cropper {
  max-width: 100%;
}
.rozie-cropper-img {
  display: block;
  max-width: 100%;
}
</style>
