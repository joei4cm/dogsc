const Z = DogSCZoom;
const state = {
  lang: localStorage.getItem("dogsc-lang") || "zh",
  env: null,
  projects: [],
  project: null,
  pointer: [],
  view: "home",
  time: 0,
  playing: false,
  selectedZoom: null,
  selectedMotion: null,
  selectedMosaic: null,
  selectedSticker: null,
  tab: "frame",
  frameTab: "background",
  bgTab: "wallpaper",
  motionMode: "zoom",
  motionDrive: "auto",
  record: { source: "display", display: 0, window: null, geometry: null, fps: 30, mic: false, system: false, camera: false },
  sources: { displays: [], windows: [] },
  recording: { active: false, elapsed: 0 },
  recorderPopover: null,
  hudMenu: null,
  cropping: false,
  cropDraft: null,
  cropOrigin: null,
  exportSheet: null,
  previewQuality: localStorage.getItem("dogsc-preview-quality") || "full",
  inspectorWidth: Number(localStorage.getItem("dogsc-inspector-w") || 360),
  timelineHeight: Number(localStorage.getItem("dogsc-timeline-h") || 248),
  snapGuide: null,
  peaks: null,
  peaksProjectId: null,
  cameraStream: null,
  wallpapers: null,
  selectedMarker: null,
  timelineMode: "picture",
  magnetic: true,
  hoverPreview: true,
  hoverTime: null,
  timelineZoom: 1,
  trackMenu: false,
  trackVisibility: (() => {
    try {
      return {
        zoom: true,
        motion: true,
        mosaic: true,
        sticker: true,
        ...JSON.parse(localStorage.getItem("dogsc-tracks") || "{}"),
      };
    } catch (_) {
      return { zoom: true, motion: true, mosaic: true, sticker: true };
    }
  })(),
  altHeld: false,
  dirty: false,
};

/** Apple EditorTimelineMagneticSnap: capture ~7px, escape ~14px, suppress start edges. */
const magneticSession = {
  candidates: null,
  suppressed: new Set(),
  held: null,
  heldOffset: 0,
  reset() {
    this.candidates = null;
    this.suppressed = new Set();
    this.held = null;
    this.heldOffset = 0;
  },
};

function magneticResolve(proposed, { width, duration, targets, initial = [], offsets = [0], shift = false }) {
  if (!state.magnetic || !Number.isFinite(proposed) || width <= 0) {
    state.snapGuide = null;
    return proposed;
  }
  const pps = width / Math.max(duration, 0.001);
  const capture = 7 / pps;
  const escape = 14 / pps;
  if (!magneticSession.candidates) {
    magneticSession.candidates = [...new Set(targets().filter(Number.isFinite))].sort((a, b) => a - b);
    magneticSession.suppressed = new Set(
      magneticSession.candidates.filter((point) => initial.some((edge) => Math.abs(edge - point) < 1e-5))
    );
  }
  magneticSession.suppressed = new Set(
    [...magneticSession.suppressed].filter((point) =>
      offsets.some((offset) => Math.abs(proposed + offset - point) <= escape)
    )
  );
  if (shift) {
    magneticSession.held = null;
    magneticSession.heldOffset = 0;
    state.snapGuide = null;
    return proposed;
  }
  if (magneticSession.held != null && Math.abs(proposed + magneticSession.heldOffset - magneticSession.held) <= escape) {
    state.snapGuide = magneticSession.held;
    return magneticSession.held - magneticSession.heldOffset;
  }
  magneticSession.held = null;
  magneticSession.heldOffset = 0;
  let best = null;
  const points = magneticSession.candidates || [];
  for (const offset of offsets) {
    const position = proposed + offset;
    for (const point of points) {
      const distance = Math.abs(point - position);
      if (magneticSession.suppressed.has(point) || distance > capture) continue;
      if (!best || distance < best.distance) best = { distance, time: point, offset };
    }
  }
  if (!best) {
    state.snapGuide = null;
    return proposed;
  }
  magneticSession.heldOffset = best.offset;
  magneticSession.held = best.time;
  state.snapGuide = best.time;
  return best.time - best.offset;
}

function persistTracks() {
  localStorage.setItem("dogsc-tracks", JSON.stringify(state.trackVisibility));
}

function formatHoverBadge(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rem = total - minutes * 60;
  const whole = Math.floor(rem);
  const cents = Math.floor((rem - whole) * 100);
  return `${minutes}:${String(whole).padStart(2, "0")}.${String(cents).padStart(2, "0")}`;
}

function placeHoverGuide(lanes, duration, width, time) {
  let ghost = lanes.querySelector(".hover-playhead");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.className = "hover-playhead";
    ghost.innerHTML = `<span class="hover-badge">${formatHoverBadge(time)}</span>`;
    lanes.append(ghost);
  }
  ghost.style.left = `calc(76px + ${(time / duration) * width}px)`;
  const badge = ghost.querySelector(".hover-badge");
  if (badge) badge.textContent = formatHoverBadge(time);
  return ghost;
}

