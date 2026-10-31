(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.DogSCZoom = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
  }

  function ease(preset, progress) {
    progress = clamp(progress, 0, 1);
    if (progress === 0 || progress === 1 || preset === "linear") return progress;
    if (preset === "quadratic") {
      return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    }
    if (preset === "quintic") {
      return progress < 0.5 ? 16 * Math.pow(progress, 5) : 1 - Math.pow(-2 * progress + 2, 5) / 2;
    }
    if (preset === "spring") {
      return 1 - Math.exp(-6 * progress) * Math.cos(progress * Math.PI * 1.5);
    }
    return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function clipDuration(clip) {
    const speed = Math.max(Number(clip.speed || 1), 0.05);
    return Math.max(Number(clip.src_out) - Number(clip.src_in), 0) / speed;
  }

  function layout(clips) {
    let cursor = 0;
    return clips.map((clip) => {
      const duration = clipDuration(clip);
      const row = { id: clip.id, start: cursor, end: cursor + duration, duration, clip };
      cursor += duration;
      return row;
    });
  }

  function absoluteZooms(clips, zooms) {
    const rows = layout(clips);
    const offsets = Object.fromEntries(rows.map((row) => [row.id, row.start]));
    return zooms
      .filter((zoom) => offsets[zoom.clip_id] !== undefined)
      .map((zoom) => ({
        ...zoom,
        start: Number(zoom.start) + offsets[zoom.clip_id],
        end: Number(zoom.end) + offsets[zoom.clip_id],
      }))
      .sort((a, b) => a.start - b.start);
  }

  function progressAt(zoom, time) {
    const start = Number(zoom.start);
    const end = Number(zoom.end);
    const enter = Math.max(Number(zoom.enter || 0), 0);
    const exit = Math.max(Number(zoom.exit || 0), 0);
    if (time < start || time > end + exit) return 0;
    if (enter > 0.001 && time < start + enter) return ease(zoom.easing || "cubic", (time - start) / enter);
    if (time <= end) return 1;
    if (exit > 0.001) return 1 - ease(zoom.easing || "cubic", (time - end) / exit);
    return 0;
  }

  function sample(zooms, time) {
    let chosen = null;
    zooms.forEach((zoom) => {
      const end = Number(zoom.end) + Number(zoom.exit || 0);
      if (Number(zoom.start) <= time && time <= end) {
        if (!chosen || Number(zoom.start) >= Number(chosen.start)) chosen = zoom;
      }
    });
    if (!chosen) return { scale: 1, focus_x: 0.5, focus_y: 0.5, framing: 0 };
    const framing = progressAt(chosen, time);
    const scale = 1 + (Math.max(Number(chosen.scale || 1), 1) - 1) * framing;
    return {
      scale,
      focus_x: clamp(Number(chosen.focus_x ?? 0.5), 0, 1),
      focus_y: clamp(Number(chosen.focus_y ?? 0.5), 0, 1),
      framing,
    };
  }

  function viewport(scale, focusX, focusY, framing) {
    scale = clamp(scale, 1, 6);
    framing = clamp(framing, 0, 1);
    function axis(focus) {
      const destination = clamp(focus, 0.3, 0.7);
      const desired = focus + (destination - focus) * framing;
      const scaledPoint = 0.5 + scale * (focus - 0.5);
      let translation = desired - scaledPoint;
      translation = clamp(translation, 0.5 - scale / 2, scale / 2 - 0.5);
      return 0.5 - (0.5 + translation) / scale;
    }
    return { left: axis(focusX), top: axis(focusY), size: 1 / scale };
  }

  function sampleViewport(clips, zooms, time) {
    const sampled = sample(absoluteZooms(clips, zooms), time);
    return { ...sampled, ...viewport(sampled.scale, sampled.focus_x, sampled.focus_y, sampled.framing) };
  }

  function duration(clips) {
    return layout(clips).reduce((sum, row) => sum + row.duration, 0);
  }

  function locateTimeline(clips, time) {
    const rows = layout(clips);
    for (const row of rows) {
      if (time >= row.start - 1e-6 && time <= row.end + 1e-6) {
        const local = Math.min(Math.max(time - row.start, 0), row.duration);
        const speed = Math.max(Number(row.clip.speed || 1), 0.05);
        return { clip: row.clip, local, start: row.start, source: Number(row.clip.src_in) + local * speed };
      }
    }
    return null;
  }

  return { clamp, ease, layout, absoluteZooms, sample, viewport, sampleViewport, duration, locateTimeline, clipDuration };
});
