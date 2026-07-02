/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/wavesurfer.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in Waveform.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): the canonical media verbs
 * `play`/`pause`/`playPause` are kept — the same-named engine EVENTS were renamed
 * `playing`/`paused`/`finished` in the source to avoid the expose-verb⇄emit clash
 * (ROZ121). No `setCurrentTime` (the React `currentTime`-model auto-setter, ROZ524
 * — seek via `setTime`). None matches a Lit reserved lifecycle name.
 */
export const handleManifest = {
  play: 'Start playback.',
  pause: 'Pause playback.',
  playPause: 'Toggle between play and pause.',
  stop: 'Stop playback and return the cursor to the start.',
  seekTo: 'Seek to a relative position — `seekTo(progress)` where `progress` is `0`–`1`.',
  setTime: 'Seek to an absolute position in seconds — `setTime(seconds)`.',
  setVolume: 'Set the playback volume — `setVolume(v)` where `v` is `0`–`1`.',
  setPlaybackRate: 'Set the playback speed multiplier — `setPlaybackRate(rate)`.',
  setZoom: 'Set the zoom level in pixels-per-second — `setZoom(pxPerSec)`.',
  load: 'Load a new audio source URL — `load(url)`.',
  isPlaying: 'Return whether audio is currently playing (`boolean`).',
  getDuration: 'Return the total duration in seconds (`0` before the audio is ready).',
  getCurrentTime: 'Return the current playback position in seconds.',
  getWaveSurfer: 'Return the underlying wavesurfer instance for direct API access (the engine escape hatch). Null before mount.',
};

export default handleManifest;