function blankCrop() {
  return { x: 0, y: 0, width: 1, height: 1 };
}
function clampCrop(crop, minimum = 0.02) {
  const floor = Math.min(Math.max(minimum, 0.001), 1);
  const x = Math.min(Math.max(Number(crop?.x) || 0, 0), 1 - floor);
  const y = Math.min(Math.max(Number(crop?.y) || 0, 0), 1 - floor);
  return {
    x,
    y,
    width: Math.min(Math.max(Number(crop?.width) || 1, floor), 1 - x),
    height: Math.min(Math.max(Number(crop?.height) || 1, floor), 1 - y),
  };
}
function activeCrop() {
  if (state.cropping && state.cropDraft) return clampCrop(state.cropDraft);
  return clampCrop(state.project?.canvas?.crop);
}
function formatBytes(bytes) {
  const value = Math.max(Number(bytes) || 0, 0);
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const ICONS = {
  display: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="1.5" y="2.5" width="15" height="10" rx="2.4"/><path d="M6 15.6h6"/></svg>`,
  window: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="1.5" y="3" width="15" height="12" rx="2.6"/><path d="M4.6 6.2h2.8"/></svg>`,
  region: `<svg class="icon-svg" viewBox="0 0 18 18"><path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H6M12 3h1.5A1.5 1.5 0 0 1 15 4.5V6M15 12v1.5a1.5 1.5 0 0 1-1.5 1.5H12M6 15H4.5A1.5 1.5 0 0 1 3 13.5V12"/></svg>`,
  mic: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="6.5" y="2.5" width="5" height="9" rx="2.5"/><path d="M4.5 9a4.5 4.5 0 0 0 9 0M9 13.5V16"/></svg>`,
  micOff: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="6.5" y="2.5" width="5" height="9" rx="2.5"/><path d="M4.5 9a4.5 4.5 0 0 0 9 0M9 13.5V16M3.5 3.5l11 11"/></svg>`,
  cam: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="2" y="5" width="10" height="8" rx="1.8"/><path d="M12.5 8l3.5-2v6l-3.5-2z"/></svg>`,
  camOff: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="2" y="5" width="10" height="8" rx="1.8"/><path d="M12.5 8l3.5-2v6l-3.5-2zM3.5 3.5l11 11"/></svg>`,
  speaker: `<svg class="icon-svg" viewBox="0 0 18 18"><path d="M3.5 7.2h2.2L9.5 4.5v9L5.7 10.8H3.5z"/><path d="M12 7.2a2.6 2.6 0 0 1 0 3.6M13.8 5.4a5 5 0 0 1 0 7.2"/></svg>`,
  speakerOff: `<svg class="icon-svg" viewBox="0 0 18 18"><path d="M3.5 7.2h2.2L9.5 4.5v9L5.7 10.8H3.5zM12 6.5l3.5 5M15.5 6.5l-3.5 5"/></svg>`,
  more: `<svg class="icon-svg" viewBox="0 0 18 18" style="fill:currentColor;stroke:none"><circle cx="4.5" cy="9" r="1.35"/><circle cx="9" cy="9" r="1.35"/><circle cx="13.5" cy="9" r="1.35"/></svg>`,
  frame: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="2" y="4" width="11" height="9" rx="1.6"/><path d="M14.5 6.5l1.5-1v7l-1.5-1"/></svg>`,
  opening: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="2.5" y="4" width="13" height="10" rx="2"/><path d="M6 8.5l2 2 4-4"/></svg>`,
  motion: `<svg class="icon-svg" viewBox="0 0 18 18"><circle cx="9" cy="9" r="3.2"/><path d="M9 2.8v1.8M9 13.4v1.8M2.8 9h1.8M13.4 9h1.8M4.4 4.4l1.3 1.3M12.3 12.3l1.3 1.3M13.6 4.4l-1.3 1.3M5.7 12.3l-1.3 1.3"/></svg>`,
  cursor: `<svg class="icon-svg" viewBox="0 0 18 18"><path d="M4 3.5l1.2 10 3-3.2 3.4 4.4 1.6-.9-3.5-4.5H14z"/></svg>`,
  camera: `<svg class="icon-svg" viewBox="0 0 18 18"><rect x="2" y="5" width="10" height="8" rx="1.8"/><path d="M12.5 8l3.5-2v6l-3.5-2z"/></svg>`,
  audio: `<svg class="icon-svg" viewBox="0 0 18 18"><path d="M3.5 7.2h2.2L9.5 4.5v9L5.7 10.8H3.5z"/><path d="M12 7.2a2.6 2.6 0 0 1 0 3.6M13.8 5.4a5 5 0 0 1 0 7.2"/></svg>`,
  undo: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M5 7H3.2A6.2 6.2 0 1 1 3.5 12"/><path d="M5 4.2V7H2.2"/></svg>`,
  redo: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M13 7h1.8A6.2 6.2 0 1 0 14.5 12"/><path d="M13 4.2V7h2.8"/></svg>`,
  scissors: `<svg class="icon-svg sm" viewBox="0 0 18 18"><circle cx="5" cy="5" r="2"/><circle cx="5" cy="13" r="2"/><path d="M6.6 6.2L15 13M6.6 11.8L15 5"/></svg>`,
  trash: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M4 5.5h10M7 5.5V4h4v1.5M6 5.5l.6 9h4.8l.6-9"/></svg>`,
  restore: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M4.5 9a4.5 4.5 0 1 0 1.2-3"/><path d="M4.2 3.8V6.5H7"/></svg>`,
  marker: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M9 2.8v12.4M6.2 5.2h5.6"/><path d="M5.5 15h7"/></svg>`,
  film: `<svg class="icon-svg sm" viewBox="0 0 18 18"><rect x="3" y="4" width="12" height="10" rx="1.5"/><path d="M6 4v10M12 4v10M3 7.5h12M3 10.5h12"/></svg>`,
  wave: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M2.5 9h1.5l1-3 1.5 6 1.5-8 1.5 8 1.5-5 1 2H15.5"/></svg>`,
  magnet: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M4.5 3.5h3v6a1.5 1.5 0 0 0 3 0v-6h3v6a4.5 4.5 0 0 1-9 0z"/></svg>`,
  eye: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M2.5 9s2.8-4.5 6.5-4.5S15.5 9 15.5 9s-2.8 4.5-6.5 4.5S2.5 9 2.5 9z"/><circle cx="9" cy="9" r="2"/></svg>`,
  fit: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M3.5 6.5V3.5H6.5M11.5 3.5h3v3M14.5 11.5v3h-3M6.5 14.5h-3v-3"/></svg>`,
  tracks: `<svg class="icon-svg sm" viewBox="0 0 18 18"><rect x="2.5" y="3.5" width="13" height="3" rx="1"/><rect x="2.5" y="7.5" width="13" height="3" rx="1"/><rect x="2.5" y="11.5" width="13" height="3" rx="1"/></svg>`,
  play: `<svg class="icon-svg sm fill" viewBox="0 0 18 18"><path d="M6.2 4.2l8 4.8-8 4.8z"/></svg>`,
  pause: `<svg class="icon-svg sm fill" viewBox="0 0 18 18"><rect x="5" y="4" width="2.8" height="10" rx="0.6"/><rect x="10.2" y="4" width="2.8" height="10" rx="0.6"/></svg>`,
  prev: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M11.2 4.8L7 9l4.2 4.2"/><path d="M5.2 4.5v9"/></svg>`,
  next: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M6.8 4.8L11 9l-4.2 4.2"/><path d="M12.8 4.5v9"/></svg>`,
  crop: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M5 2.5v10.5H15.5M13 15.5V5H2.5"/></svg>`,
  plus: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M9 4v10M4 9h10"/></svg>`,
  sliders: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M3 5.5h12M3 12.5h12"/><circle cx="7" cy="5.5" r="1.8"/><circle cx="11" cy="12.5" r="1.8"/></svg>`,
  chevron: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M6 7l3 3 3-3M6 4.5l3-1.5 3 1.5"/></svg>`,
  folder: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M2.5 5.5h4l1.4 1.5H15.5v7.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1z"/><path d="M2.5 5.5V4.2A1.2 1.2 0 0 1 3.7 3h3.1l1.2 1.4"/></svg>`,
  chevronDown: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M5 7.2l4 4 4-4"/></svg>`,
  share: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M9 11.5V3.5M6.2 5.8L9 3.2l2.8 2.6"/><path d="M4 10.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"/></svg>`,
  gear: `<svg class="icon-svg sm" viewBox="0 0 18 18"><circle cx="9" cy="9" r="2.2"/><path d="M9 2.6l.7 1.6 1.7-.2.9 1.5-1.2 1.2.5 1.6-1.6.7-.2 1.7-1.5.9-1.2-1.2-1.6.5-.7-1.6-1.7.2-.9-1.5 1.2-1.2-.5-1.6 1.6-.7.2-1.7 1.5-.9z"/></svg>`,
  check: `<svg class="icon-svg sm" viewBox="0 0 18 18"><path d="M4.5 9.2l3 3 6-6.5"/></svg>`,
};

const STR = {
  zh: {
    lang: "English",
    title: "录得清楚，剪得轻松。",
    lead: "录显示器、窗口或区域，再在 Soft Silver 时间线上剪辑与运镜。",
    record: "开始录制",
    demo: "打开示例",
    import: "导入视频",
    path: "从路径导入",
    projects: "项目",
    empty: "还没有项目。可以先打开示例，熟悉剪辑和运镜。",
    display: "显示器",
    window: "窗口",
    region: "区域",
    mic: "麦克风",
    system: "系统声音",
    pick: "框选区域",
    start: "开始",
    stop: "停止并剪辑",
    marker: "标记",
    back: "项目",
    split: "分割",
    auto: "按点击生成运镜",
    zoom: "在播放头加运镜",
    export: "导出",
    saved: "已保存",
    undo: "撤销",
    redo: "重做",
    frame: "画面",
    opening: "开场",
    motion: "运镜",
    cursor: "光标",
    camera: "摄像头",
    audio: "声音",
    background: "背景",
    layout: "布局",
    mockup: "样机",
    wallpaper: "壁纸",
    pattern: "网格",
    dynamic: "动效",
    custom: "自定",
    aspect: "比例",
    padding: "留白",
    radius: "圆角",
    shadow: "阴影",
    border: "描边",
    resolution: "分辨率",
    fps: "帧率",
    scale: "缩放",
    easing: "缓动",
    enter: "进入",
    exit: "退出",
    deleteZoom: "删除运镜",
    deleteClip: "删除片段",
    earlier: "前移",
    later: "后移",
    speed: "速度",
    tilt: "屏幕 3D",
    addTilt: "加入 3D 运镜",
    mosaic: "马赛克",
    addMosaic: "加入马赛克",
    sticker: "贴图",
    addSticker: "上传贴图",
    playing: "播放",
    pause: "暂停",
    note: "iPhone 有线采集仍依赖 macOS Continuity。摄像头画中画可在导入摄像头素材后使用；本机 v4l2 设备会出现在录制胶囊。",
    noDisplay: "没有列出显示器。",
    noWindow: "没有列出窗口。",
    delete: "删除",
    settings: "设置",
    addToCanvas: "添加到画面",
    previewOpts: "预览选项",
    picture: "画面",
    waveform: "波形",
    magnetic: "磁性吸附",
    hoverPrev: "悬浮预览",
    fitAll: "全部显示",
    restoreCuts: "恢复剪辑",
    tracks: "轨道",
    trackZoom: "运镜",
    trackMotion: "屏幕 3D",
    trackMosaic: "马赛克",
    trackSticker: "贴图",
    autoMotion: "自动运镜",
    manualMotion: "手动操控",
    pan2d: "平移 2D",
    applyAll: "应用到全部画面",
  },
  en: {
    lang: "中文",
    title: "Record clearly. Cut lightly.",
    lead: "Capture a display, window, or region — then cut and zoom on Soft Silver.",
    record: "Record",
    demo: "Open example",
    import: "Import video",
    path: "Import path",
    projects: "Projects",
    empty: "No projects yet. Open the example to try the timeline.",
    display: "Display",
    window: "Window",
    region: "Region",
    mic: "Microphone",
    system: "System audio",
    pick: "Drag a region",
    start: "Start",
    stop: "Stop and edit",
    marker: "Marker",
    back: "Projects",
    split: "Split",
    auto: "Zoom from clicks",
    zoom: "Zoom at playhead",
    export: "Export",
    saved: "Saved",
    undo: "Undo",
    redo: "Redo",
    frame: "Frame",
    opening: "Opening",
    motion: "Motion",
    cursor: "Cursor",
    camera: "Camera",
    audio: "Audio",
    background: "Background",
    layout: "Layout",
    mockup: "Mockup",
    wallpaper: "Wallpaper",
    pattern: "Pattern",
    dynamic: "Motion",
    custom: "Custom",
    aspect: "Aspect",
    padding: "Padding",
    radius: "Radius",
    shadow: "Shadow",
    border: "Border",
    resolution: "Resolution",
    fps: "Frame rate",
    scale: "Scale",
    easing: "Easing",
    enter: "In",
    exit: "Out",
    deleteZoom: "Delete zoom",
    deleteClip: "Delete clip",
    earlier: "Earlier",
    later: "Later",
    speed: "Speed",
    tilt: "Screen 3D",
    addTilt: "Add 3D motion",
    mosaic: "Mosaic",
    addMosaic: "Add mosaic",
    sticker: "Sticker",
    addSticker: "Upload sticker",
    playing: "Play",
    pause: "Pause",
    note: "Cable iPhone capture still needs macOS Continuity. Camera PiP works after importing camera media; local v4l2 devices appear on the recorder capsule.",
    noDisplay: "No displays listed.",
    noWindow: "No windows listed.",
    delete: "Delete",
    settings: "Settings",
    addToCanvas: "Add to canvas",
    previewOpts: "Preview options",
    picture: "Picture",
    waveform: "Waveform",
    magnetic: "Magnetic snap",
    hoverPrev: "Hover preview",
    fitAll: "Fit all",
    restoreCuts: "Restore cuts",
    tracks: "Tracks",
    trackZoom: "Zoom",
    trackMotion: "Screen 3D",
    trackMosaic: "Mosaic",
    trackSticker: "Sticker",
    autoMotion: "Auto motion",
    manualMotion: "Manual",
    pan2d: "2D pan",
    applyAll: "Apply to all frames",
  },
};

const EASING = {
  zh: { linear: "线性", quadratic: "二次", cubic: "三次", quintic: "五次", spring: "弹簧" },
  en: { linear: "Linear", quadratic: "Quadratic", cubic: "Cubic", quintic: "Quintic", spring: "Spring" },
};
const FRAME_LABELS = {
  zh: { none: "无", windowLight: "浅色窗口", windowDark: "深色窗口", browserLight: "浅色浏览器", browserDark: "深色浏览器", devicePhone: "手机" },
  en: { none: "None", windowLight: "Window light", windowDark: "Window dark", browserLight: "Browser light", browserDark: "Browser dark", devicePhone: "Phone" },
};
const PATTERN_LABELS = {
  zh: { obsidianGrid: "黑曜石网格", engineeringWhiteGrid: "工程白网格", midnightDots: "暗夜星阵", architecturalDots: "建筑极简点", isometricMesh: "立体等角网" },
  en: { obsidianGrid: "Obsidian grid", engineeringWhiteGrid: "Engineering grid", midnightDots: "Midnight dots", architecturalDots: "Architect dots", isometricMesh: "Isometric" },
};
const DYNAMIC_LABELS = {
  zh: { cyberDriftGrid: "流金缓移网格", starfieldDots: "暖星漫步点阵", auroraFluid: "蓝白流体云幕" },
  en: { cyberDriftGrid: "Drift grid", starfieldDots: "Starfield", auroraFluid: "Aurora" },
};
const CURSOR_LABELS = {
  zh: { "system.arrow": "箭头", "system.pointing-hand": "手势", "system.crosshair": "十字", "system.ibeam": "文本", "system.touch-dot": "触点", "system.hidden": "隐藏" },
  en: { "system.arrow": "Arrow", "system.pointing-hand": "Hand", "system.crosshair": "Crosshair", "system.ibeam": "I-beam", "system.touch-dot": "Touch", "system.hidden": "Hidden" },
};
const CLICK_LABELS = {
  zh: { ripple: "涟漪", glow: "光晕", pulse: "双环", burst: "微闪", none: "无" },
  en: { ripple: "Ripple", glow: "Glow", pulse: "Pulse", burst: "Burst", none: "None" },
};
const OPENING_LABELS = {
  zh: { converge: "聚拢", sideSlide: "侧滑", light3D: "轻 3D" },
  en: { converge: "Converge", sideSlide: "Side slide", light3D: "Light 3D" },
};

function t(key) { return STR[state.lang][key] || key; }
function modKey() {
  return /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";
}
function shortcutHint(action) {
  const mod = modKey();
  const map = {
    undo: `${mod}+Z`,
    redo: `${mod}+Shift+Z`,
    play: "Space",
    split: "S",
    back: "Esc",
    export: `${mod}+E`,
  };
  return map[action] || "";
}
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove("show"), 2800);
}
function syncTransport() {
  if (!state.project) return;
  const total = Math.max(Z.duration(state.project.clips), 0.1);
  const clock = document.querySelector("#clock");
  if (clock) clock.innerHTML = `${formatTime(state.time)} <em>/ ${formatTime(Z.duration(state.project.clips))}</em>`;
  const head = document.querySelector(".playhead");
  if (!head) return;
  if (head.classList.contains("playhead-span")) {
    const width = Number(head.dataset.laneWidth || 0);
    head.style.left = `calc(76px + ${(state.time / total) * width}px)`;
  } else {
    head.style.left = `${(state.time / total) * 100}%`;
  }
}
function closeFloatingUI() {
  let changed = false;
  if (state.recorderPopover) { state.recorderPopover = null; changed = true; }
  if (state.hudMenu) { state.hudMenu = null; changed = true; }
  if (state.trackMenu) { state.trackMenu = false; changed = true; }
  if (state.exportSheet && state.exportSheet.state !== "running") {
    state.exportSheet = null;
    changed = true;
  }
  if (state.cropping) {
    discardCrop();
    changed = true;
  }
  return changed;
}
function beginCrop() {
  if (!state.project || state.cropping) return;
  state.playing = false;
  updatePlayButton();
  state.hudMenu = null;
  state.cropOrigin = clampCrop(state.project.canvas?.crop);
  state.cropDraft = { ...state.cropOrigin };
  state.cropping = true;
}
function discardCrop() {
  state.cropping = false;
  state.cropDraft = null;
  state.cropOrigin = null;
}
function resetCropDraft() {
  if (!state.cropping) return;
  state.cropDraft = blankCrop();
  paintCanvas();
  syncCropOverlay();
}
async function confirmCrop() {
  if (!state.cropping || !state.project) return;
  const crop = clampCrop(state.cropDraft);
  try {
    await meta({ canvas: { ...state.project.canvas, crop } });
    discardCrop();
    render();
  } catch (error) {
    toast(error.message);
  }
}
function updatePlayButton() {
  const playBtn = document.querySelector("#play");
  if (!playBtn) return;
  playBtn.classList.toggle("playing", state.playing);
  playBtn.title = `${state.playing ? t("pause") : t("playing")} · ${shortcutHint("play")}`;
  playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
  playBtn.innerHTML = state.playing ? ICONS.pause : ICONS.play;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function formatTime(seconds) {
  const safe = Math.max(Number(seconds) || 0, 0);
  const centiseconds = Math.floor(safe * 100 + 1e-9);
  const minutes = Math.floor(centiseconds / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function fieldValue(label, value) {
  return `<div class="field-head"><span>${label}</span><em>${value}</em></div>`;
}

function dialHtml(label, valueText, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const angle = clamped * 270 - 135;
  const sweep = Math.round(clamped * 270);
  return `<div class="dial" title="${escapeHtml(label)}">
    <div class="dial-face" style="--angle:${angle}deg;--sweep:${sweep}deg">
      <i></i><strong>${escapeHtml(valueText)}</strong>
    </div>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

function envelopeHtml(easing) {
  const paths = {
    linear: "M8 52 L92 12",
    quadratic: "M8 52 Q 40 48 50 32 T 92 12",
    cubic: "M8 52 C 28 52, 40 12, 92 12",
    quintic: "M8 52 C 45 52, 55 12, 92 12",
    spring: "M8 52 C 30 52, 38 8, 55 20 S 78 10, 92 14",
  };
  return `<div class="envelope" aria-hidden="true">
    <svg viewBox="0 0 100 64" preserveAspectRatio="none">
      <path class="env-grid" d="M8 12 H92 M8 32 H92 M8 52 H92"/>
      <path class="env-curve" d="${paths[easing] || paths.cubic}"/>
      <circle cx="8" cy="52" r="3.2"/><circle cx="50" cy="28" r="3.2"/><circle cx="92" cy="12" r="3.2"/>
    </svg>
    <div class="env-labels"><span>Ease In</span><span>Hold</span><span>Ease Out</span></div>
  </div>`;
}
function options(values, current, labels) {
  return values.map((value) => `<option value="${value}" ${String(value) === String(current) ? "selected" : ""}>${labels ? (labels[value] || value) : value}</option>`).join("");
}

async function api(path, options = {}) {
  const init = { method: options.method || "GET", headers: {} };
  if (options.body instanceof FormData) init.body = options.body;
  else if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || response.statusText || "请求失败");
  return payload;
}

function render(options = {}) {
  const paint = () => {
    const app = document.querySelector("#app");
    if (state.view === "home" || state.view === "record") app.innerHTML = homeHtml();
    else app.innerHTML = editorHtml();
    bind();
    if (state.view === "editor") {
      mountPreview();
      drawTimeline();
      paintCanvas();
      requestAnimationFrame(() => {
        const rail = document.querySelector(".inspector-rail");
        const active = rail?.querySelector("button.active");
        DogSCMotion.slideThumb(rail, active);
        DogSCMotion.syncSegments();
      });
    } else {
      requestAnimationFrame(() => DogSCMotion.syncSegments());
    }
    const pill = document.querySelector("#platform-pill");
    if (pill && state.env) pill.textContent = `${state.env.os_name?.split(" ")[0] || "Linux"} · ${state.env.backend_label || state.env.backend}`;
  };
  if (options.transition && document.startViewTransition && !DogSCMotion.reduces()) {
    const transition = document.startViewTransition(paint);
    return transition.finished.catch(() => {});
  }
  paint();
}

function sourceLabel(kind) {
  return t(kind === "region" ? "region" : kind);
}

function parityNoteHtml() {
  return "";
}

function recorderCapsuleHtml() {
  const source = state.record.source;
  const live = state.recording.active;
  if (live) {
    return `<div class="recorder-dock">
      <div class="recorder-capsule is-live" data-mode="live">
        <div class="recording-timer" id="elapsed">${formatTime(state.recording.elapsed)}</div>
        <button class="rec-toggle" id="add-marker" title="${t("marker")}">${ICONS.marker}</button>
        <button class="record-go live" id="stop-record" title="${t("stop")}"><span class="dot"><i></i></span></button>
      </div>
    </div>`;
  }
  const pop = state.recorderPopover;
  let popover = "";
  if (pop === "source") {
    const displays = (state.sources.displays || []).map((display, index) => `
      <button class="choice ${index === state.record.display && source === "display" ? "active" : ""}" data-display="${index}">
        ${escapeHtml(display.name || display.id || `Display ${index + 1}`)} · ${display.width || "?"}×${display.height || "?"}
      </button>`).join("") || `<p class="note">${t("noDisplay")}</p>`;
    const windows = (state.sources.windows || []).map((window) => `
      <button class="choice ${window.id === state.record.window && source === "window" ? "active" : ""}" data-window="${escapeHtml(window.id)}">
        ${escapeHtml(window.title)}
      </button>`).join("") || `<p class="note">${t("noWindow")}</p>`;
    popover = `<div class="recorder-popover island" id="rec-pop">
      <div class="segmented" style="margin-bottom:10px">
        ${["display", "window", "region"].map((kind) => `<button data-source="${kind}" class="${source === kind ? "active" : ""}">${t(kind)}</button>`).join("")}
      </div>
      <div class="choices">${source === "display" ? displays : source === "window" ? windows : `
        <p class="note">${state.record.geometry ? `${state.record.geometry.width}×${state.record.geometry.height}` : ""}</p>
        <button class="btn" id="pick-region">${t("pick")}</button>`}</div>
    </div>`;
  } else if (pop === "mic") {
    popover = `<div class="recorder-popover island narrow" id="rec-pop">
      <div class="section-title">${t("mic")}</div>
      <label class="row"><input type="checkbox" id="mic" ${state.record.mic ? "checked" : ""} ${state.env?.microphone ? "" : "disabled"}> ${t("mic")}</label>
      <p class="note">${state.env?.microphone ? "" : (state.lang === "zh" ? "当前环境未检测到麦克风。" : "No microphone detected.")}</p>
    </div>`;
  } else if (pop === "camera") {
    popover = `<div class="recorder-popover island narrow" id="rec-pop">
      <div class="section-title">${t("camera")}</div>
      <label class="row"><input type="checkbox" id="rec-camera" ${state.record.camera ? "checked" : ""}> ${t("camera")}</label>
      <p class="note">${t("note")}</p>
    </div>`;
  } else if (pop === "system") {
    popover = `<div class="recorder-popover island narrow" id="rec-pop">
      <div class="section-title">${t("system")}</div>
      <label class="row"><input type="checkbox" id="system" ${state.record.system ? "checked" : ""} ${state.env?.system_audio ? "" : "disabled"}> ${t("system")}</label>
    </div>`;
  } else if (pop === "more") {
    popover = `<div class="recorder-popover island narrow" id="rec-pop">
      <div class="section-title">${t("settings")}</div>
      <label class="field">${t("fps")}
        <select id="fps"><option ${state.record.fps === 30 ? "selected" : ""}>30</option><option ${state.record.fps === 60 ? "selected" : ""}>60</option></select>
      </label>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn" id="go-demo">${t("demo")}</button>
        <label class="btn">${t("import")}<input id="file" type="file" accept="video/*" hidden></label>
        <button class="btn ghost" id="go-path">${t("path")}</button>
      </div>
    </div>`;
  }
  return `<div class="recorder-dock">
    ${popover}
    <div class="recorder-capsule" id="recorder-capsule" data-mode="idle">
      <button class="mode-wheel" id="mode-wheel" title="${sourceLabel(source)}">
        ${ICONS[source] || ICONS.display}<span>${sourceLabel(source)}</span><span class="chev">⇅</span>
      </button>
      <button class="rec-toggle ${state.record.mic ? "on" : ""}" data-pop="mic" title="${t("mic")}" aria-pressed="${state.record.mic}" aria-expanded="${state.recorderPopover === "mic"}">${state.record.mic ? ICONS.mic : ICONS.micOff}</button>
      <button class="rec-toggle ${state.record.camera ? "on" : ""}" data-pop="camera" title="${t("camera")}" aria-pressed="${state.record.camera}" aria-expanded="${state.recorderPopover === "camera"}">${state.record.camera ? ICONS.cam : ICONS.camOff}</button>
      <button class="rec-toggle ${state.record.system ? "on" : ""}" data-pop="system" title="${t("system")}" aria-pressed="${state.record.system}" aria-expanded="${state.recorderPopover === "system"}">${state.record.system ? ICONS.speaker : ICONS.speakerOff}</button>
      <button class="rec-toggle" data-pop="more" title="${t("settings")}" aria-expanded="${state.recorderPopover === "more"}">${ICONS.more}</button>
      <button class="record-go" id="start-record" title="${t("start")}" aria-label="${t("start")}"><span class="dot"><i></i></span></button>
    </div>
  </div>`;
}

function homeHtml() {
  const cards = state.projects.map((project) => `
    <div class="project">
      <div class="project-row">
        <button data-open="${project.id}">
          <span class="project-thumb" aria-hidden="true">
            <video src="/api/projects/${project.id}/media#t=0.1" muted playsinline preload="metadata"></video>
          </span>
          <span class="project-copy">
            <strong>${escapeHtml(project.name || "未命名")}</strong>
            <span class="meta">${formatTime(project.duration || 0)} · ${project.width || "?"}×${project.height || "?"}</span>
          </span>
        </button>
        <button class="btn icon danger" data-delete="${project.id}" title="${t("delete")}">${ICONS.trash}</button>
      </div>
    </div>`).join("");
  return `<div class="home-shell" data-enter="1">
    <header class="topbar">
      <div class="brand"><span class="logo" aria-hidden="true"></span><div><strong>DogSC</strong><em id="platform-pill">Linux</em></div></div>
      <div class="top-center"></div>
      <div class="top-actions">
        <button class="btn ghost" id="lang">${t("lang")}</button>
      </div>
    </header>
    <main class="home-stage">
      <div class="home-copy">
        <h1>DogSC</h1>
        <p>${t("lead")}</p>
        <div class="home-actions">
          <button class="btn primary" id="go-demo">${t("demo")}</button>
          <label class="btn">${t("import")}<input id="file" type="file" accept="video/*" hidden></label>
        </div>
      </div>
      <aside class="projects-drawer island">
        <h2>${t("projects")}</h2>
        <div class="projects-list">${cards || `<p class="empty">${t("empty")}</p>`}</div>
      </aside>
    </main>
    ${recorderCapsuleHtml()}
  </div>`;
}

function inspectorTabsHtml() {
  const tabs = [
    ["frame", "画面", ICONS.frame],
    ["opening", "开场", ICONS.opening],
    ["motion", "运镜", ICONS.motion],
    ["cursor", "光标", ICONS.cursor],
    ["camera", "摄像头", ICONS.camera],
    ["audio", "声音", ICONS.audio],
  ];
  return tabs.map(([id, zh]) => {
    const label = state.lang === "zh" ? zh : t(id);
    return `<button data-tab="${id}" class="${state.tab === id ? "active" : ""}" title="${label}">${ICONS[id]}<span>${label}</span></button>`;
  }).join("");
}

function stageHudHtml(project) {
  const aspectMenu = state.hudMenu === "aspect" ? `<div class="hud-menu island">
    ${["source", "16:9", "4:3", "1:1", "9:16", "3:4", "2.39:1", "1:2.39"].map((value) =>
      `<button data-aspect="${value}" class="${project.canvas.aspect === value ? "active" : ""}">${value}</button>`).join("")}
  </div>` : "";
  const addMenu = state.hudMenu === "add" ? `<div class="hud-menu island" style="left:auto;right:0">
    <button id="add-mosaic">${t("addMosaic")}</button>
    <label class="btn" style="width:100%;justify-content:flex-start;margin:0;border-radius:8px">${t("addSticker")}<input id="sticker-file" type="file" accept="image/*" hidden></label>
  </div>` : "";
  const previewMenu = state.hudMenu === "preview" ? `<div class="hud-menu island" style="left:auto;right:0">
    <button data-preview="full" class="${state.previewQuality === "full" ? "active" : ""}">${state.lang === "zh" ? "完整画质" : "Full quality"}</button>
    <button data-preview="fast" class="${state.previewQuality === "fast" ? "active" : ""}">${state.lang === "zh" ? "流畅预览" : "Fast preview"}</button>
  </div>` : "";
  const shortcutsPanel = state.hudMenu === "shortcuts" ? `<aside class="shortcuts-panel island" id="shortcuts-panel" role="dialog" aria-label="${state.lang === "zh" ? "快捷键" : "Shortcuts"}">
    <div class="section-title">${state.lang === "zh" ? "快捷键" : "Shortcuts"}</div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "播放 / 暂停" : "Play / Pause"}</span><kbd>${shortcutHint("play")}</kbd></div>
    <div class="shortcut-row"><span>${t("export")}</span><kbd>${shortcutHint("export")}</kbd></div>
    <div class="shortcut-row"><span>${t("undo")}</span><kbd>${shortcutHint("undo")}</kbd></div>
    <div class="shortcut-row"><span>${t("redo")}</span><kbd>${shortcutHint("redo")}</kbd></div>
    <div class="shortcut-row"><span>${t("split")}</span><kbd>${shortcutHint("split")}</kbd></div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "微调 / 跳秒" : "Nudge / Jump"}</span><kbd>← → · ⇧</kbd></div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "逐帧" : "Frame step"}</span><kbd>, .</kbd></div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "片段前后移" : "Reorder clip"}</span><kbd>[ ]</kbd></div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "删除选中" : "Delete"}</span><kbd>Delete</kbd></div>
    <div class="shortcut-row"><span>${state.lang === "zh" ? "关闭浮层" : "Dismiss"}</span><kbd>${shortcutHint("back")}</kbd></div>
  </aside>` : "";
  const cropControls = state.cropping ? `
    <span class="crop-mode-chip">${ICONS.crop}<span>${state.lang === "zh" ? "裁切模式" : "Crop"}</span></span>
    <button class="hud-btn" id="crop-reset">${state.lang === "zh" ? "清除裁切" : "Clear"}</button>
    <button class="hud-btn" id="crop-cancel">${state.lang === "zh" ? "取消" : "Cancel"}</button>
    <button class="hud-btn primary" id="crop-confirm">${state.lang === "zh" ? "完成" : "Done"}</button>
  ` : `
    <div style="position:relative">
      <button class="hud-btn" id="aspect-btn">${project.canvas.aspect || "16:9"}</button>
      ${aspectMenu}
    </div>
    <button class="hud-btn" id="crop-btn" title="${state.lang === "zh" ? "裁切 · Esc 取消" : "Crop · Esc cancels"}">${ICONS.crop}</button>
    <div style="position:relative">
      <button class="hud-btn" id="add-btn" title="${t("addToCanvas")}">${ICONS.plus}</button>
      ${addMenu}
    </div>
    <div style="position:relative">
      <button class="hud-btn" id="preview-btn" title="${t("previewOpts")}">${ICONS.sliders}</button>
      ${previewMenu}
    </div>
  `;
  return `${shortcutsPanel}<div class="stage-hud" id="stage-hud">
    ${cropControls}
    <div class="hud-divider"></div>
    <button class="hud-btn" id="step-back" title="${state.lang === "zh" ? "上一帧 · ←" : "Previous frame · ←"}" ${state.cropping ? "disabled" : ""}>${ICONS.prev}</button>
    <button class="play-btn ${state.playing ? "playing" : ""}" id="play" title="${state.playing ? t("pause") : t("playing")} · ${shortcutHint("play")}" aria-pressed="${state.playing}" ${state.cropping ? "disabled" : ""}>${state.playing ? ICONS.pause : ICONS.play}</button>
    <button class="hud-btn" id="step-forward" title="${state.lang === "zh" ? "下一帧 · →" : "Next frame · →"}" ${state.cropping ? "disabled" : ""}>${ICONS.next}</button>
    <span class="hud-time" id="clock">${formatTime(state.time)} <em>/ ${formatTime(Z.duration(project.clips))}</em></span>
  </div>`;
}

function timelineBarHtml() {
  const tracks = state.trackVisibility;
  const trackMenu = state.trackMenu ? `<div class="track-menu island" id="track-menu" role="menu">
      <button type="button" data-track="zoom" aria-pressed="${tracks.zoom !== false}"><span>${t("trackZoom")}</span><em>${tracks.zoom !== false ? "●" : "○"}</em></button>
      <button type="button" data-track="motion" aria-pressed="${tracks.motion !== false}"><span>${t("trackMotion")}</span><em>${tracks.motion !== false ? "●" : "○"}</em></button>
      <button type="button" data-track="mosaic" aria-pressed="${tracks.mosaic !== false}"><span>${t("trackMosaic")}</span><em>${tracks.mosaic !== false ? "●" : "○"}</em></button>
      <button type="button" data-track="sticker" aria-pressed="${tracks.sticker !== false}"><span>${t("trackSticker")}</span><em>${tracks.sticker !== false ? "●" : "○"}</em></button>
    </div>` : "";
  return `<div class="timeline-bar">
    <button class="tl-tool" id="split" title="${t("split")} · ${shortcutHint("split")}">${ICONS.scissors}</button>
    <button class="tl-tool" id="delete-selection" title="${t("delete")} · Delete">${ICONS.trash}</button>
    <button class="tl-tool" id="restore-cuts" title="${t("restoreCuts")}">${ICONS.restore}</button>
    <button class="tl-tool" id="add-edit-marker" title="${t("marker")}">${ICONS.marker}</button>
    <div class="tl-group" style="margin-left:8px">
      <button id="mode-picture" class="${state.timelineMode === "picture" ? "active" : ""}">${ICONS.film}${t("picture")}</button>
      <button id="mode-wave" class="${state.timelineMode === "waveform" ? "active" : ""}">${ICONS.wave}${t("waveform")}</button>
    </div>
    <div class="tl-tracks">
      <button class="tl-tool ${state.trackMenu ? "active" : ""}" id="tracks-btn" title="${t("tracks")}" aria-expanded="${state.trackMenu}">${ICONS.tracks}</button>
      ${trackMenu}
    </div>
    <div class="spacer"></div>
    <button class="tl-tool ${state.magnetic ? "active" : ""}" id="magnetic" title="${t("magnetic")}" aria-pressed="${state.magnetic}">${ICONS.magnet}</button>
    <button class="tl-tool ${state.hoverPreview ? "active" : ""}" id="hover-preview" title="${t("hoverPrev")}" aria-pressed="${state.hoverPreview}">${ICONS.eye}</button>
    <button class="tl-tool" id="fit-all" title="${t("fitAll")}">${ICONS.fit}</button>
    <div class="tl-zoom">
      <input id="timeline-zoom" type="range" min="1" max="6" step="0.1" value="${state.timelineZoom}">
    </div>
  </div>`;
}

function exportSheetHtml() {
  const sheet = state.exportSheet;
  if (!sheet) return "";
  const zh = state.lang === "zh";
  const estimate = sheet.estimate || {};
  const progress = Math.round((sheet.progress || 0) * 100);
  const busy = sheet.state === "running";
  return `<div class="export-scrim" id="export-scrim">
    <aside class="export-sheet island" role="dialog" aria-label="${t("export")}">
      <div class="section-title">${zh ? "导出成片" : "Export"}</div>
      <p class="note">${zh ? "按当前画面、裁切与运镜生成 MP4。" : "Renders MP4 with current canvas, crop, and motion."}</p>
      <label class="field">${t("resolution")}<select id="sheet-resolution" ${busy ? "disabled" : ""}>${options(["source", "1080p", "1440p", "4k"], state.project.export.resolution)}</select></label>
      <label class="field">${t("fps")}<select id="sheet-fps" ${busy ? "disabled" : ""}>${options(["30", "60"], String(state.project.export.fps))}</select></label>
      <div class="export-meta">
        <div><span>${zh ? "分辨率" : "Size"}</span><strong>${estimate.width || "—"}×${estimate.height || "—"}</strong></div>
        <div><span>${zh ? "时长" : "Duration"}</span><strong>${formatTime(estimate.duration || Z.duration(state.project.clips))}</strong></div>
        <div><span>${zh ? "估大小" : "Est."}</span><strong>${formatBytes(estimate.bytes || 0)}</strong></div>
      </div>
      ${busy ? `<div class="export-progress"><i style="width:${progress}%"></i></div><p class="note">${zh ? `导出中… ${progress}%` : `Exporting… ${progress}%`}</p>` : ""}
      ${sheet.error ? `<p class="note" style="color:var(--red)">${escapeHtml(sheet.error)}</p>` : ""}
      <div class="export-actions">
        <button class="btn" id="export-cancel" ${busy ? "disabled" : ""}>${zh ? "取消" : "Cancel"}</button>
        <button class="btn primary" id="export-start" ${busy ? "disabled" : ""}>${busy ? (zh ? "导出中" : "Working") : (zh ? "开始导出" : "Start")}</button>
      </div>
    </aside>
  </div>`;
}

function editorHtml() {
  const project = state.project;
  const inspectorW = Math.min(Math.max(state.inspectorWidth || 360, 340), 480);
  const timelineH = Math.min(Math.max(state.timelineHeight || 248, 180), 420);
  return `<div class="shell editor-shell">
    <header class="topbar editor-topbar">
      <div class="top-leading">
        <button class="btn icon project-menu" id="back" title="${t("back")}" ${state.cropping ? "disabled" : ""}>${ICONS.folder}${ICONS.chevronDown}</button>
        <input class="title" id="project-name" value="${escapeHtml(project.name)}" ${state.cropping ? "disabled" : ""}>
        <span class="saved">${ICONS.check}<span>${t("saved")}</span></span>
        <span class="toolbar-divider"></span>
        <button class="btn icon" id="undo" title="${t("undo")} · ${shortcutHint("undo")}" ${state.cropping ? "disabled" : ""}>${ICONS.undo}</button>
        <button class="btn icon" id="redo" title="${t("redo")} · ${shortcutHint("redo")}" ${state.cropping ? "disabled" : ""}>${ICONS.redo}</button>
      </div>
      <div class="top-trailing">
        <button class="btn icon" id="lang" title="${t("lang")}">${t("lang") === "English" ? "EN" : "中"}</button>
        <button class="btn icon" id="settings-btn" title="${state.lang === "zh" ? "快捷键" : "Shortcuts"}" aria-expanded="${state.hudMenu === "shortcuts"}">${ICONS.gear}</button>
        <button class="btn icon danger" id="delete-project" title="${t("delete")}" ${state.cropping ? "disabled" : ""}>${ICONS.trash}</button>
        <span class="toolbar-divider"></span>
        <button class="btn primary export-btn" id="export" ${state.cropping ? "disabled" : ""} title="${state.cropping ? (state.lang === "zh" ? "请先完成或取消裁切" : "Finish or cancel crop first") : t("export")}">${ICONS.share}<span>${t("export")}</span></button>
      </div>
    </header>
    <section class="editor" style="--timeline-h:${timelineH}px">
      <div class="workspace" style="--inspector-w:${inspectorW}px">
        <div class="stage ${state.cropping ? "is-cropping" : ""} ${state.previewQuality === "fast" ? "preview-fast" : ""}">
          <div class="stage-dots"></div>
          <div class="canvas-frame" id="canvas"></div>
          ${stageHudHtml(project)}
        </div>
        <div class="splitter-v" id="splitter-v" title="${state.lang === "zh" ? "拖拽调整检查器宽度" : "Drag to resize inspector"}"></div>
        <aside class="inspector" ${state.cropping ? 'aria-disabled="true"' : ""}>
          <div class="inspector-rail">${inspectorTabsHtml()}</div>
          <div class="inspector-body">${state.cropping ? cropInspectorHtml() : inspectorBody()}</div>
        </aside>
      </div>
      <div class="timeline">
        ${timelineBarHtml()}
        <div class="lanes" id="lanes"></div>
      </div>
      <div class="splitter-h" id="splitter-h" title="${state.lang === "zh" ? "拖拽调整时间线高度" : "Drag to resize timeline"}"></div>
    </section>
    ${exportSheetHtml()}
  </div>`;
}

function cropInspectorHtml() {
  const crop = clampCrop(state.cropDraft);
  const zh = state.lang === "zh";
  return `<div class="section">
    <div class="section-title">${zh ? "裁切屏幕" : "Crop screen"}</div>
    <p class="note">${zh ? "拖动八个控制点或框体；Esc 取消。" : "Drag the eight handles or the frame. Esc cancels."}</p>
    <label class="field">${fieldValue(zh ? "左边" : "Left", `${Math.round(crop.x * 100)}%`)}<input id="crop-left" type="range" min="0" max="0.9" step="0.01" value="${crop.x}"></label>
    <label class="field">${fieldValue(zh ? "上边" : "Top", `${Math.round(crop.y * 100)}%`)}<input id="crop-top" type="range" min="0" max="0.9" step="0.01" value="${crop.y}"></label>
    <label class="field">${fieldValue(zh ? "宽度" : "Width", `${Math.round(crop.width * 100)}%`)}<input id="crop-width" type="range" min="0.02" max="1" step="0.01" value="${crop.width}"></label>
    <label class="field">${fieldValue(zh ? "高度" : "Height", `${Math.round(crop.height * 100)}%`)}<input id="crop-height" type="range" min="0.02" max="1" step="0.01" value="${crop.height}"></label>
  </div>`;
}

function inspectorBody() {
  if (state.tab === "frame") return frameInspector();
  if (state.tab === "opening") return openingInspector();
  if (state.tab === "motion") return motionInspector();
  if (state.tab === "cursor") return cursorInspector();
  if (state.tab === "camera") return cameraInspector();
  return audioInspector();
}

function frameInspector() {
  const canvas = state.project.canvas;
  return `
    <div class="inspector-scope">
      <div class="scope-title">${t("frame")}</div>
      <div class="segmented">
        ${["background","layout","mockup"].map((id) => `<button data-frame-tab="${id}" class="${state.frameTab === id ? "active" : ""}">${t(id)}</button>`).join("")}
      </div>
    </div>
    ${state.frameTab === "background" ? backgroundPanel(canvas) : ""}
    ${state.frameTab === "layout" ? layoutPanel(canvas) : ""}
    ${state.frameTab === "mockup" ? mockupPanel(canvas) : ""}`;
}

function backgroundPanel(canvas) {
  const solids = [
    ["#16161a", "深墨"], ["#0b1c2c", "午夜"], ["#1d2430", "石墨"],
    ["#203040", "海雾"], ["#2c241c", "暖褐"], ["#f4f1ea", "宣纸"],
  ];
  const system = state.wallpapers || [];
  const systemGrid = system.length ? `
    <div class="section-title" style="margin-top:12px">${state.lang === "zh" ? "系统壁纸" : "System"}</div>
    <div class="preset-grid wallpaper-grid system-wallpapers">
      ${system.map((item) => `<button class="tile image-tile ${canvas.background_kind === "image" && canvas.background_image === item.url ? "active" : ""}" data-wallpaper="${escapeHtml(item.url)}" style="background-image:url('${escapeHtml(item.url)}')"><span>${escapeHtml(item.name)}</span></button>`).join("")}
    </div>` : `<p class="note">${state.lang === "zh" ? "未找到系统壁纸目录（~/.local/share/backgrounds 等）。" : "No system wallpaper folders found."}</p>`;
  return `
    <div class="section-title">${state.lang === "zh" ? "背景素材" : "Background"}</div>
    <div class="segmented" style="margin-bottom:12px">
      ${["wallpaper","pattern","dynamic","custom"].map((id) => `<button data-bg-tab="${id}" class="${state.bgTab === id ? "active" : ""}">${t(id)}</button>`).join("")}
    </div>
    ${state.bgTab === "wallpaper" ? `
      <div class="preset-grid wallpaper-grid">
        ${solids.map(([color, label]) => `<button class="tile ${canvas.background_kind !== "image" && canvas.background === color && canvas.background_kind !== "pattern" && canvas.background_kind !== "dynamic" ? "active" : ""}" data-color="${color}" style="background:${color}"><span>${state.lang === "zh" ? label : color}</span></button>`).join("")}
      </div>
      ${systemGrid}` : ""}
    ${state.bgTab === "custom" ? `
      <div class="preset-grid wallpaper-grid">
        ${solids.map(([color, label]) => `<button class="tile ${canvas.background_kind !== "image" && canvas.background === color ? "active" : ""}" data-color="${color}" style="background:${color}"><span>${state.lang === "zh" ? label : color}</span></button>`).join("")}
      </div>
      <label class="field">${fieldValue(t("background"), "")}<input id="background" type="color" value="${canvas.background || "#16161a"}"></label>
      ${systemGrid}` : ""}
    ${state.bgTab === "pattern" ? `
      <div class="preset-grid wallpaper-grid">
        ${Object.keys(PATTERN_LABELS.zh).map((id) => `<button class="tile ${canvas.pattern === id ? "active" : ""}" data-pattern="${id}" style="background:${patternPreview(id)}"><span>${PATTERN_LABELS[state.lang][id]}</span></button>`).join("")}
      </div>
      <label class="field">${fieldValue(t("scale"), `${Number(canvas.pattern_scale || 1).toFixed(1)}x`)}<input id="pattern-scale" type="range" min="0.5" max="5" step="0.1" value="${canvas.pattern_scale || 1}"></label>
      <label class="field">${fieldValue(state.lang === "zh" ? "不透明度" : "Opacity", `${Math.round((canvas.pattern_opacity || 1) * 100)}%`)}<input id="pattern-opacity" type="range" min="0.05" max="1" step="0.05" value="${canvas.pattern_opacity || 1}"></label>` : ""}
    ${state.bgTab === "dynamic" ? `
      <div class="preset-grid wallpaper-grid">
        ${Object.keys(DYNAMIC_LABELS.zh).map((id) => `<button class="tile ${canvas.dynamic === id ? "active" : ""}" data-dynamic="${id}" style="background:${dynamicPreview(id)}"><span>${DYNAMIC_LABELS[state.lang][id]}</span></button>`).join("")}
      </div>` : ""}`;
}

function layoutPanel(canvas) {
  return `
    <label class="field">${fieldValue(t("padding"), `${Math.round((canvas.padding || 0) * 100)}%`)}<input id="padding" type="range" min="0" max="0.25" step="0.01" value="${canvas.padding}"></label>
    <label class="field">${fieldValue(t("radius"), `${Math.round(canvas.radius || 0)}`)}<input id="radius" type="range" min="0" max="80" step="1" value="${canvas.radius}"></label>
    <label class="field">${fieldValue(t("shadow"), `${Math.round((canvas.shadow || 0) * 100)}%`)}<input id="shadow" type="range" min="0" max="1" step="0.05" value="${canvas.shadow}"></label>
    <label class="field">${fieldValue(t("border"), `${Math.round(canvas.border || 0)}`)}<input id="border" type="range" min="0" max="24" step="1" value="${canvas.border || 0}"></label>
    <label class="field">${fieldValue(t("scale"), `${Number(canvas.content_scale || 1).toFixed(2)}x`)}<input id="content-scale" type="range" min="0.5" max="1.5" step="0.01" value="${canvas.content_scale || 1}"></label>
    <label class="field">${fieldValue(state.lang === "zh" ? "水平位置" : "X", `${Math.round((canvas.content_x ?? 0.5) * 100)}%`)}<input id="content-x" type="range" min="0" max="1" step="0.01" value="${canvas.content_x ?? 0.5}"></label>
    <label class="field">${fieldValue(state.lang === "zh" ? "垂直位置" : "Y", `${Math.round((canvas.content_y ?? 0.5) * 100)}%`)}<input id="content-y" type="range" min="0" max="1" step="0.01" value="${canvas.content_y ?? 0.5}"></label>`;
}

function mockupSilhouette(id) {
  if (id === "none") return `<span class="mock-sil none"></span>`;
  if (id === "devicePhone") return `<span class="mock-sil phone"><i></i></span>`;
  if (String(id).startsWith("browser")) return `<span class="mock-sil browser ${String(id).endsWith("Dark") ? "dark" : ""}"><i></i><em></em></span>`;
  return `<span class="mock-sil window ${String(id).endsWith("Dark") ? "dark" : ""}"><i></i><i></i><i></i></span>`;
}

function mockupPanel(canvas) {
  const ids = Object.keys(FRAME_LABELS.zh);
  return `
    <div class="section-title">${state.lang === "zh" ? "样机转盘" : "Mockup wheel"}</div>
    <div class="mockup-wheel" id="mockup-wheel">
      ${ids.map((id) => `<button class="mockup-card ${canvas.screen_frame === id ? "active" : ""}" data-frame="${id}">
        ${mockupSilhouette(id)}
        <strong>${FRAME_LABELS[state.lang][id]}</strong>
      </button>`).join("")}
    </div>
    <label class="field">${fieldValue(state.lang === "zh" ? "框体比例" : "Frame", `${Number(canvas.frame_scale || 1).toFixed(2)}x`)}<input id="frame-scale" type="range" min="0.6" max="1.6" step="0.05" value="${canvas.frame_scale || 1}"></label>
    <label class="field">${fieldValue(state.lang === "zh" ? "顶栏高度" : "Toolbar", `${Number(canvas.toolbar_scale || 1).toFixed(2)}x`)}<input id="toolbar-scale" type="range" min="0.65" max="1.6" step="0.05" value="${canvas.toolbar_scale || 1}"></label>
    <label class="field">${state.lang === "zh" ? "标题" : "Title"}<input id="frame-title" type="text" value="${escapeHtml(canvas.frame_title || "DogSC")}"></label>
    <label class="field">${state.lang === "zh" ? "地址" : "Address"}<input id="frame-address" type="text" value="${escapeHtml(canvas.frame_address || "dogsc.app")}"></label>`;
}

function openingInspector() {
  const opening = state.project.opening || {};
  return `
    <h2>${t("opening")}</h2>
    <label class="row"><input id="opening-enabled" type="checkbox" ${opening.enabled ? "checked" : ""}> 启用开场</label>
    <div class="section">
      ${Object.keys(OPENING_LABELS.zh).map((id) => `<button class="choice-card ${opening.preset === id ? "active" : ""}" data-opening="${id}"><strong>${OPENING_LABELS[state.lang][id]}</strong></button>`).join("")}
    </div>
    <label class="field">时长<input id="opening-duration" type="range" min="0.4" max="4" step="0.1" value="${opening.duration || 1.4}"></label>
    <label class="field">节奏<select id="opening-curve">${options(["smooth","swift","gentle"], opening.curve || "smooth", { smooth: "平滑", swift: "利落", gentle: "柔和" })}</select></label>`;
}

function motionInspector() {
  const selected = state.project.zooms.find((zoom) => zoom.id === state.selectedZoom);
  const motion = state.project.screen_motions?.find((item) => item.id === state.selectedMotion);
  const zh = state.lang === "zh";
  return `
    <div class="inspector-scope">
      <div class="scope-row">
        <div class="scope-title">${t("motion")}</div>
        <span class="scope-chip">${selected || motion ? (zh ? "已选中" : "Selected") : (zh ? "初始状态" : "Idle")}</span>
      </div>
      <button class="btn primary scope-add" id="${state.motionMode === "tilt" ? "add-tilt" : "add-zoom"}">${state.motionMode === "tilt" ? t("addTilt") : t("zoom")}</button>
    </div>
    <div class="segmented" style="margin-bottom:10px">
      <button data-motion-drive="auto" class="${state.motionDrive === "auto" ? "active" : ""}">${t("autoMotion")}</button>
      <button data-motion-drive="manual" class="${state.motionDrive === "manual" ? "active" : ""}">${t("manualMotion")}</button>
    </div>
    <div class="segmented mode-pair" style="margin-bottom:14px">
      <button data-motion-mode="zoom" class="${state.motionMode === "zoom" ? "active" : ""}">${zh ? "缩放" : "Zoom"}</button>
      <button data-motion-mode="tilt" class="${state.motionMode === "tilt" ? "active" : ""}">${zh ? "屏幕 3D" : "Screen 3D"}</button>
    </div>
    ${state.motionMode === "zoom" ? (selected ? `
      <div class="focus-map" id="focus-map" style="background:${backgroundCss(state.project.canvas)}">
        <div class="focus-preview"></div>
        <div class="reticle" style="left:${Number(selected.focus_x ?? 0.5) * 100}%;top:${Number(selected.focus_y ?? 0.5) * 100}%"></div>
      </div>
      <div class="coord-row">
        <span>X ${Math.round(Number(selected.focus_x ?? 0.5) * 100)}%</span>
        <span>Y ${Math.round(Number(selected.focus_y ?? 0.5) * 100)}%</span>
      </div>
      ${envelopeHtml(selected.easing || "cubic")}
      <div class="dial-row">
        ${dialHtml(zh ? "放大" : "Zoom", `${Number(selected.scale).toFixed(2)}x`, (Number(selected.scale) - 1) / 3)}
        ${dialHtml(zh ? "进入" : "In", `${Number(selected.enter || 0.45).toFixed(1)}s`, Number(selected.enter || 0.45) / 2)}
        ${dialHtml(zh ? "退出" : "Out", `${Number(selected.exit || 0.45).toFixed(1)}s`, Number(selected.exit || 0.45) / 2)}
      </div>
      <label class="field">${fieldValue(t("scale"), `${Number(selected.scale).toFixed(2)}x`)}<input id="zoom-scale" type="range" min="1" max="4" step="0.05" value="${selected.scale}"></label>
      <label class="field">${fieldValue(t("enter"), `${Number(selected.enter || 0.45).toFixed(2)}s`)}<input id="zoom-enter" type="range" min="0" max="2" step="0.05" value="${selected.enter || 0.45}"></label>
      <label class="field">${fieldValue(t("exit"), `${Number(selected.exit || 0.45).toFixed(2)}s`)}<input id="zoom-exit" type="range" min="0" max="2" step="0.05" value="${selected.exit || 0.45}"></label>
      <label class="field">${t("easing")}<select id="easing">${options(Object.keys(EASING[state.lang]), selected.easing, EASING[state.lang])}</select></label>
      <button class="btn" id="apply-all-zooms" style="width:100%;margin:8px 0">${t("applyAll")}</button>
      <button class="btn ghost" id="delete-zoom">${t("deleteZoom")}</button>` : `<div class="empty-action scope-card">
        <p class="note">${zh ? "在时间线选择一段缩放，或在播放头加入运镜。" : "Select a zoom on the timeline, or add one at the playhead."}</p>
        <button class="btn" id="auto-zoom">${t("auto")}</button>
      </div>`) : (motion ? `
      <div class="tilt-pad" id="tilt-pad"><div class="knob-dot" id="tilt-dot" style="left:${50 + Number(motion.rotation_y || 0)}%;top:${50 - Number(motion.rotation_x || 0)}%"></div></div>
      <label class="field">${fieldValue("Z", `${Math.round(motion.rotation_z || 0)}°`)}<input id="rotation-z" type="range" min="-30" max="30" step="1" value="${motion.rotation_z || 0}"></label>
      <label class="field">${fieldValue(zh ? "透视" : "Perspective", Number(motion.perspective || 0.65).toFixed(2))}<input id="perspective" type="range" min="0" max="2" step="0.05" value="${motion.perspective || 0.65}"></label>
      <label class="field">${fieldValue(t("scale"), `${Number(motion.scale || 1).toFixed(2)}x`)}<input id="motion-scale" type="range" min="0.5" max="2" step="0.05" value="${motion.scale || 1}"></label>
      <button class="btn ghost" id="delete-motion">${t("delete")}</button>` : `<div class="empty-action scope-card">
        <p class="note">${zh ? "在播放头加入 3D 运镜。" : "Add a 3D motion at the playhead."}</p>
      </div>`)}
    ${state.selectedMosaic ? `
      <div class="section"><div class="section-title">${t("mosaic")}</div>
        <label class="field">${fieldValue(zh ? "强度" : "Strength", `${Math.round((state.selectedMosaic.intensity || 0.55) * 100)}%`)}<input id="mosaic-intensity" type="range" min="0.1" max="1" step="0.05" value="${state.selectedMosaic.intensity || 0.55}"></label>
        <button class="btn" id="delete-mosaic">${t("delete")}</button>
      </div>` : ""}`;
}

function cursorInspector() {
  const cursor = state.project.cursor || {};
  return `
    <h2>${t("cursor")}</h2>
    <div class="section">
      ${Object.keys(CURSOR_LABELS.zh).map((id) => `<button class="choice-card ${cursor.asset === id ? "active" : ""}" data-cursor="${id}"><strong>${CURSOR_LABELS[state.lang][id]}</strong></button>`).join("")}
    </div>
    <label class="field">${t("scale")}<input id="cursor-size" type="range" min="0.5" max="3" step="0.05" value="${cursor.size || 1}"></label>
    <label class="field">点击反馈<select id="click-effect">${options(Object.keys(CLICK_LABELS.zh), cursor.click_effect || "ripple", CLICK_LABELS[state.lang])}</select></label>
    <label class="field">移动手感<select id="cursor-motion">${options(["smooth","medium","rapid","none"], cursor.motion || "smooth", { smooth: "平滑", medium: "适中", rapid: "快速", none: "无" })}</select></label>
    <label class="row"><input id="hide-idle" type="checkbox" ${cursor.hide_when_idle ? "checked" : ""}> 静止后隐藏</label>`;
}

function cameraInspector() {
  const camera = state.project.camera || {};
  return `
    <h2>${t("camera")}</h2>
    <label class="row"><input id="camera-enabled" type="checkbox" ${camera.enabled ? "checked" : ""}> 显示摄像头</label>
    <label class="field">形状<select id="camera-shape">${options(["circle","square","horizontal","vertical","original"], camera.shape || "circle", { circle: "圆形", square: "方形", horizontal: "横向", vertical: "纵向", original: "原始比例" })}</select></label>
    <label class="field">大小<input id="camera-size" type="range" min="0.1" max="0.45" step="0.01" value="${camera.size || 0.22}"></label>
    <label class="field">水平<input id="camera-x" type="range" min="0" max="1" step="0.01" value="${camera.x ?? 0.82}"></label>
    <label class="field">垂直<input id="camera-y" type="range" min="0" max="1" step="0.01" value="${camera.y ?? 0.78}"></label>
    <label class="row"><input id="camera-mirror" type="checkbox" ${camera.mirror ? "checked" : ""}> 镜像</label>
    <p class="note">${t("note")}</p>`;
}

function audioInspector() {
  const audio = state.project.audio || {};
  const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
  return `
    <h2>${t("audio")}</h2>
    <div class="section-title">调音台</div>
    <label class="field">系统声音<input id="system-volume" type="range" min="0" max="2" step="0.05" value="${audio.system_volume ?? 1}"></label>
    <label class="row"><input id="system-muted" type="checkbox" ${audio.system_muted ? "checked" : ""}> 静音系统声音</label>
    <label class="field">麦克风<input id="mic-volume" type="range" min="0" max="2" step="0.05" value="${audio.mic_volume ?? 1}"></label>
    <label class="row"><input id="mic-muted" type="checkbox" ${audio.mic_muted ? "checked" : ""}> 静音麦克风</label>
    <div class="section" style="margin-top:18px">
      <div class="section-title">${t("export")}</div>
      <label class="field">${t("resolution")}<select id="resolution">${options(["source", "1080p", "1440p", "4k"], state.project.export.resolution)}</select></label>
      <label class="field">${t("fps")}<select id="export-fps">${options(["30", "60"], String(state.project.export.fps))}</select></label>
    </div>
    ${clip ? `
      <div class="section"><div class="section-title">当前片段</div>
        <label class="field">${t("speed")}<input id="speed" type="range" min="0.5" max="4" step="0.25" value="${clip.speed || 1}"></label>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="move-earlier">${t("earlier")}</button>
          <button class="btn" id="move-later">${t("later")}</button>
          <button class="btn ghost" id="delete-clip">${t("deleteClip")}</button>
        </div>
      </div>` : ""}`;
}

function patternPreview(id) {
  const map = {
    obsidianGrid: "linear-gradient(#0c0d10,#17181c)",
    engineeringWhiteGrid: "linear-gradient(#f4f1ea,#e8e2d6)",
    midnightDots: "radial-gradient(circle at 30% 40%, #7a8cb4, #0a0c12 60%)",
    architecturalDots: "radial-gradient(circle at 50% 50%, #aaa, #ecece8 55%)",
    isometricMesh: "linear-gradient(135deg,#12161c,#243040)",
  };
  return map[id] || "#222";
}
function dynamicPreview(id) {
  const map = {
    cyberDriftGrid: "linear-gradient(135deg,#081218,#286078 50%,#b48c3c)",
    starfieldDots: "radial-gradient(circle at 20% 30%, #6a5030, #0c0a0e 55%)",
    auroraFluid: "linear-gradient(160deg,#143060,#3aa0c8 45%,#dfeaff)",
  };
  return map[id] || "#222";
}

function bindHome() {
  document.querySelector("#lang")?.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("dogsc-lang", state.lang);
    render();
  });
  document.querySelectorAll("[data-open]").forEach((node) => node.onclick = () => openProject(node.dataset.open));
  document.querySelectorAll("[data-delete]").forEach((node) => node.onclick = async () => {
    const target = state.projects.find((item) => item.id === node.dataset.delete);
    const name = target?.name || (state.lang === "zh" ? "未命名" : "Untitled");
    if (!confirm(state.lang === "zh" ? `删除「${name}」？此操作不可恢复。` : `Delete “${name}”? This can’t be undone.`)) return;
    await api(`/api/projects/${node.dataset.delete}`, { method: "DELETE" });
    state.projects = await api("/api/projects");
    toast(state.lang === "zh" ? `已删除「${name}」` : `Deleted “${name}”`);
    render();
  });
  document.querySelectorAll("#go-demo").forEach((node) => node.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    DogSCMotion.press(button);
    toast(state.lang === "zh" ? "正在生成示例…" : "Creating the example…");
    try { await openProject((await api("/api/demo", { method: "POST" })).id); }
    catch (error) { toast(error.message); if (button.isConnected) button.disabled = false; }
  }));
  document.querySelectorAll("#file").forEach((file) => {
    file.onchange = async () => {
      const data = new FormData();
      data.append("file", file.files[0]);
      try { await openProject((await api("/api/projects/import", { method: "POST", body: data })).id); }
      catch (error) { toast(error.message); }
    };
  });
  document.querySelector("#go-path")?.addEventListener("click", async () => {
    const path = prompt(state.lang === "zh" ? "视频文件的绝对路径" : "Absolute path to a video");
    if (!path) return;
    try { await openProject((await api("/api/projects/import", { method: "POST", body: { path } })).id); }
    catch (error) { toast(error.message); }
  });
  document.querySelector("#mode-wheel")?.addEventListener("click", async () => {
    state.recorderPopover = state.recorderPopover === "source" ? null : "source";
    if (state.recorderPopover === "source") await loadSources();
    render();
  });
  document.querySelectorAll("[data-pop]").forEach((node) => node.onclick = async () => {
    const id = node.dataset.pop;
    state.recorderPopover = state.recorderPopover === id ? null : id;
    if (id === "source") await loadSources();
    render();
  });
  document.querySelectorAll("[data-source]").forEach((node) => node.onclick = () => {
    state.record.source = node.dataset.source;
    if (node.dataset.source === "region") state.recorderPopover = "source";
    render();
  });
  document.querySelectorAll("[data-display]").forEach((node) => node.onclick = () => {
    state.record.source = "display";
    state.record.display = Number(node.dataset.display);
    state.recorderPopover = null;
    render();
  });
  document.querySelectorAll("[data-window]").forEach((node) => node.onclick = () => {
    state.record.source = "window";
    state.record.window = node.dataset.window;
    state.recorderPopover = null;
    render();
  });
  const mic = document.querySelector("#mic");
  if (mic) mic.onchange = () => { state.record.mic = mic.checked; render(); };
  const system = document.querySelector("#system");
  if (system) system.onchange = () => { state.record.system = system.checked; render(); };
  const cam = document.querySelector("#rec-camera");
  if (cam) cam.onchange = () => { state.record.camera = cam.checked; render(); };
  const fps = document.querySelector("#fps");
  if (fps) fps.onchange = () => { state.record.fps = Number(fps.value); };
  document.querySelector("#pick-region")?.addEventListener("click", async () => {
    try {
      state.record.geometry = await api("/api/record/region", { method: "POST", body: {} });
      state.recorderPopover = null;
      render();
    } catch (error) { toast(error.message); }
  });
  document.querySelector("#start-record")?.addEventListener("click", (event) => {
    DogSCMotion.press(event.currentTarget);
    startRecording();
  });
  document.querySelector("#stop-record")?.addEventListener("click", stopRecording);
  document.querySelector("#add-marker")?.addEventListener("click", () => api("/api/record/marker", { method: "POST", body: {} }).catch((error) => toast(error.message)));
  const pop = document.querySelector("#rec-pop");
  if (pop) {
    pop.style.transition = DogSCMotion.cssTransition("morph");
    pop.style.opacity = "0";
    pop.style.transform = "translateX(-50%) translateY(8px) scale(0.96)";
    pop.style.pointerEvents = "none";
    requestAnimationFrame(() => {
      pop.style.opacity = "1";
      pop.style.transform = "translateX(-50%) translateY(0) scale(1)";
      pop.style.pointerEvents = "auto";
    });
    const focusable = pop.querySelector("button.choice, button[data-source], input, select, button");
    focusable?.focus?.();
  }
  document.addEventListener("pointerdown", dismissRecorderPopover, { once: true });
}

function dismissRecorderPopover(event) {
  if (!state.recorderPopover) return;
  if (event.target.closest("#recorder-capsule, #rec-pop, .recorder-dock")) {
    document.addEventListener("pointerdown", dismissRecorderPopover, { once: true });
    return;
  }
  state.recorderPopover = null;
  render();
}

function dismissHudMenu(event) {
  if (!state.hudMenu) return;
  if (event.target.closest("#shortcuts-panel, #settings-btn, .hud-menu, #aspect-btn, #add-btn, #preview-btn")) {
    document.addEventListener("pointerdown", dismissHudMenu, { once: true });
    return;
  }
  state.hudMenu = null;
  render();
}

function bind() {
  if (state.view === "home" || state.view === "record") {
    bindHome();
    return;
  }
  document.querySelector("#lang")?.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("dogsc-lang", state.lang);
    render();
  });
  document.querySelector("#back").onclick = () => {
    state.view = "home";
    state.project = null;
    state.playing = false;
    state.hudMenu = null;
    loadSources().then(() => render({ transition: true }));
  };
  document.querySelector("#delete-project")?.addEventListener("click", async () => {
    const name = state.project?.name || (state.lang === "zh" ? "未命名" : "Untitled");
    if (!confirm(state.lang === "zh" ? `删除「${name}」？此操作不可恢复。` : `Delete “${name}”? This can’t be undone.`)) return;
    await api(`/api/projects/${state.project.id}`, { method: "DELETE" });
    state.project = null;
    state.view = "home";
    state.playing = false;
    state.projects = await api("/api/projects");
    toast(state.lang === "zh" ? `已删除「${name}」` : `Deleted “${name}”`);
    render();
  });
  document.querySelector("#settings-btn")?.addEventListener("click", () => {
    state.hudMenu = state.hudMenu === "shortcuts" ? null : "shortcuts";
    render();
  });
  if (state.hudMenu) document.addEventListener("pointerdown", dismissHudMenu, { once: true });
  document.querySelector("#undo").onclick = () => mutate(`/api/projects/${state.project.id}/undo`, {});
  document.querySelector("#redo").onclick = () => mutate(`/api/projects/${state.project.id}/redo`, {});
  document.querySelector("#export").onclick = openExportSheet;
  document.querySelector("#export-cancel")?.addEventListener("click", () => {
    if (state.exportSheet?.state === "running") return;
    state.exportSheet = null;
    render();
  });
  document.querySelector("#export-scrim")?.addEventListener("click", (event) => {
    if (event.target.id !== "export-scrim" || state.exportSheet?.state === "running") return;
    state.exportSheet = null;
    render();
  });
  document.querySelector("#export-start")?.addEventListener("click", startExportFromSheet);
  document.querySelector("#sheet-resolution")?.addEventListener("change", async (event) => {
    await meta({ export: { ...state.project.export, resolution: event.target.value } });
    refreshExportEstimate();
  });
  document.querySelector("#sheet-fps")?.addEventListener("change", async (event) => {
    await meta({ export: { ...state.project.export, fps: Number(event.target.value) } });
    refreshExportEstimate();
  });
  document.querySelector("#apply-all-zooms")?.addEventListener("click", async () => {
    const selected = state.project.zooms.find((zoom) => zoom.id === state.selectedZoom);
    if (!selected) return;
    try {
      for (const zoom of state.project.zooms) {
        state.project = await api(`/api/projects/${state.project.id}/zoom-update`, {
          method: "POST",
          body: { id: zoom.id, scale: selected.scale, enter: selected.enter, exit: selected.exit, easing: selected.easing },
        });
      }
      toast(state.lang === "zh" ? "已应用到全部运镜" : "Applied to all zooms");
      render();
    } catch (error) { toast(error.message); }
  });
  document.querySelector("#play").onclick = togglePlay;
  document.querySelector("#step-back").onclick = () => {
    state.playing = false;
    updatePlayButton();
    state.time = Math.max(state.time - 0.1, 0);
    paintCanvas();
  };
  document.querySelector("#step-forward").onclick = () => {
    state.playing = false;
    updatePlayButton();
    state.time = Math.min(state.time + 0.1, Z.duration(state.project.clips));
    paintCanvas();
  };
  document.querySelector("#split").onclick = () => mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
  document.querySelector("#delete-selection")?.addEventListener("click", () => {
    if (state.selectedZoom) {
      api(`/api/projects/${state.project.id}/zooms/${state.selectedZoom}`, { method: "DELETE" })
        .then((project) => { state.project = project; state.selectedZoom = null; render(); })
        .catch((error) => toast(error.message));
      return;
    }
    const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
    if (clip) mutate(`/api/projects/${state.project.id}/delete-clip`, { id: clip.id });
  });
  document.querySelector("#restore-cuts")?.addEventListener("click", async () => {
    if (!(state.project.deleted_clips || []).length) {
      toast(state.lang === "zh" ? "暂无已删除剪辑可恢复" : "No deleted cuts to restore");
      return;
    }
    try {
      state.project = await api(`/api/projects/${state.project.id}/restore-clip`, { method: "POST", body: {} });
      toast(state.lang === "zh" ? "已恢复剪辑" : "Cut restored");
      render();
    } catch (error) { toast(error.message); }
  });
  document.querySelector("#add-zoom")?.addEventListener("click", () => mutate(`/api/projects/${state.project.id}/zoom`, { time: state.time, focus_x: 0.5, focus_y: 0.5, scale: 1.6 }));
  document.querySelector("#auto-zoom")?.addEventListener("click", () => mutate(`/api/projects/${state.project.id}/zoom-auto`, {}));
  document.querySelector("#add-tilt")?.addEventListener("click", () => mutate(`/api/projects/${state.project.id}/screen-motion`, { time: state.time, rotation_x: 12, rotation_y: -10 }));
  document.querySelector("#add-mosaic")?.addEventListener("click", () => { state.hudMenu = null; mutate(`/api/projects/${state.project.id}/mosaic`, { time: state.time }); });
  document.querySelector("#add-edit-marker")?.addEventListener("click", () => mutate(`/api/projects/${state.project.id}/marker`, { time: state.time }));
  document.querySelector("#sticker-file")?.addEventListener("change", async (event) => {
    const data = new FormData();
    data.append("file", event.target.files[0]);
    try {
      state.project = await api(`/api/projects/${state.project.id}/sticker-upload`, { method: "POST", body: data });
      state.hudMenu = null;
      render();
    } catch (error) { toast(error.message); }
  });
  document.querySelector("#project-name").onchange = (event) => meta({ name: event.target.value });
  document.querySelector("#aspect-btn")?.addEventListener("click", () => { state.hudMenu = state.hudMenu === "aspect" ? null : "aspect"; render(); });
  document.querySelector("#add-btn")?.addEventListener("click", () => { state.hudMenu = state.hudMenu === "add" ? null : "add"; render(); });
  document.querySelector("#preview-btn")?.addEventListener("click", () => { state.hudMenu = state.hudMenu === "preview" ? null : "preview"; render(); });
  document.querySelector("#crop-btn")?.addEventListener("click", () => { beginCrop(); render(); });
  document.querySelector("#crop-cancel")?.addEventListener("click", () => { discardCrop(); render(); });
  document.querySelector("#crop-confirm")?.addEventListener("click", () => confirmCrop());
  document.querySelector("#crop-reset")?.addEventListener("click", () => { resetCropDraft(); syncCropInspector(); });
  document.querySelectorAll("[data-preview]").forEach((node) => node.onclick = () => {
    state.previewQuality = node.dataset.preview;
    localStorage.setItem("dogsc-preview-quality", state.previewQuality);
    state.hudMenu = null;
    render();
  });
  document.querySelectorAll("[data-aspect]").forEach((node) => node.onclick = () => {
    state.hudMenu = null;
    meta({ canvas: { ...state.project.canvas, aspect: node.dataset.aspect } });
  });
  ["#crop-left", "#crop-top", "#crop-width", "#crop-height"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", () => {
      if (!state.cropping) return;
      const left = Number(document.querySelector("#crop-left")?.value || 0);
      const top = Number(document.querySelector("#crop-top")?.value || 0);
      const width = Number(document.querySelector("#crop-width")?.value || 1);
      const height = Number(document.querySelector("#crop-height")?.value || 1);
      state.cropDraft = clampCrop({ x: left, y: top, width: Math.min(width, 1 - left), height: Math.min(height, 1 - top) });
      syncCropOverlay();
      syncCropInspector();
    });
  });
  document.querySelector("#mode-picture")?.addEventListener("click", () => { state.timelineMode = "picture"; render(); });
  document.querySelector("#mode-wave")?.addEventListener("click", () => {
    state.timelineMode = "waveform";
    ensurePeaks().then(() => render()).catch(() => render());
  });
  document.querySelector("#magnetic")?.addEventListener("click", () => { state.magnetic = !state.magnetic; magneticSession.reset(); render(); });
  document.querySelector("#hover-preview")?.addEventListener("click", () => { state.hoverPreview = !state.hoverPreview; render(); });
  document.querySelector("#tracks-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    state.trackMenu = !state.trackMenu;
    render();
  });
  document.querySelectorAll("#track-menu [data-track]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = node.dataset.track;
      state.trackVisibility[key] = state.trackVisibility[key] === false;
      persistTracks();
      render();
    });
  });
  document.querySelector("#fit-all")?.addEventListener("click", () => {
    const lanes = document.querySelector("#lanes");
    const duration = Math.max(Z.duration(state.project.clips), 0.1);
    const usable = Math.max((lanes?.clientWidth || 640) - 100, 160);
    state.timelineZoom = Z.clamp(usable / (duration * 120), 0.35, 6);
    render();
  });
  document.querySelector("#timeline-zoom")?.addEventListener("input", (event) => {
    state.timelineZoom = Number(event.target.value);
    drawTimeline();
  });
  bindSplitters();
  document.querySelectorAll("[data-tab]").forEach((node) => node.onclick = () => {
    DogSCMotion.press(node);
    state.tab = node.dataset.tab;
    state.hudMenu = null;
    render();
  });
  document.querySelectorAll("[data-frame-tab]").forEach((node) => node.onclick = () => { state.frameTab = node.dataset.frameTab; render(); });
  document.querySelectorAll("[data-bg-tab]").forEach((node) => node.onclick = () => {
    state.bgTab = node.dataset.bgTab;
    const kind = state.bgTab === "pattern" ? "pattern" : state.bgTab === "dynamic" ? "dynamic" : "solid";
    meta({ canvas: { ...state.project.canvas, background_kind: kind } });
  });
  document.querySelectorAll("[data-color]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "solid", background: node.dataset.color, background_image: null } }));
  document.querySelectorAll("[data-wallpaper]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "image", background_image: node.dataset.wallpaper } }));
  document.querySelectorAll("[data-pattern]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "pattern", pattern: node.dataset.pattern, background_image: null } }));
  document.querySelectorAll("[data-dynamic]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "dynamic", dynamic: node.dataset.dynamic, background_image: null } }));
  document.querySelectorAll("[data-frame]").forEach((node) => node.onclick = () => {
    meta({ canvas: { ...state.project.canvas, screen_frame: node.dataset.frame } });
    requestAnimationFrame(() => {
      node.scrollIntoView({ inline: "center", block: "nearest", behavior: DogSCMotion.reduces() ? "auto" : "smooth" });
    });
  });
  const wheel = document.querySelector("#mockup-wheel");
  if (wheel) {
    const active = wheel.querySelector(".mockup-card.active");
    if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" in window ? "instant" : "auto" });
  }
  ensureWallpapers();
  document.querySelectorAll("[data-opening]").forEach((node) => node.onclick = () => meta({ opening: { ...state.project.opening, preset: node.dataset.opening, enabled: true } }));
  document.querySelectorAll("[data-cursor]").forEach((node) => node.onclick = () => meta({ cursor: { ...state.project.cursor, asset: node.dataset.cursor } }));
  document.querySelectorAll("[data-motion-mode]").forEach((node) => node.onclick = () => { state.motionMode = node.dataset.motionMode; render(); });
  document.querySelectorAll("[data-motion-drive]").forEach((node) => node.onclick = () => { state.motionDrive = node.dataset.motionDrive; render(); });
  const focusMap = document.querySelector("#focus-map");
  if (focusMap) {
    const setFocus = (event) => {
      if (!state.selectedZoom) return;
      const rect = focusMap.getBoundingClientRect();
      const focus_x = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const focus_y = Z.clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const reticle = focusMap.querySelector(".reticle");
      if (reticle) {
        reticle.style.left = `${focus_x * 100}%`;
        reticle.style.top = `${focus_y * 100}%`;
      }
      return { focus_x, focus_y };
    };
    focusMap.onpointerdown = (event) => {
      event.preventDefault();
      let last = setFocus(event);
      const move = (next) => { last = setFocus(next); };
      const up = async () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (last) await updateZoom(last);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }
  bindInspectorFields();
}

function bindInspectorFields() {
  const map = [
    ["#background", (v) => meta({ canvas: { ...state.project.canvas, background_kind: "solid", background: v } })],
    ["#padding", (v) => meta({ canvas: { ...state.project.canvas, padding: Number(v) } })],
    ["#radius", (v) => meta({ canvas: { ...state.project.canvas, radius: Number(v) } })],
    ["#shadow", (v) => meta({ canvas: { ...state.project.canvas, shadow: Number(v) } })],
    ["#border", (v) => meta({ canvas: { ...state.project.canvas, border: Number(v) } })],
    ["#content-scale", (v) => meta({ canvas: { ...state.project.canvas, content_scale: Number(v) } })],
    ["#content-x", (v) => meta({ canvas: { ...state.project.canvas, content_x: Number(v) } })],
    ["#content-y", (v) => meta({ canvas: { ...state.project.canvas, content_y: Number(v) } })],
    ["#pattern-scale", (v) => meta({ canvas: { ...state.project.canvas, pattern_scale: Number(v) } })],
    ["#pattern-opacity", (v) => meta({ canvas: { ...state.project.canvas, pattern_opacity: Number(v) } })],
    ["#frame-scale", (v) => meta({ canvas: { ...state.project.canvas, frame_scale: Number(v) } })],
    ["#toolbar-scale", (v) => meta({ canvas: { ...state.project.canvas, toolbar_scale: Number(v) } })],
    ["#frame-title", (v) => meta({ canvas: { ...state.project.canvas, frame_title: v } })],
    ["#frame-address", (v) => meta({ canvas: { ...state.project.canvas, frame_address: v } })],
    ["#resolution", (v) => meta({ export: { ...state.project.export, resolution: v } })],
    ["#export-fps", (v) => meta({ export: { ...state.project.export, fps: Number(v) } })],
    ["#opening-enabled", (v, el) => meta({ opening: { ...state.project.opening, enabled: el.checked } }), "change"],
    ["#opening-duration", (v) => meta({ opening: { ...state.project.opening, duration: Number(v) } })],
    ["#opening-curve", (v) => meta({ opening: { ...state.project.opening, curve: v } })],
    ["#zoom-scale", (v) => updateZoom({ scale: Number(v) })],
    ["#zoom-enter", (v) => updateZoom({ enter: Number(v) })],
    ["#zoom-exit", (v) => updateZoom({ exit: Number(v) })],
    ["#easing", (v) => updateZoom({ easing: v })],
    ["#rotation-z", (v) => updateMotion({ rotation_z: Number(v) })],
    ["#perspective", (v) => updateMotion({ perspective: Number(v) })],
    ["#motion-scale", (v) => updateMotion({ scale: Number(v) })],
    ["#mosaic-intensity", (v) => updateMosaic({ intensity: Number(v) })],
    ["#cursor-size", (v) => meta({ cursor: { ...state.project.cursor, size: Number(v) } })],
    ["#click-effect", (v) => meta({ cursor: { ...state.project.cursor, click_effect: v } })],
    ["#cursor-motion", (v) => meta({ cursor: { ...state.project.cursor, motion: v } })],
    ["#hide-idle", (v, el) => meta({ cursor: { ...state.project.cursor, hide_when_idle: el.checked } }), "change"],
    ["#camera-enabled", (v, el) => meta({ camera: { ...state.project.camera, enabled: el.checked } }), "change"],
    ["#camera-shape", (v) => meta({ camera: { ...state.project.camera, shape: v } })],
    ["#camera-size", (v) => meta({ camera: { ...state.project.camera, size: Number(v) } })],
    ["#camera-x", (v) => meta({ camera: { ...state.project.camera, x: Number(v) } })],
    ["#camera-y", (v) => meta({ camera: { ...state.project.camera, y: Number(v) } })],
    ["#camera-mirror", (v, el) => meta({ camera: { ...state.project.camera, mirror: el.checked } }), "change"],
    ["#system-volume", (v) => meta({ audio: { ...state.project.audio, system_volume: Number(v) } })],
    ["#mic-volume", (v) => meta({ audio: { ...state.project.audio, mic_volume: Number(v) } })],
    ["#system-muted", (v, el) => meta({ audio: { ...state.project.audio, system_muted: el.checked } }), "change"],
    ["#mic-muted", (v, el) => meta({ audio: { ...state.project.audio, mic_muted: el.checked } }), "change"],
    ["#speed", (v) => mutate(`/api/projects/${state.project.id}/speed`, { id: Z.locateTimeline(state.project.clips, state.time).clip.id, speed: Number(v) })],
  ];
  map.forEach(([selector, handler, eventName]) => {
    const node = document.querySelector(selector);
    if (!node) return;
    node.addEventListener(eventName || "change", () => handler(node.type === "checkbox" ? node.checked : node.value, node));
  });
  document.querySelector("#delete-zoom")?.addEventListener("click", async () => {
    state.project = await api(`/api/projects/${state.project.id}/zooms/${state.selectedZoom}`, { method: "DELETE" });
    state.selectedZoom = null; render();
  });
  document.querySelector("#delete-motion")?.addEventListener("click", async () => {
    state.project = await api(`/api/projects/${state.project.id}/screen-motions/${state.selectedMotion}`, { method: "DELETE" });
    state.selectedMotion = null; render();
  });
  document.querySelector("#delete-mosaic")?.addEventListener("click", async () => {
    state.project = await api(`/api/projects/${state.project.id}/mosaics/${state.selectedMosaic.id}`, { method: "DELETE" });
    state.selectedMosaic = null; render();
  });
  document.querySelector("#delete-clip")?.addEventListener("click", () => {
    const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
    if (clip) mutate(`/api/projects/${state.project.id}/delete-clip`, { id: clip.id });
  });
  document.querySelector("#move-earlier")?.addEventListener("click", () => {
    const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
    if (clip) mutate(`/api/projects/${state.project.id}/move`, { id: clip.id, direction: -1 });
  });
  document.querySelector("#move-later")?.addEventListener("click", () => {
    const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
    if (clip) mutate(`/api/projects/${state.project.id}/move`, { id: clip.id, direction: 1 });
  });
  const pad = document.querySelector("#tilt-pad");
  if (pad) {
    const move = (event) => {
      const rect = pad.getBoundingClientRect();
      const x = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = Z.clamp((event.clientY - rect.top) / rect.height, 0, 1);
      updateMotion({ rotation_y: (x - 0.5) * 40, rotation_x: (0.5 - y) * 40 });
    };
    pad.onpointerdown = (event) => { pad.setPointerCapture(event.pointerId); move(event); };
    pad.onpointermove = (event) => { if (pad.hasPointerCapture(event.pointerId)) move(event); };
  }
}

async function meta(body) {
  try {
    state.project = await api(`/api/projects/${state.project.id}/meta`, { method: "POST", body });
    state.dirty = false;
    paintCanvas();
    if (["canvas", "cursor", "camera", "opening", "audio", "export", "name"].some((key) => key in body) && (body.canvas?.aspect || body.name || body.export || body.opening || body.cursor?.asset || body.camera?.enabled || body.camera?.shape)) {
      // Full re-render only when structure changes.
      if (body.canvas?.aspect || body.name || body.export || body.opening?.enabled || body.cursor?.asset || body.camera?.shape || body.camera?.enabled) render();
      else drawTimeline();
    }
  } catch (error) { toast(error.message); }
}

async function updateZoom(body) {
  if (!state.selectedZoom) return;
  await mutate(`/api/projects/${state.project.id}/zoom-update`, { id: state.selectedZoom, ...body });
}
async function updateMotion(body) {
  if (!state.selectedMotion) return;
  await mutate(`/api/projects/${state.project.id}/screen-motion-update`, { id: state.selectedMotion, ...body });
}
async function updateMosaic(body) {
  if (!state.selectedMosaic) return;
  await mutate(`/api/projects/${state.project.id}/mosaic-update`, { id: state.selectedMosaic.id, ...body });
}

async function mutate(path, body) {
  try {
    const selectedMosaicId = state.selectedMosaic?.id;
    const selectedStickerId = state.selectedSticker?.id;
    state.project = await api(path, { method: "POST", body });
    if (path.endsWith("/zoom") && state.project.zooms.length) state.selectedZoom = state.project.zooms.at(-1).id;
    if (path.endsWith("/screen-motion") && state.project.screen_motions.length) {
      state.selectedMotion = state.project.screen_motions.at(-1).id;
      state.motionMode = "tilt";
      state.tab = "motion";
    }
    if (path.endsWith("/mosaic") && state.project.mosaics.length) {
      state.selectedMosaic = state.project.mosaics.at(-1);
      state.tab = "motion";
    }
    if (path.endsWith("/mosaic-update") && selectedMosaicId) {
      state.selectedMosaic = (state.project.mosaics || []).find((item) => item.id === selectedMosaicId) || null;
    }
    if (path.endsWith("/sticker-update") && selectedStickerId) {
      state.selectedSticker = (state.project.stickers || []).find((item) => item.id === selectedStickerId) || null;
    }
    render();
  } catch (error) { toast(error.message); }
}

async function openProject(id) {
  state.project = await api(`/api/projects/${id}`);
  state.pointer = (await api(`/api/projects/${id}/pointer`)).events || [];
  state.view = "editor";
  state.time = 0;
  state.playing = false;
  state.selectedZoom = state.project.zooms[0]?.id || null;
  state.selectedMotion = null;
  state.selectedMosaic = null;
  state.selectedMarker = null;
  state.tab = "frame";
  render({ transition: true });
}

async function ensureWallpapers() {
  if (Array.isArray(state.wallpapers)) return;
  try {
    const payload = await api("/api/wallpapers");
    state.wallpapers = payload.items || [];
    if (state.view === "editor" && state.tab === "frame" && (state.bgTab === "wallpaper" || state.bgTab === "custom")) {
      const host = document.querySelector(".system-wallpapers");
      if (!host && state.wallpapers.length) render();
    }
  } catch (_) {
    state.wallpapers = [];
  }
}

async function loadSources() {
  state.sources = await api("/api/sources");
}

async function startRecording() {
  try {
    state.recorderPopover = null;
    state.recording = await api("/api/record/start", { method: "POST", body: {
      source: state.record.source,
      display_index: state.record.display,
      window_id: state.record.window,
      geometry: state.record.geometry,
      fps: state.record.fps,
      microphone: state.record.mic,
      system_audio: state.record.system,
    }});
    state.view = "home";
    render();
    pollRecording();
  } catch (error) { toast(error.message); }
}

async function pollRecording() {
  if (state.view !== "home" && state.view !== "record") return;
  try { state.recording = await api("/api/record"); } catch (error) { return; }
  const elapsed = document.querySelector("#elapsed");
  if (elapsed) elapsed.textContent = formatTime(state.recording.elapsed || 0);
  if (state.recording.active) setTimeout(pollRecording, 300);
  else if (document.querySelector(".record-go.live")) render();
}

async function stopRecording() {
  try {
    const project = await api("/api/record/stop", { method: "POST", body: {} });
    state.recording = { active: false, elapsed: 0 };
    await openProject(project.id);
  } catch (error) { toast(error.message); }
}

function mountPreview() {
  const project = state.project;
  const frame = document.querySelector("#canvas");
  frame.innerHTML = `<div class="content-box" id="content"><div class="content-shell" id="shell"><div class="chrome" id="chrome"></div><div class="camera" id="camera"><video id="video" src="/api/projects/${project.id}/media" playsinline></video><div class="stage-overlays" id="overlays"></div><div class="cursor" id="cursor" hidden></div><div class="focus-dot" id="focus" hidden></div><div class="crop-overlay" id="crop-overlay" hidden><div class="crop-shade" data-edge="top"></div><div class="crop-shade" data-edge="left"></div><div class="crop-shade" data-edge="right"></div><div class="crop-shade" data-edge="bottom"></div><div class="crop-rect" id="crop-rect"><i data-handle="nw"></i><i data-handle="n"></i><i data-handle="ne"></i><i data-handle="e"></i><i data-handle="se"></i><i data-handle="s"></i><i data-handle="sw"></i><i data-handle="w"></i></div></div></div><div class="pip" id="pip" hidden><video id="pip-video" playsinline muted autoplay></video><span>CAM</span></div></div></div>`;
  const video = document.querySelector("#video");
  DogSCPreview.attach(video);
  video.onloadedmetadata = paintCanvas;
  document.querySelector("#content").onclick = (event) => {
    if (state.cropping || !state.selectedZoom) return;
    const rect = document.querySelector("#camera").getBoundingClientRect();
    const view = Z.sampleViewport(project.clips, project.zooms, state.time);
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    const focusX = view.left + u * view.size;
    const focusY = view.top + v * view.size;
    updateZoom({ focus_x: Z.clamp(focusX, 0, 1), focus_y: Z.clamp(focusY, 0, 1) });
  };
  bindCropOverlay();
  bindStageDragDelegation();
  ensureCameraPip();
}

function paintCanvas() {
  const project = state.project;
  if (!project) return;
  const canvas = project.canvas;
  const content = document.querySelector("#content");
  const shell = document.querySelector("#shell");
  const camera = document.querySelector("#camera");
  const chrome = document.querySelector("#chrome");
  const video = document.querySelector("#video");
  const pip = document.querySelector("#pip");
  const frame = document.querySelector("#canvas");
  const cropOverlay = document.querySelector("#crop-overlay");
  if (!content || !camera || !video || !frame) return;
  const crop = activeCrop();
  const mediaW = Number(project.media.width) || 16;
  const mediaH = Number(project.media.height) || 9;
  const croppedW = mediaW * (state.cropping ? 1 : crop.width);
  const croppedH = mediaH * (state.cropping ? 1 : crop.height);
  const ratio = aspectRatio(canvas.aspect, croppedW, croppedH);
  frame.style.aspectRatio = `${ratio}`;
  content.style.background = state.cropping ? "#111218" : backgroundCss(canvas);
  const padding = state.cropping ? 0.04 : Number(canvas.padding || 0);
  const scale = state.cropping ? 1 : Number(canvas.content_scale || 1);
  const width = (1 - padding * 2) * scale * 100;
  camera.style.width = `${width}%`;
  camera.style.aspectRatio = `${croppedW} / ${croppedH}`;
  camera.style.borderRadius = state.cropping ? "10px" : `${canvas.radius || 0}px`;
  camera.style.boxShadow = state.cropping || !(canvas.shadow > 0) ? "none" : `0 18px 50px rgba(0,0,0,${0.2 + canvas.shadow * 0.45})`;
  camera.style.outline = !state.cropping && canvas.border > 0 ? `${canvas.border}px solid ${canvas.border_color || "#fff"}` : "none";
  const ox = (Number(canvas.content_x ?? 0.5) - 0.5) * padding * 200;
  const oy = (Number(canvas.content_y ?? 0.5) - 0.5) * padding * 200;
  shell.style.transform = state.cropping ? "" : `translate(${ox}%, ${oy}%)`;
  applyChrome(chrome, state.cropping ? { ...canvas, screen_frame: "none" } : canvas);
  const view = state.cropping
    ? { left: 0, top: 0, size: 1 }
    : Z.sampleViewport(project.clips, project.zooms, state.time);
  // Compose source crop + zoom viewport into one CSS transform on the video.
  const scaleX = 1 / (state.cropping ? 1 : crop.width * view.size);
  const scaleY = 1 / (state.cropping ? 1 : crop.height * view.size);
  const tx = state.cropping ? 0 : -(crop.x + view.left * crop.width) / (crop.width * view.size) * 100;
  const ty = state.cropping ? 0 : -(crop.y + view.top * crop.height) / (crop.height * view.size) * 100;
  video.style.transform = state.cropping
    ? "none"
    : `translate(${tx}%, ${ty}%) scale(${scaleX}, ${scaleY})`;
  video.style.filter = state.previewQuality === "fast" ? "contrast(0.98) saturate(0.92)" : "";
  const motion = state.cropping ? null : (project.screen_motions || []).map((item) => absoluteItem(item)).find((item) => state.time >= item.start && state.time <= item.end + Number(item.exit || 0));
  if (motion) {
    camera.style.transform = `perspective(${800 + Number(motion.perspective || 0.65) * 400}px) rotateX(${motion.rotation_x || 0}deg) rotateY(${motion.rotation_y || 0}deg) rotateZ(${motion.rotation_z || 0}deg) scale(${motion.scale || 1})`;
  } else {
    camera.style.transform = "";
  }
  const opening = project.opening || {};
  if (!state.cropping && opening.enabled && state.time < Number(opening.duration || 1.4)) {
    const p = state.time / Number(opening.duration || 1.4);
    const startScale = opening.preset === "sideSlide" ? 0.85 : opening.preset === "light3D" ? 0.92 : 0.72;
    shell.style.transform += ` scale(${startScale + (1 - startScale) * p})`;
    if (opening.preset === "light3D") shell.style.transform += ` rotateY(${(-18 + 18 * p)}deg)`;
  }
  placeCursor(state.cropping ? null : Z.locateTimeline(project.clips, state.time), view);
  placeFocusDot(view);
  paintStageOverlays();
  if (cropOverlay) {
    cropOverlay.hidden = !state.cropping;
    if (state.cropping) syncCropOverlay();
  }
  const cam = project.camera || {};
  if (pip) {
    pip.hidden = state.cropping || !cam.enabled;
    if (!pip.hidden) {
      const size = Number(cam.size || 0.22) * 100;
      pip.style.width = `${size}%`;
      pip.style.aspectRatio = cam.shape === "circle" || cam.shape === "square" ? "1" : cam.shape === "vertical" ? "9/16" : "16/9";
      pip.style.left = `${Number(cam.x || 0.82) * 100 - size / 2}%`;
      pip.style.top = `${Number(cam.y || 0.78) * 100 - size / 2}%`;
      pip.style.borderRadius = cam.shape === "circle" ? "999px" : `${(cam.roundness || 0.2) * 28}px`;
      pip.style.transform = cam.mirror ? "scaleX(-1)" : "";
      pip.style.opacity = cam.opacity == null ? 1 : Number(cam.opacity);
      pip.style.borderWidth = `${Number(cam.border || 3)}px`;
      pip.style.borderColor = cam.border_color || "#fff";
      pip.style.boxShadow = cam.shadow > 0 ? `0 10px 28px rgba(0,0,0,${0.12 + cam.shadow * 0.35})` : "none";
    }
  }
  const located = Z.locateTimeline(project.clips, state.time);
  if (located && !state.playing && state.hoverTime == null) {
    DogSCPreview.seekCoalesced(located.source, state.previewQuality === "full", state.previewQuality);
  }
  syncTransport();
}

function backgroundCss(canvas) {
  if (canvas.background_kind === "pattern") return patternPreview(canvas.pattern || "obsidianGrid");
  if (canvas.background_kind === "dynamic") return dynamicPreview(canvas.dynamic || "auroraFluid");
  if (canvas.background_kind === "image" && canvas.background_image) {
    return `center / cover no-repeat url("${canvas.background_image}"), ${canvas.background || "#16161a"}`;
  }
  return canvas.background || "#16161a";
}

function applyChrome(node, canvas) {
  if (!node) return;
  const style = canvas.screen_frame || "none";
  node.className = "chrome";
  node.innerHTML = "";
  if (style === "none") return;
  if (style === "devicePhone") {
    node.classList.add("phone");
    node.style.inset = "-18px -12px -18px -12px";
    return;
  }
  node.classList.add(style.startsWith("browser") ? "browser" : "window");
  if (style.endsWith("Dark")) node.classList.add("dark");
  node.style.inset = style.startsWith("browser") || style.startsWith("window") ? "-36px -10px -10px -10px" : "0";
  node.innerHTML = `<div class="traffic"><i class="r"></i><i class="y"></i><i class="g"></i></div>${style.startsWith("browser") ? `<div class="address">${escapeHtml(canvas.frame_address || "dogsc.app")}</div>` : ""}`;
}

function placeCursor(located, view) {
  const cursor = document.querySelector("#cursor");
  const asset = state.project.cursor?.asset || "system.arrow";
  if (!cursor || !located || state.cropping || state.project.capture?.cursor_baked || asset === "system.hidden") {
    if (cursor) cursor.hidden = true;
    return;
  }
  const offset = Number(state.project.cursor?.time_offset || 0);
  const event = [...state.pointer].reverse().find((item) => Number(item.t) <= located.source + offset + 0.02);
  if (!event) { cursor.hidden = true; return; }
  cursor.hidden = false;
  cursor.style.left = `${Number(event.x) * 100}%`;
  cursor.style.top = `${Number(event.y) * 100}%`;
  cursor.classList.toggle("click", event.kind === "left" && located.source - Number(event.t) < 0.25 && state.project.cursor?.click_effect !== "none");
}

function placeFocusDot(view) {
  const focus = document.querySelector("#focus");
  if (!focus || !state.project) return;
  const zoom = state.project.zooms?.find((item) => item.id === state.selectedZoom);
  if (!zoom || state.cropping) {
    focus.hidden = true;
    return;
  }
  focus.hidden = false;
  const fx = Number(zoom.focus_x ?? 0.5);
  const fy = Number(zoom.focus_y ?? 0.5);
  focus.style.left = `${((fx - view.left) / view.size) * 100}%`;
  focus.style.top = `${((fy - view.top) / view.size) * 100}%`;
}

function paintStageOverlays() {
  const host = document.querySelector("#overlays");
  if (!host || !state.project || state.cropping) {
    if (host) host.innerHTML = "";
    return;
  }
  const parts = [];
  for (const item of (state.project.mosaics || []).map(absoluteItem)) {
    if (state.time < item.start || state.time > item.end) continue;
    const intensity = Number(item.intensity || 0.55);
    const blur = 4 + intensity * 18;
    const selected = state.selectedMosaic && item.id === state.selectedMosaic.id;
    const alpha = (0.12 + intensity * 0.25).toFixed(3);
    const radius = ((item.corner_radius || 0.08) * 40).toFixed(1);
    parts.push(
      `<div class="overlay-mosaic${selected ? " selected" : ""}" data-overlay="mosaic" data-id="${item.id}" `
      + `style="left:${item.x * 100}%;top:${item.y * 100}%;width:${item.width * 100}%;height:${item.height * 100}%;`
      + `border-radius:${radius}px;backdrop-filter:blur(${blur}px);background:rgba(20,22,28,${alpha})">`
      + `<i class="overlay-handle" data-handle="nw"></i><i class="overlay-handle" data-handle="ne"></i>`
      + `<i class="overlay-handle" data-handle="se"></i><i class="overlay-handle" data-handle="sw"></i></div>`
    );
  }
  for (const item of (state.project.stickers || []).map(absoluteItem)) {
    if (state.time < item.start || state.time > item.end) continue;
    const selected = state.selectedSticker && item.id === state.selectedSticker.id;
    const opacity = item.opacity == null ? 1 : item.opacity;
    parts.push(
      `<div class="overlay-sticker${selected ? " selected" : ""}" data-overlay="sticker" data-id="${item.id}" `
      + `style="left:${item.x * 100}%;top:${item.y * 100}%;width:${item.width * 100}%;opacity:${opacity};`
      + `transform:translate(-50%,-50%) rotate(${item.rotation || 0}deg);border-radius:${item.corner_radius || 18}px">`
      + `<img src="/api/projects/${state.project.id}/${escapeHtml(item.path)}" alt="" draggable="false"></div>`
    );
  }
  host.innerHTML = parts.join("");
}

