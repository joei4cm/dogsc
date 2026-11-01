/**
 * Apple Soft Silver motion port.
 * Constants match SpringMotion (EditorDesignTokens) and RecorderMotion
 * (RecorderSurfaceStyle). Critically damped editor springs use damping 1;
 * recorder island morph keeps a little overshoot (0.82).
 */
const DogSCMotion = (() => {
  const reduces = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // response (seconds) → roughly stiffness for a mass-1 spring.
  function springFrom(response, damping) {
    const omega = (2 * Math.PI) / Math.max(response, 0.001);
    return { stiffness: omega * omega, damping: 2 * damping * omega };
  }

  const PRESETS = {
    interactive: springFrom(0.3, 1),
    fluid: springFrom(0.45, 1),
    snappy: springFrom(0.24, 1),
    gentle: springFrom(0.55, 1),
    settle: springFrom(0.38, 1),
    lift: springFrom(0.28, 1),
    morph: springFrom(0.5, 0.82),
    recorderSettle: springFrom(0.36, 0.84),
    quick: springFrom(0.26, 0.86),
  };

  function animate(from, to, preset, onFrame, onDone) {
    if (reduces() || Math.abs(to - from) < 0.05) {
      onFrame(to, 1);
      onDone?.(to);
      return () => {};
    }
    const { stiffness, damping } = PRESETS[preset] || PRESETS.settle;
    let value = from;
    let velocity = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const force = -stiffness * (value - to) - damping * velocity;
      velocity += force * dt;
      value += velocity * dt;
      const settled = Math.abs(value - to) < 0.15 && Math.abs(velocity) < 8;
      onFrame(settled ? to : value, settled ? 1 : 0);
      if (settled) {
        onDone?.(to);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  function cssTransition(preset) {
    if (reduces()) return "none";
    const map = {
      hover: "background-color 0.15s ease-out, color 0.15s ease-out, opacity 0.15s ease-out",
      crossfade: "opacity 0.16s ease-out",
      fade: "opacity 0.18s ease-out",
      settle: "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), width 0.38s cubic-bezier(0.22, 1, 0.36, 1), padding 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
      morph: "transform 0.5s cubic-bezier(0.22, 0.9, 0.3, 1), width 0.5s cubic-bezier(0.22, 0.9, 0.3, 1), height 0.5s cubic-bezier(0.22, 0.9, 0.3, 1)",
      snappy: "transform 0.24s cubic-bezier(0.2, 1, 0.3, 1), opacity 0.24s ease-out",
    };
    return map[preset] || map.settle;
  }

  /** Sliding platinum thumb under the inspector rail — matchedGeometryEffect. */
  function slideThumb(rail, activeButton) {
    if (!rail || !activeButton) return;
    let thumb = rail.querySelector(".rail-thumb");
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.className = "rail-thumb";
      rail.prepend(thumb);
    }
    const railBox = rail.getBoundingClientRect();
    const box = activeButton.getBoundingClientRect();
    const left = box.left - railBox.left - 4;
    const width = box.width;
    thumb.style.opacity = "1";
    thumb.style.transform = `translateX(${left}px)`;
    thumb.style.width = `${width}px`;
  }

  /** Sliding white pill inside .segmented controls. */
  function slideSegment(group, activeButton) {
    if (!group || !activeButton) return;
    let thumb = group.querySelector(".seg-thumb");
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.className = "seg-thumb";
      group.prepend(thumb);
    }
    const groupBox = group.getBoundingClientRect();
    const box = activeButton.getBoundingClientRect();
    const left = box.left - groupBox.left;
    thumb.style.transform = `translateX(${left}px)`;
    thumb.style.width = `${box.width}px`;
  }

  function syncSegments(root = document) {
    root.querySelectorAll(".segmented").forEach((group) => {
      slideSegment(group, group.querySelector("button.active") || group.querySelector("button"));
    });
  }

  function press(node) {
    if (!node || reduces()) return;
    node.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.96)" }, { transform: "scale(1)" }],
      { duration: 220, easing: "cubic-bezier(0.2, 1, 0.3, 1)" }
    );
  }

  function morphOpen(node, open, baseTransform = "") {
    if (!node) return;
    const prefix = baseTransform ? `${baseTransform} ` : "";
    node.style.transition = cssTransition("morph");
    node.dataset.open = open ? "1" : "0";
    node.style.opacity = open ? "1" : "0";
    node.style.transform = open
      ? `${prefix}translateY(0) scale(1)`
      : `${prefix}translateY(8px) scale(0.96)`;
    node.style.pointerEvents = open ? "auto" : "none";
  }

  return { reduces, animate, cssTransition, slideThumb, slideSegment, syncSegments, press, morphOpen, PRESETS };
})();
