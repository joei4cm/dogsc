/**
 * Preview pacing ported from EditorPlaybackScrubbing + SharedPreviewRenderPipeline.
 * Logical clock updates every pointer/rAF tick; HTMLVideoElement seeks are
 * coalesced (one in-flight) so scrubbing does not pile decode work — the same
 * contract as macOS AVPlayer seeks with zero tolerance on mouse-up.
 */
const DogSCPreview = (() => {
  let video = null;
  let seekInFlight = false;
  let pendingSeek = null;
  let lastExact = -1;
  let generation = 0;

  function attach(element) {
    video = element;
    seekInFlight = false;
    pendingSeek = null;
    lastExact = -1;
    generation += 1;
  }

  function seekCoalesced(sourceTime, exact = false) {
    if (!video || !Number.isFinite(sourceTime)) return;
    const target = Math.max(sourceTime, 0);
    if (!exact && Math.abs(target - (video.currentTime || 0)) < 0.04) return;
    if (seekInFlight) {
      pendingSeek = { time: target, exact };
      return;
    }
    seekInFlight = true;
    const gen = generation;
    const finish = () => {
      if (gen !== generation) return;
      seekInFlight = false;
      if (pendingSeek) {
        const next = pendingSeek;
        pendingSeek = null;
        seekCoalesced(next.time, next.exact);
      }
    };
    try {
      video.currentTime = target;
      lastExact = exact ? target : lastExact;
      if (video.seeking) {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          finish();
        };
        video.addEventListener("seeked", onSeeked);
      } else {
        finish();
      }
    } catch (_) {
      finish();
    }
  }

  function settle() {
    if (pendingSeek) {
      const next = pendingSeek;
      pendingSeek = null;
      seekInFlight = false;
      seekCoalesced(next.time, true);
    }
  }

  /** Display-link style loop: one paint per frame, never stacks decodes. */
  function run(onFrame) {
    let active = true;
    const gen = generation;
    const tick = (now) => {
      if (!active || gen !== generation) return;
      onFrame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { active = false; };
  }

  return { attach, seekCoalesced, settle, run };
})();