function bindStageDragDelegation() {
  const camera = document.querySelector("#camera");
  const host = document.querySelector("#overlays");
  const pip = document.querySelector("#pip");
  if (!camera || !host) return;
  host.onpointerdown = (event) => {
    const handle = event.target.closest(".overlay-handle");
    const node = event.target.closest("[data-overlay]");
    if (!node || state.cropping || state.playing) return;
    event.preventDefault();
    event.stopPropagation();
    const kind = node.dataset.overlay;
    const id = node.dataset.id;
    if (kind === "mosaic") {
      state.selectedMosaic = (state.project.mosaics || []).find((item) => item.id === id) || null;
      state.selectedSticker = null;
      state.tab = "motion";
    } else {
      state.selectedSticker = (state.project.stickers || []).find((item) => item.id === id) || null;
      state.selectedMosaic = null;
    }
    const box = camera.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    if (handle && kind === "mosaic" && state.selectedMosaic) {
      const corner = handle.dataset.handle;
      const origin = {
        x: Number(state.selectedMosaic.x || 0),
        y: Number(state.selectedMosaic.y || 0),
        width: Number(state.selectedMosaic.width || 0.3),
        height: Number(state.selectedMosaic.height || 0.25),
      };
      const move = (next) => {
        const dx = (next.clientX - startX) / Math.max(box.width, 1);
        const dy = (next.clientY - startY) / Math.max(box.height, 1);
        let left = origin.x;
        let top = origin.y;
        let right = origin.x + origin.width;
        let bottom = origin.y + origin.height;
        if (corner.includes("w")) left = origin.x + dx;
        if (corner.includes("e")) right = origin.x + origin.width + dx;
        if (corner.includes("n")) top = origin.y + dy;
        if (corner.includes("s")) bottom = origin.y + origin.height + dy;
        left = Z.clamp(left, 0, 0.95);
        top = Z.clamp(top, 0, 0.95);
        right = Z.clamp(right, left + 0.05, 1);
        bottom = Z.clamp(bottom, top + 0.05, 1);
        state.selectedMosaic = {
          ...state.selectedMosaic,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        };
        Object.assign(node.style, {
          left: `${left * 100}%`,
          top: `${top * 100}%`,
          width: `${(right - left) * 100}%`,
          height: `${(bottom - top) * 100}%`,
        });
      };
      const up = async () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        try {
          await mutate(`/api/projects/${state.project.id}/mosaic-update`, {
            id: state.selectedMosaic.id,
            x: state.selectedMosaic.x,
            y: state.selectedMosaic.y,
            width: state.selectedMosaic.width,
            height: state.selectedMosaic.height,
          });
        } catch (error) { toast(error.message); }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    const originX = kind === "mosaic" ? Number(state.selectedMosaic?.x || 0) : Number(state.selectedSticker?.x || 0);
    const originY = kind === "mosaic" ? Number(state.selectedMosaic?.y || 0) : Number(state.selectedSticker?.y || 0);
    const move = (next) => {
      const dx = (next.clientX - startX) / Math.max(box.width, 1);
      const dy = (next.clientY - startY) / Math.max(box.height, 1);
      if (kind === "mosaic" && state.selectedMosaic) {
        const width = Number(state.selectedMosaic.width || 0.3);
        const height = Number(state.selectedMosaic.height || 0.25);
        state.selectedMosaic = {
          ...state.selectedMosaic,
          x: Z.clamp(originX + dx, 0, 1 - width),
          y: Z.clamp(originY + dy, 0, 1 - height),
        };
        node.style.left = `${state.selectedMosaic.x * 100}%`;
        node.style.top = `${state.selectedMosaic.y * 100}%`;
      } else if (kind === "sticker" && state.selectedSticker) {
        state.selectedSticker = {
          ...state.selectedSticker,
          x: Z.clamp(originX + dx, 0.05, 0.95),
          y: Z.clamp(originY + dy, 0.05, 0.95),
        };
        node.style.left = `${state.selectedSticker.x * 100}%`;
        node.style.top = `${state.selectedSticker.y * 100}%`;
      }
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        if (kind === "mosaic" && state.selectedMosaic) {
          await mutate(`/api/projects/${state.project.id}/mosaic-update`, {
            id: state.selectedMosaic.id,
            x: state.selectedMosaic.x,
            y: state.selectedMosaic.y,
          });
        } else if (kind === "sticker" && state.selectedSticker) {
          await mutate(`/api/projects/${state.project.id}/sticker-update`, {
            id: state.selectedSticker.id,
            x: state.selectedSticker.x,
            y: state.selectedSticker.y,
          });
        }
      } catch (error) { toast(error.message); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  if (!pip) return;
  pip.onpointerdown = (event) => {
    if (state.cropping || !state.project.camera?.enabled) return;
    event.preventDefault();
    event.stopPropagation();
    const box = camera.getBoundingClientRect();
    const cam = state.project.camera || {};
    const originX = Number(cam.x || 0.82);
    const originY = Number(cam.y || 0.78);
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (next) => {
      const dx = (next.clientX - startX) / Math.max(box.width, 1);
      const dy = (next.clientY - startY) / Math.max(box.height, 1);
      const x = Z.clamp(originX + dx, 0.08, 0.92);
      const y = Z.clamp(originY + dy, 0.08, 0.92);
      const size = Number(cam.size || 0.22) * 100;
      pip.style.left = `${x * 100 - size / 2}%`;
      pip.style.top = `${y * 100 - size / 2}%`;
      pip.dataset.x = String(x);
      pip.dataset.y = String(y);
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      await meta({ camera: { ...state.project.camera, x: Number(pip.dataset.x || originX), y: Number(pip.dataset.y || originY) } });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

function syncCropOverlay() {
  const rect = document.querySelector("#crop-rect");
  const overlay = document.querySelector("#crop-overlay");
  if (!rect || !overlay || !state.cropDraft) return;
  const crop = clampCrop(state.cropDraft);
  rect.style.left = `${crop.x * 100}%`;
  rect.style.top = `${crop.y * 100}%`;
  rect.style.width = `${crop.width * 100}%`;
  rect.style.height = `${crop.height * 100}%`;
  const top = overlay.querySelector('[data-edge="top"]');
  const left = overlay.querySelector('[data-edge="left"]');
  const right = overlay.querySelector('[data-edge="right"]');
  const bottom = overlay.querySelector('[data-edge="bottom"]');
  if (top) Object.assign(top.style, { left: "0", top: "0", width: "100%", height: `${crop.y * 100}%` });
  if (bottom) Object.assign(bottom.style, { left: "0", top: `${(crop.y + crop.height) * 100}%`, width: "100%", height: `${(1 - crop.y - crop.height) * 100}%` });
  if (left) Object.assign(left.style, { left: "0", top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` });
  if (right) Object.assign(right.style, { left: `${(crop.x + crop.width) * 100}%`, top: `${crop.y * 100}%`, width: `${(1 - crop.x - crop.width) * 100}%`, height: `${crop.height * 100}%` });
}

function syncCropInspector() {
  const crop = clampCrop(state.cropDraft);
  const map = {
    "#crop-left": crop.x,
    "#crop-top": crop.y,
    "#crop-width": crop.width,
    "#crop-height": crop.height,
  };
  for (const [selector, value] of Object.entries(map)) {
    const node = document.querySelector(selector);
    if (node) node.value = String(value);
  }
  document.querySelectorAll("#crop-left, #crop-top, #crop-width, #crop-height").forEach((node) => {
    const label = node.closest("label")?.querySelector("em");
    if (label) label.textContent = `${Math.round(Number(node.value) * 100)}%`;
  });
}

function bindCropOverlay() {
  const rect = document.querySelector("#crop-rect");
  if (!rect) return;
  const startDrag = (event, mode, handle = null) => {
    if (!state.cropping) return;
    event.preventDefault();
    event.stopPropagation();
    const camera = document.querySelector("#camera");
    const origin = clampCrop(state.cropDraft);
    const box = camera.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (next) => {
      const dx = (next.clientX - startX) / Math.max(box.width, 1);
      const dy = (next.clientY - startY) / Math.max(box.height, 1);
      let draft = { ...origin };
      if (mode === "move") {
        draft.x = origin.x + dx;
        draft.y = origin.y + dy;
        draft.x = Math.min(Math.max(draft.x, 0), 1 - draft.width);
        draft.y = Math.min(Math.max(draft.y, 0), 1 - draft.height);
      } else {
        let left = origin.x;
        let top = origin.y;
        let right = origin.x + origin.width;
        let bottom = origin.y + origin.height;
        if (handle.includes("w")) left = origin.x + dx;
        if (handle.includes("e")) right = origin.x + origin.width + dx;
        if (handle.includes("n")) top = origin.y + dy;
        if (handle.includes("s")) bottom = origin.y + origin.height + dy;
        left = Math.min(Math.max(left, 0), 0.98);
        top = Math.min(Math.max(top, 0), 0.98);
        right = Math.min(Math.max(right, left + 0.02), 1);
        bottom = Math.min(Math.max(bottom, top + 0.02), 1);
        draft = clampCrop({ x: left, y: top, width: right - left, height: bottom - top });
      }
      state.cropDraft = clampCrop(draft);
      syncCropOverlay();
      syncCropInspector();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  rect.onpointerdown = (event) => {
    if (event.target.dataset.handle) return;
    startDrag(event, "move");
  };
  rect.querySelectorAll("[data-handle]").forEach((node) => {
    node.onpointerdown = (event) => startDrag(event, "resize", node.dataset.handle);
  });
}

function bindSplitters() {
  const vertical = document.querySelector("#splitter-v");
  const horizontal = document.querySelector("#splitter-h");
  vertical?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const workspace = document.querySelector(".workspace");
    if (!workspace) return;
    const move = (next) => {
      const rect = workspace.getBoundingClientRect();
      const width = Math.min(Math.max(rect.right - next.clientX, 340), 480);
      state.inspectorWidth = width;
      localStorage.setItem("dogsc-inspector-w", String(width));
      workspace.style.setProperty("--inspector-w", `${width}px`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      paintCanvas();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  horizontal?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const editor = document.querySelector(".editor");
    if (!editor) return;
    const move = (next) => {
      const rect = editor.getBoundingClientRect();
      const height = Math.min(Math.max(rect.bottom - next.clientY, 180), 420);
      state.timelineHeight = height;
      localStorage.setItem("dogsc-timeline-h", String(height));
      editor.style.setProperty("--timeline-h", `${height}px`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      drawTimeline();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

async function ensurePeaks() {
  if (!state.project) return;
  if (state.peaksProjectId === state.project.id && Array.isArray(state.peaks)) return;
  const payload = await api(`/api/projects/${state.project.id}/peaks`);
  state.peaks = payload.peaks || [];
  state.peaksProjectId = state.project.id;
}

async function ensureCameraPip() {
  const video = document.querySelector("#pip-video");
  const cam = state.project?.camera || {};
  if (!video) return;
  if (!cam.enabled) {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
      video.srcObject = null;
    }
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    if (!state.cameraStream) {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = state.cameraStream;
    video.play().catch(() => {});
  } catch (_) {
    /* Camera optional in headless / denied environments. */
  }
}

async function openExportSheet() {
  if (state.cropping) return;
  state.exportSheet = { state: "idle", progress: 0, estimate: null, error: null };
  render();
  await refreshExportEstimate();
}

async function refreshExportEstimate() {
  if (!state.project || !state.exportSheet) return;
  try {
    const estimate = await api(`/api/projects/${state.project.id}/export/estimate`);
    if (!state.exportSheet) return;
    state.exportSheet.estimate = estimate;
    const meta = document.querySelector(".export-meta");
    if (meta) {
      meta.innerHTML = `<div><span>${state.lang === "zh" ? "分辨率" : "Size"}</span><strong>${estimate.width}×${estimate.height}</strong></div>
        <div><span>${state.lang === "zh" ? "时长" : "Duration"}</span><strong>${formatTime(estimate.duration)}</strong></div>
        <div><span>${state.lang === "zh" ? "估大小" : "Est."}</span><strong>${formatBytes(estimate.bytes)}</strong></div>`;
    }
  } catch (error) {
    toast(error.message);
  }
}

async function startExportFromSheet() {
  if (!state.exportSheet || !state.project) return;
  state.exportSheet.state = "running";
  state.exportSheet.progress = 0.02;
  state.exportSheet.error = null;
  render();
  try {
    await api(`/api/projects/${state.project.id}/export`, { method: "POST", body: {} });
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const status = await api(`/api/projects/${state.project.id}/export/status`);
      if (!state.exportSheet) return;
      state.exportSheet.progress = Math.min(0.95, 0.05 + attempt / 120);
      const bar = document.querySelector(".export-progress i");
      if (bar) bar.style.width = `${Math.round(state.exportSheet.progress * 100)}%`;
      if (status.state === "done") {
        state.exportSheet.progress = 1;
        state.exportSheet.state = "done";
        toast(state.lang === "zh" ? "导出完成" : "Export ready");
        const link = document.createElement("a");
        link.href = `/api/projects/${state.project.id}/export/file`;
        link.download = `${state.project.name || "dogsc"}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        state.exportSheet = null;
        render();
        return;
      }
      if (status.state === "error") throw new Error(status.error || "导出失败");
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(state.lang === "zh" ? "导出时间太长，请稍后再看状态。" : "Export is still running.");
  } catch (error) {
    if (state.exportSheet) {
      state.exportSheet.state = "error";
      state.exportSheet.error = error.message;
      render();
    } else {
      toast(error.message);
    }
  }
}

function absoluteItem(item) {
  if (!item.clip_id) return item;
  const rows = Z.layout(state.project.clips);
  const row = rows.find((entry) => entry.id === item.clip_id);
  if (!row) return item;
  return { ...item, start: row.start + Number(item.start || 0), end: row.start + Number(item.end || 0) };
}

function drawTimeline() {
  const lanes = document.querySelector("#lanes");
  if (!lanes || !state.project) return;
  if (state.timelineMode === "waveform" && state.peaksProjectId !== state.project.id) {
    ensurePeaks().then(() => drawTimeline()).catch(() => {});
  }
  const duration = Math.max(Z.duration(state.project.clips), 0.1);
  const pxPerSecond = 120 * state.timelineZoom;
  const width = Math.max(lanes.clientWidth - 100, duration * pxPerSecond);
  const rows = Z.layout(state.project.clips);
  const makeLane = (label, items, paint) => {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    const tag = document.createElement("div");
    tag.className = "lane-label";
    tag.textContent = label;
    tag.style.position = "absolute";
    tag.style.left = "0";
    tag.style.top = "8px";
    tag.style.height = "46px";
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.width = `${width}px`;
    items.forEach((item) => paint(lane, item, duration));
    wrap.append(tag, lane);
    return { wrap, lane };
  };
  const ruler = document.createElement("div");
  ruler.className = "ruler";
  ruler.style.width = `${width}px`;
  const step = state.timelineZoom >= 3 ? 0.5 : state.timelineZoom >= 1.5 ? 1 : 2;
  for (let t = 0; t <= duration + 0.001; t += step) {
    const mark = document.createElement("span");
    mark.style.left = `${(t / duration) * 100}%`;
    mark.textContent = formatTime(t).slice(0, 5);
    ruler.append(mark);
  }
  const locatedClip = Z.locateTimeline(state.project.clips, state.time)?.clip;
  const clipLane = makeLane(state.timelineMode === "waveform" ? "波形" : "画面", rows, (lane, row) => {
    const node = document.createElement("div");
    const selected = locatedClip && locatedClip.id === row.id;
    node.className = `clip${selected ? " selected" : ""}`;
    node.dataset.clipId = row.id;
    node.style.left = `${(row.start / duration) * 100}%`;
    node.style.width = `${(row.duration / duration) * 100}%`;
    node.innerHTML = `<span class="handle left"></span><span class="handle right"></span>`;
    node.onpointerenter = () => node.classList.add("hovered");
    node.onpointerleave = () => node.classList.remove("hovered");
    if (state.timelineMode === "waveform") {
      node.style.background = "linear-gradient(180deg,#3a3d44,#2a2d33)";
      const canvas = document.createElement("canvas");
      canvas.className = "wave-canvas";
      canvas.width = 240;
      canvas.height = 34;
      node.append(canvas);
      const peaks = state.peaks || [];
      const ctx = canvas.getContext("2d");
      if (ctx && peaks.length) {
        const mediaDuration = Math.max(Number(state.project.media?.duration) || duration, 0.1);
        const srcIn = Number(row.clip.src_in || 0);
        const srcOut = Number(row.clip.src_out || srcIn + row.duration);
        const from = Math.floor((srcIn / mediaDuration) * peaks.length);
        const to = Math.max(Math.ceil((srcOut / mediaDuration) * peaks.length), from + 1);
        const slice = peaks.slice(from, to);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(133,209,66,0.82)";
        const mid = canvas.height / 2;
        const peakMax = Math.max(...slice, 0.08);
        slice.forEach((peak, index) => {
          const x = (index / Math.max(slice.length - 1, 1)) * canvas.width;
          const normalized = Math.min(peak / peakMax, 1);
          const h = Math.max(normalized * (canvas.height * 0.92), 1.8);
          ctx.fillRect(x, mid - h / 2, Math.max(canvas.width / slice.length - 0.5, 1.2), h);
        });
      }
    } else {
      const cells = Math.min(Math.max(Math.ceil((row.duration / duration) * width / 40), 4), 24);
      const srcIn = Number(row.clip.src_in || 0);
      const srcOut = Number(row.clip.src_out || srcIn + row.duration);
      for (let index = 0; index < cells; index += 1) {
        const image = document.createElement("img");
        const local = srcIn + ((index + 0.5) / cells) * (srcOut - srcIn);
        image.alt = "";
        image.loading = "lazy";
        image.classList.add("film-tile");
        image.onload = () => image.classList.add("revealed");
        image.onerror = () => {
          image.onload = () => image.classList.add("revealed");
          image.src = `/api/projects/${state.project.id}/thumbs/${Math.min(index, 7)}.jpg`;
          image.onerror = () => image.remove();
        };
        image.src = `/api/projects/${state.project.id}/thumb?t=${local.toFixed(3)}`;
        node.append(image);
      }
    }
    node.querySelector(".left").onpointerdown = (event) => dragEdge(event, row, "start", duration, width);
    node.querySelector(".right").onpointerdown = (event) => dragEdge(event, row, "end", duration, width);
    lane.append(node);
  });
  const zoomLane = makeLane("运镜", Z.absoluteZooms(state.project.clips, state.project.zooms), (lane, zoom) => {
    const node = document.createElement("div");
    node.className = `zoom${zoom.id === state.selectedZoom ? " selected" : ""}`;
    const end = Number(zoom.end) + Number(zoom.exit || 0);
    node.style.left = `${(zoom.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - zoom.start) / duration * 100, 1)}%`;
    node.textContent = `${state.lang === "zh" ? "缩放" : "Zoom"} ${Number(zoom.scale).toFixed(1)}x${zoom.auto || state.motionDrive === "auto" ? (state.lang === "zh" ? " · 自动" : " · Auto") : ""}`;
    node.onpointerenter = () => node.classList.add("hovered");
    node.onpointerleave = () => node.classList.remove("hovered");
    node.onclick = () => { state.selectedZoom = zoom.id; state.tab = "motion"; state.motionMode = "zoom"; render(); };
    lane.append(node);
  });
  const motions = (state.project.screen_motions || []).map(absoluteItem);
  const motionLane = makeLane("3D", motions, (lane, item) => {
    const node = document.createElement("div");
    node.className = `motion${item.id === state.selectedMotion ? " selected" : ""}`;
    const end = Number(item.end) + Number(item.exit || 0);
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - item.start) / duration * 100, 1)}%`;
    node.onpointerenter = () => node.classList.add("hovered");
    node.onpointerleave = () => node.classList.remove("hovered");
    node.onclick = () => { state.selectedMotion = item.id; state.tab = "motion"; state.motionMode = "tilt"; render(); };
    lane.append(node);
  });
  if (!motions.length) {
    const hint = document.createElement("div");
    hint.className = "lane-empty";
    hint.textContent = state.lang === "zh" ? "空 · 可在预览栏加入 3D" : "Empty · add 3D from preview";
    motionLane.lane.append(hint);
  }
  const mosaics = (state.project.mosaics || []).map(absoluteItem);
  const mosaicLane = makeLane("马赛克", mosaics, (lane, item) => {
    const node = document.createElement("div");
    node.className = `mosaic${item.id === state.selectedMosaic?.id ? " selected" : ""}`;
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((item.end - item.start) / duration * 100, 1)}%`;
    node.onpointerenter = () => node.classList.add("hovered");
    node.onpointerleave = () => node.classList.remove("hovered");
    node.onclick = () => { state.selectedMosaic = item; state.tab = "motion"; render(); };
    lane.append(node);
  });
  if (!mosaics.length) {
    const hint = document.createElement("div");
    hint.className = "lane-empty";
    hint.textContent = state.lang === "zh" ? "空" : "Empty";
    mosaicLane.lane.append(hint);
  }
  const stickers = (state.project.stickers || []).map(absoluteItem);
  const stickerLane = makeLane("贴图", stickers, (lane, item) => {
    const node = document.createElement("div");
    node.className = `sticker-clip${item.id === state.selectedSticker?.id ? " selected" : ""}`;
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((item.end - item.start) / duration * 100, 1)}%`;
    node.onpointerenter = () => node.classList.add("hovered");
    node.onpointerleave = () => node.classList.remove("hovered");
    node.onclick = () => { state.selectedSticker = item; state.selectedMosaic = null; state.tab = "motion"; render(); };
    lane.append(node);
  });
  if (!stickers.length) {
    const hint = document.createElement("div");
    hint.className = "lane-empty";
    hint.textContent = state.lang === "zh" ? "空" : "Empty";
    stickerLane.lane.append(hint);
  }
  const magneticTargets = () => {
    const points = [0, duration];
    for (const row of rows) points.push(row.start, row.start + row.duration);
    for (const zoom of Z.absoluteZooms(state.project.clips, state.project.zooms)) {
      points.push(Number(zoom.start), Number(zoom.end));
    }
    for (const item of motions) points.push(Number(item.start), Number(item.end));
    for (const item of mosaics) points.push(Number(item.start), Number(item.end));
    for (const item of stickers) points.push(Number(item.start), Number(item.end));
    for (const marker of state.project.markers || []) {
      const row = rows.find((item) => item.id === marker.clip_id);
      if (row) points.push(row.start + Number(marker.local || 0));
    }
    return points.filter((t) => t >= 0 && t <= duration);
  };
  const magneticTime = (time, laneWidth, event = null) => magneticResolve(time, {
    width: laneWidth,
    duration,
    targets: magneticTargets,
    initial: [],
    shift: Boolean(event?.shiftKey),
  });
  lanes.innerHTML = "";
  lanes.append(ruler);
  const visibleLanes = [clipLane];
  if (state.trackVisibility.zoom !== false) visibleLanes.push(zoomLane);
  if (state.trackVisibility.motion !== false) visibleLanes.push(motionLane);
  if (state.trackVisibility.mosaic !== false) visibleLanes.push(mosaicLane);
  if (state.trackVisibility.sticker !== false) visibleLanes.push(stickerLane);
  visibleLanes.forEach((entry) => lanes.append(entry.wrap));
  // Full-height playhead overlay across ruler + all lanes (Apple NativeTimelinePlayheadView)
  const head = document.createElement("div");
  head.className = "playhead playhead-span";
  head.dataset.laneWidth = String(width);
  head.style.left = `calc(76px + ${(state.time / duration) * width}px)`;
  lanes.append(head);
  if (state.altHeld) {
    const cut = document.createElement("div");
    cut.className = "cut-guide";
    cut.style.left = `calc(76px + ${(state.time / duration) * width}px)`;
    lanes.append(cut);
  }
  if (state.snapGuide != null) {
    const guide = document.createElement("div");
    guide.className = "snap-guide";
    guide.style.left = `calc(76px + ${(state.snapGuide / duration) * width}px)`;
    lanes.append(guide);
  }
  state.project.markers.forEach((marker) => {
    const row = rows.find((item) => item.id === marker.clip_id);
    if (!row) return;
    const tick = document.createElement("div");
    tick.className = `marker${state.selectedMarker === marker.id ? " selected" : ""}`;
    tick.style.left = `${((row.start + Number(marker.local)) / duration) * 100}%`;
    tick.title = marker.label || (state.lang === "zh" ? "标记" : "Marker");
    tick.onpointerdown = (event) => {
      event.stopPropagation();
      state.selectedMarker = marker.id;
      state.time = row.start + Number(marker.local || 0);
      state.playing = false;
      updatePlayButton();
      paintCanvas();
      drawTimeline();
    };
    tick.ondblclick = async (event) => {
      event.stopPropagation();
      const label = prompt(state.lang === "zh" ? "标记名称" : "Marker label", marker.label || "");
      if (label == null) return;
      try {
        state.project = await api(`/api/projects/${state.project.id}/marker-update`, {
          method: "POST",
          body: { id: marker.id, label },
        });
        render();
      } catch (error) { toast(error.message); }
    };
    clipLane.lane.append(tick);
  });
  const syncSnapGuide = () => {
    const guide = document.querySelector(".snap-guide");
    if (state.snapGuide != null) {
      if (guide) guide.style.left = `calc(76px + ${(state.snapGuide / duration) * width}px)`;
      else {
        const node = document.createElement("div");
        node.className = "snap-guide";
        node.style.left = `calc(76px + ${(state.snapGuide / duration) * width}px)`;
        lanes.append(node);
      }
    } else if (guide) {
      guide.remove();
    }
  };
  const seek = (event, lane, exact = false) => {
    const rect = lane.getBoundingClientRect();
    let time = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
    if (state.altHeld) {
      state.snapGuide = null;
      state.time = time;
    } else {
      time = magneticTime(time, rect.width, event);
      state.time = time;
    }
    state.playing = false;
    updatePlayButton();
    syncSnapGuide();
    const located = Z.locateTimeline(state.project.clips, state.time);
    if (located) DogSCPreview.seekCoalesced(located.source, exact, state.previewQuality);
    paintCanvas();
    syncTransport();
  };
  clipLane.lane.onpointerdown = (event) => {
    if (event.target.closest(".handle, .zoom, .motion, .mosaic, .sticker-clip, .lane-empty, .marker")) return;
    magneticSession.reset();
    if (state.altHeld) {
      const rect = clipLane.lane.getBoundingClientRect();
      const time = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
      mutate(`/api/projects/${state.project.id}/split`, { time });
      return;
    }
    head.classList.add("is-emphasized");
    seek(event, clipLane.lane, false);
    const move = (next) => seek(next, clipLane.lane, false);
    const up = () => {
      magneticSession.reset();
      state.snapGuide = null;
      document.querySelector(".snap-guide")?.remove();
      head.classList.remove("is-emphasized");
      DogSCPreview.settle(state.previewQuality);
      const located = Z.locateTimeline(state.project.clips, state.time);
      if (located) DogSCPreview.seekCoalesced(located.source, true, state.previewQuality);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  if (state.hoverPreview) {
    clipLane.lane.onpointermove = (event) => {
      if (event.buttons) return;
      const rect = clipLane.lane.getBoundingClientRect();
      const preview = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
      state.hoverTime = preview;
      placeHoverGuide(lanes, duration, width, preview);
      if (state.altHeld) {
        let cut = lanes.querySelector(".cut-guide");
        if (!cut) {
          cut = document.createElement("div");
          cut.className = "cut-guide";
          lanes.append(cut);
        }
        cut.style.left = `calc(76px + ${(preview / duration) * width}px)`;
      }
      const located = Z.locateTimeline(state.project.clips, preview);
      if (located) DogSCPreview.seekCoalesced(located.source, false, state.previewQuality);
    };
    clipLane.lane.onpointerleave = () => {
      state.hoverTime = null;
      lanes.querySelector(".hover-playhead")?.remove();
      if (!state.altHeld) lanes.querySelector(".cut-guide")?.remove();
      DogSCPreview.settle(state.previewQuality);
      const located = Z.locateTimeline(state.project.clips, state.time);
      if (located) DogSCPreview.seekCoalesced(located.source, true, state.previewQuality);
      paintCanvas();
    };
  }
}

function dragEdge(event, row, edge, duration, width) {
  event.preventDefault();
  event.stopPropagation();
  magneticSession.reset();
  const startX = event.clientX;
  const origin = edge === "start" ? row.start : row.end;
  const lanes = document.querySelector("#lanes");
  const magneticTargets = () => {
    const points = [0, duration];
    for (const clip of Z.layout(state.project.clips)) {
      if (clip.id === row.id) continue;
      points.push(clip.start, clip.start + clip.duration);
    }
    for (const zoom of Z.absoluteZooms(state.project.clips, state.project.zooms)) {
      points.push(Number(zoom.start), Number(zoom.end));
    }
    return points;
  };
  const snap = (time, pointerEvent) => {
    const next = magneticResolve(time, {
      width,
      duration,
      targets: magneticTargets,
      initial: [origin],
      shift: Boolean(pointerEvent?.shiftKey),
    });
    const guide = document.querySelector(".snap-guide");
    if (state.snapGuide != null && lanes) {
      if (guide) guide.style.left = `calc(76px + ${(state.snapGuide / duration) * width}px)`;
      else {
        const node = document.createElement("div");
        node.className = "snap-guide";
        node.style.left = `calc(76px + ${(state.snapGuide / duration) * width}px)`;
        lanes.append(node);
      }
    } else if (guide) guide.remove();
    return next;
  };
  const move = (next) => {
    const delta = (next.clientX - startX) / width * duration;
    const time = snap(Z.clamp(origin + delta, 0, duration), next);
    mutate(`/api/projects/${state.project.id}/trim`, { id: row.id, edge, time });
  };
  const up = () => {
    magneticSession.reset();
    state.snapGuide = null;
    document.querySelector(".snap-guide")?.remove();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function togglePlay() {
  state.playing = !state.playing;
  const video = document.querySelector("#video");
  if (!state.playing) {
    video?.pause();
    DogSCPreview.settle();
    updatePlayButton();
    syncTransport();
    return;
  }
  if (state.hudMenu) { state.hudMenu = null; document.querySelector("#shortcuts-panel")?.remove(); document.querySelectorAll(".hud-menu").forEach((node) => node.remove()); }
  updatePlayButton();
  const start = performance.now();
  const origin = state.time;
  const total = Math.max(Z.duration(state.project.clips), 0.001);
  const stop = DogSCPreview.run((now) => {
    if (!state.playing) { stop(); return; }
    state.time = Math.min(origin + (now - start) / 1000, total);
    if (state.time >= total) {
      state.time = total;
      state.playing = false;
      video?.pause();
      DogSCPreview.settle();
      stop();
      updatePlayButton();
      paintCanvas();
      return;
    }
    const locatedNow = Z.locateTimeline(state.project.clips, state.time);
    if (locatedNow) DogSCPreview.seekCoalesced(locatedNow.source, false);
    if (video && video.paused) video.play().catch(() => {});
    paintCanvas();
  });
}

async function exportProject() {
  return openExportSheet();
}

function aspectRatio(aspect, width, height) {
  const table = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "9:16": 9 / 16, "3:4": 3 / 4, "2.39:1": 2.39, "1:2.39": 1 / 2.39, source: width / height };
  return table[aspect] || width / height;
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Alt") {
    if (!state.altHeld) {
      state.altHeld = true;
      document.body.classList.add("alt-cut");
      if (state.view === "editor") drawTimeline();
    }
    return;
  }
  if (event.target.matches("input, select, textarea")) return;
  if (event.key === "Escape") {
    if (closeFloatingUI()) {
      event.preventDefault();
      render();
    }
    return;
  }
  if (event.code === "Space" && state.view === "editor") { event.preventDefault(); togglePlay(); }
  if (event.key === "s" && state.view === "editor" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && state.view === "editor") {
    event.preventDefault();
    mutate(`/api/projects/${state.project.id}/${event.shiftKey ? "redo" : "undo"}`, {});
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e" && state.view === "editor") {
    event.preventDefault();
    if (!state.cropping) openExportSheet();
  }
  if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && state.view === "editor") {
    event.preventDefault();
    state.playing = false;
    updatePlayButton();
    const step = event.shiftKey ? 1 : (event.altKey ? 1 / 30 : 0.1);
    state.time = event.key === "ArrowRight"
      ? Math.min(state.time + step, Z.duration(state.project.clips))
      : Math.max(state.time - step, 0);
    paintCanvas();
    syncTransport();
  }
  if ((event.key === "," || event.key === ".") && state.view === "editor") {
    event.preventDefault();
    state.playing = false;
    updatePlayButton();
    const frame = 1 / 30;
    state.time = event.key === "."
      ? Math.min(state.time + frame, Z.duration(state.project.clips))
      : Math.max(state.time - frame, 0);
    paintCanvas();
    syncTransport();
  }
  if ((event.key === "[" || event.key === "]") && state.view === "editor" && !event.metaKey && !event.ctrlKey) {
    const clip = Z.locateTimeline(state.project.clips, state.time)?.clip;
    if (clip) {
      event.preventDefault();
      mutate(`/api/projects/${state.project.id}/move`, {
        id: clip.id,
        direction: event.key === "]" ? 1 : -1,
      });
    }
  }
  if ((event.key === "Delete" || event.key === "Backspace") && state.view === "editor" && state.selectedMarker) {
    event.preventDefault();
    api(`/api/projects/${state.project.id}/marker-delete`, { method: "POST", body: { id: state.selectedMarker } })
      .then((project) => { state.project = project; state.selectedMarker = null; render(); })
      .catch((error) => toast(error.message));
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Alt" && state.altHeld) {
    state.altHeld = false;
    document.body.classList.remove("alt-cut");
    if (state.view === "editor") drawTimeline();
  }
});
window.addEventListener("blur", () => {
  if (!state.altHeld) return;
  state.altHeld = false;
  document.body.classList.remove("alt-cut");
  if (state.view === "editor") drawTimeline();
});

async function boot() {
  try {
    state.env = await api("/api/environment");
    state.projects = await api("/api/projects");
    await loadSources();
    ensureWallpapers();
  } catch (error) {
    toast(error.message);
  }
  render();
}

boot();
