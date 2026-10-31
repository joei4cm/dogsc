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
  timelineMode: "picture",
  magnetic: true,
  hoverPreview: true,
  timelineZoom: 1,
  dirty: false,
};

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
    lead: "DogSC 的 Linux 版，面向 Ubuntu 与 Omarchy。录显示器、窗口或区域，再在时间线上分割、裁剪，并用运镜、样机框和背景完成成片。",
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
    autoMotion: "自动运镜",
    manualMotion: "手动操控",
    pan2d: "平移 2D",
    applyAll: "应用到全部画面",
  },
  en: {
    lang: "中文",
    title: "Record clearly. Cut lightly.",
    lead: "DogSC for Ubuntu and Omarchy. Capture a display, window, or region, then edit with zooms, frames, and backgrounds.",
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
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove("show"), 2800);
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

function render() {
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
    });
  }
  const pill = document.querySelector("#platform-pill");
  if (pill && state.env) pill.textContent = `${state.env.os_name?.split(" ")[0] || "Linux"} · ${state.env.backend_label || state.env.backend}`;
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
      <div class="recorder-capsule">
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
    <div class="recorder-capsule" id="recorder-capsule">
      <button class="mode-wheel" id="mode-wheel" title="${sourceLabel(source)}">
        ${ICONS[source] || ICONS.display}<span>${sourceLabel(source)}</span><span class="chev">⇅</span>
      </button>
      <button class="rec-toggle ${state.record.mic ? "on" : ""}" data-pop="mic" title="${t("mic")}">${state.record.mic ? ICONS.mic : ICONS.micOff}</button>
      <button class="rec-toggle ${state.record.camera ? "on" : ""}" data-pop="camera" title="${t("camera")}">${state.record.camera ? ICONS.cam : ICONS.camOff}</button>
      <button class="rec-toggle ${state.record.system ? "on" : ""}" data-pop="system" title="${t("system")}">${state.record.system ? ICONS.speaker : ICONS.speakerOff}</button>
      <button class="rec-toggle" data-pop="more" title="${t("settings")}">${ICONS.more}</button>
      <button class="record-go" id="start-record" title="${t("start")}"><span class="dot"><i></i></span></button>
    </div>
  </div>`;
}

function homeHtml() {
  const cards = state.projects.map((project) => `
    <div class="project">
      <div class="project-row">
        <button data-open="${project.id}">
          <strong>${escapeHtml(project.name || "未命名")}</strong>
          <span>${formatTime(project.duration || 0)} · ${project.width || "?"}×${project.height || "?"}</span>
        </button>
        <button class="btn icon danger" data-delete="${project.id}" title="${t("delete")}">${ICONS.trash}</button>
      </div>
    </div>`).join("");
  return `<div class="home-shell">
    <header class="topbar">
      <div class="brand"><span class="logo"></span><div><strong>DogSC</strong><em id="platform-pill">Linux</em></div></div>
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
          <button class="btn" id="go-demo">${t("demo")}</button>
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
    <button class="active">${state.lang === "zh" ? "完整画质" : "Full quality"}</button>
    <button>${state.lang === "zh" ? "流畅预览" : "Fast preview"}</button>
  </div>` : "";
  return `<div class="stage-hud" id="stage-hud">
    <div style="position:relative">
      <button class="hud-btn" id="aspect-btn">${project.canvas.aspect || "16:9"}</button>
      ${aspectMenu}
    </div>
    <button class="hud-btn ${state.cropping ? "active" : ""}" id="crop-btn" title="裁切">${ICONS.crop}</button>
    <div style="position:relative">
      <button class="hud-btn" id="add-btn" title="${t("addToCanvas")}">${ICONS.plus}</button>
      ${addMenu}
    </div>
    <div style="position:relative">
      <button class="hud-btn" id="preview-btn" title="${t("previewOpts")}">${ICONS.sliders}</button>
      ${previewMenu}
    </div>
    <div class="hud-divider"></div>
    <button class="hud-btn" id="step-back" title="上一帧">${ICONS.prev}</button>
    <button class="play-btn ${state.playing ? "playing" : ""}" id="play" title="${state.playing ? t("pause") : t("playing")}">${state.playing ? ICONS.pause : ICONS.play}</button>
    <button class="hud-btn" id="step-forward" title="下一帧">${ICONS.next}</button>
    <span class="hud-time" id="clock">${formatTime(state.time)} <em>/ ${formatTime(Z.duration(project.clips))}</em></span>
  </div>`;
}

function timelineBarHtml() {
  return `<div class="timeline-bar">
    <button class="tl-tool" id="split" title="${t("split")}">${ICONS.scissors}</button>
    <button class="tl-tool" id="delete-selection" title="${t("delete")}">${ICONS.trash}</button>
    <button class="tl-tool" id="restore-cuts" title="${t("restoreCuts")}">${ICONS.restore}</button>
    <button class="tl-tool" id="add-edit-marker" title="${t("marker")}">${ICONS.marker}</button>
    <div class="tl-group" style="margin-left:8px">
      <button id="mode-picture" class="${state.timelineMode === "picture" ? "active" : ""}">${ICONS.film}${t("picture")}</button>
      <button id="mode-wave" class="${state.timelineMode === "waveform" ? "active" : ""}">${ICONS.wave}${t("waveform")}</button>
    </div>
    <div class="spacer"></div>
    <button class="tl-tool ${state.magnetic ? "active" : ""}" id="magnetic" title="${t("magnetic")}">${ICONS.magnet}</button>
    <button class="tl-tool ${state.hoverPreview ? "active" : ""}" id="hover-preview" title="${t("hoverPrev")}">${ICONS.eye}</button>
    <button class="tl-tool" id="fit-all" title="${t("fitAll")}">${ICONS.fit}</button>
    <div class="tl-zoom">
      <input id="timeline-zoom" type="range" min="1" max="6" step="0.1" value="${state.timelineZoom}">
    </div>
  </div>`;
}

function editorHtml() {
  const project = state.project;
  return `<div class="shell editor-shell">
    <header class="topbar editor-topbar">
      <div class="top-leading">
        <button class="btn icon project-menu" id="back" title="${t("back")}">${ICONS.folder}${ICONS.chevronDown}</button>
        <input class="title" id="project-name" value="${escapeHtml(project.name)}">
        <span class="saved">${ICONS.check}<span>${t("saved")}</span></span>
        <span class="toolbar-divider"></span>
        <button class="btn icon" id="undo" title="${t("undo")}">${ICONS.undo}</button>
        <button class="btn icon" id="redo" title="${t("redo")}">${ICONS.redo}</button>
      </div>
      <div class="top-trailing">
        <button class="btn icon" id="lang" title="${t("lang")}">${t("lang") === "English" ? "EN" : "中"}</button>
        <button class="btn icon" id="settings-btn" title="${t("settings")}">${ICONS.gear}</button>
        <button class="btn icon danger" id="delete-project" title="${t("delete")}">${ICONS.trash}</button>
        <span class="toolbar-divider"></span>
        <button class="btn primary export-btn" id="export">${ICONS.share}<span>${t("export")}</span></button>
      </div>
    </header>
    <section class="editor">
      <div class="workspace">
        <div class="stage">
          <div class="stage-dots"></div>
          <div class="canvas-frame" id="canvas"></div>
          ${stageHudHtml(project)}
        </div>
        <aside class="inspector">
          <div class="inspector-rail">${inspectorTabsHtml()}</div>
          <div class="inspector-body">${inspectorBody()}</div>
        </aside>
      </div>
      <div class="timeline">
        ${timelineBarHtml()}
        <div class="lanes" id="lanes"></div>
      </div>
    </section>
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
  return `
    <div class="section-title">${state.lang === "zh" ? "背景素材" : "Background"}</div>
    <div class="segmented" style="margin-bottom:12px">
      ${["wallpaper","pattern","dynamic","custom"].map((id) => `<button data-bg-tab="${id}" class="${state.bgTab === id ? "active" : ""}">${t(id)}</button>`).join("")}
    </div>
    ${state.bgTab === "wallpaper" || state.bgTab === "custom" ? `
      <div class="preset-grid wallpaper-grid">
        ${solids.map(([color, label]) => `<button class="tile ${canvas.background === color && !canvas.pattern && !canvas.dynamic ? "active" : ""}" data-color="${color}" style="background:${color}"><span>${state.lang === "zh" ? label : color}</span></button>`).join("")}
      </div>
      <label class="field">${fieldValue(t("background"), "")}<input id="background" type="color" value="${canvas.background || "#16161a"}"></label>` : ""}
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

function mockupPanel(canvas) {
  return `
    <div class="section mockup-list">
      ${Object.keys(FRAME_LABELS.zh).map((id) => `<button class="choice-card ${canvas.screen_frame === id ? "active" : ""}" data-frame="${id}"><strong>${FRAME_LABELS[state.lang][id]}</strong></button>`).join("")}
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
    if (!confirm(state.lang === "zh" ? "删除这个项目？" : "Delete this project?")) return;
    await api(`/api/projects/${node.dataset.delete}`, { method: "DELETE" });
    state.projects = await api("/api/projects");
    render();
  });
  document.querySelectorAll("#go-demo").forEach((node) => node.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    toast(state.lang === "zh" ? "正在生成示例…" : "Creating the example…");
    try { await openProject((await api("/api/demo", { method: "POST" })).id); }
    catch (error) { toast(error.message); }
    finally { event.currentTarget.disabled = false; }
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
  document.querySelector("#start-record")?.addEventListener("click", startRecording);
  document.querySelector("#stop-record")?.addEventListener("click", stopRecording);
  document.querySelector("#add-marker")?.addEventListener("click", () => api("/api/record/marker", { method: "POST", body: {} }).catch((error) => toast(error.message)));
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
    loadSources().then(render);
  };
  document.querySelector("#delete-project")?.addEventListener("click", async () => {
    if (!confirm(state.lang === "zh" ? "删除当前项目？" : "Delete this project?")) return;
    await api(`/api/projects/${state.project.id}`, { method: "DELETE" });
    state.project = null;
    state.view = "home";
    state.projects = await api("/api/projects");
    render();
  });
  document.querySelector("#settings-btn")?.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("dogsc-lang", state.lang);
    render();
  });
  document.querySelector("#undo").onclick = () => mutate(`/api/projects/${state.project.id}/undo`, {});
  document.querySelector("#redo").onclick = () => mutate(`/api/projects/${state.project.id}/redo`, {});
  document.querySelector("#export").onclick = exportProject;
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
  document.querySelector("#step-back").onclick = () => { state.time = Math.max(state.time - 0.1, 0); paintCanvas(); };
  document.querySelector("#step-forward").onclick = () => { state.time = Math.min(state.time + 0.1, Z.duration(state.project.clips)); paintCanvas(); };
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
  document.querySelector("#restore-cuts")?.addEventListener("click", () => toast(state.lang === "zh" ? "暂无已删除剪辑可恢复" : "No deleted cuts to restore"));
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
  document.querySelector("#crop-btn")?.addEventListener("click", () => { state.cropping = !state.cropping; state.hudMenu = null; render(); });
  document.querySelectorAll("[data-aspect]").forEach((node) => node.onclick = () => {
    state.hudMenu = null;
    meta({ canvas: { ...state.project.canvas, aspect: node.dataset.aspect } });
  });
  document.querySelector("#mode-picture")?.addEventListener("click", () => { state.timelineMode = "picture"; render(); });
  document.querySelector("#mode-wave")?.addEventListener("click", () => { state.timelineMode = "waveform"; render(); });
  document.querySelector("#magnetic")?.addEventListener("click", () => { state.magnetic = !state.magnetic; render(); });
  document.querySelector("#hover-preview")?.addEventListener("click", () => { state.hoverPreview = !state.hoverPreview; render(); });
  document.querySelector("#fit-all")?.addEventListener("click", () => { state.timelineZoom = 1; render(); });
  document.querySelector("#timeline-zoom")?.addEventListener("input", (event) => {
    state.timelineZoom = Number(event.target.value);
    drawTimeline();
  });
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
  document.querySelectorAll("[data-color]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "solid", background: node.dataset.color } }));
  document.querySelectorAll("[data-pattern]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "pattern", pattern: node.dataset.pattern } }));
  document.querySelectorAll("[data-dynamic]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background_kind: "dynamic", dynamic: node.dataset.dynamic } }));
  document.querySelectorAll("[data-frame]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, screen_frame: node.dataset.frame } }));
  document.querySelectorAll("[data-opening]").forEach((node) => node.onclick = () => meta({ opening: { ...state.project.opening, preset: node.dataset.opening, enabled: true } }));
  document.querySelectorAll("[data-cursor]").forEach((node) => node.onclick = () => meta({ cursor: { ...state.project.cursor, asset: node.dataset.cursor } }));
  document.querySelectorAll("[data-motion-mode]").forEach((node) => node.onclick = () => { state.motionMode = node.dataset.motionMode; render(); });
  document.querySelectorAll("[data-motion-drive]").forEach((node) => node.onclick = () => { state.motionDrive = node.dataset.motionDrive; render(); });
  document.querySelector("#focus-map")?.addEventListener("click", (event) => {
    if (!state.selectedZoom) return;
    const rect = event.currentTarget.getBoundingClientRect();
    updateZoom({
      focus_x: Z.clamp((event.clientX - rect.left) / rect.width, 0, 1),
      focus_y: Z.clamp((event.clientY - rect.top) / rect.height, 0, 1),
    });
  });
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
  state.tab = "frame";
  render();
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
  frame.innerHTML = `<div class="content-box" id="content"><div class="content-shell" id="shell"><div class="chrome" id="chrome"></div><div class="camera" id="camera"><video id="video" src="/api/projects/${project.id}/media" playsinline></video><div class="cursor" id="cursor" hidden></div><div class="focus-dot" id="focus" hidden></div></div><div class="pip" id="pip" hidden>CAM</div></div></div>`;
  const video = document.querySelector("#video");
  DogSCPreview.attach(video);
  video.onloadedmetadata = paintCanvas;
  document.querySelector("#content").onclick = (event) => {
    if (!state.selectedZoom) return;
    const rect = document.querySelector("#camera").getBoundingClientRect();
    const view = Z.sampleViewport(project.clips, project.zooms, state.time);
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    const focusX = view.left + u * view.size;
    const focusY = view.top + v * view.size;
    updateZoom({ focus_x: Z.clamp(focusX, 0, 1), focus_y: Z.clamp(focusY, 0, 1) });
  };
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
  if (!content || !camera || !video || !frame) return;
  const ratio = aspectRatio(canvas.aspect, project.media.width, project.media.height);
  frame.style.aspectRatio = `${ratio}`;
  content.style.background = backgroundCss(canvas);
  const padding = Number(canvas.padding || 0);
  const scale = Number(canvas.content_scale || 1);
  const width = (1 - padding * 2) * scale * 100;
  camera.style.width = `${width}%`;
  camera.style.aspectRatio = `${project.media.width} / ${project.media.height}`;
  camera.style.borderRadius = `${canvas.radius || 0}px`;
  camera.style.boxShadow = canvas.shadow > 0 ? `0 18px 50px rgba(0,0,0,${0.2 + canvas.shadow * 0.45})` : "none";
  camera.style.outline = canvas.border > 0 ? `${canvas.border}px solid ${canvas.border_color || "#fff"}` : "none";
  const ox = (Number(canvas.content_x ?? 0.5) - 0.5) * padding * 200;
  const oy = (Number(canvas.content_y ?? 0.5) - 0.5) * padding * 200;
  shell.style.transform = `translate(${ox}%, ${oy}%)`;
  applyChrome(chrome, canvas);
  const view = Z.sampleViewport(project.clips, project.zooms, state.time);
  video.style.transform = `translate(${-view.left / view.size * 100}%, ${-view.top / view.size * 100}%) scale(${1 / view.size})`;
  const motion = (project.screen_motions || []).map((item) => absoluteItem(item)).find((item) => state.time >= item.start && state.time <= item.end + Number(item.exit || 0));
  if (motion) {
    camera.style.transform = `perspective(${800 + Number(motion.perspective || 0.65) * 400}px) rotateX(${motion.rotation_x || 0}deg) rotateY(${motion.rotation_y || 0}deg) rotateZ(${motion.rotation_z || 0}deg) scale(${motion.scale || 1})`;
  } else {
    camera.style.transform = "";
  }
  const opening = project.opening || {};
  if (opening.enabled && state.time < Number(opening.duration || 1.4)) {
    const p = state.time / Number(opening.duration || 1.4);
    const startScale = opening.preset === "sideSlide" ? 0.85 : opening.preset === "light3D" ? 0.92 : 0.72;
    shell.style.transform += ` scale(${startScale + (1 - startScale) * p})`;
    if (opening.preset === "light3D") shell.style.transform += ` rotateY(${(-18 + 18 * p)}deg)`;
  }
  placeCursor(Z.locateTimeline(project.clips, state.time), view);
  const cam = project.camera || {};
  if (pip) {
    pip.hidden = !cam.enabled;
    if (cam.enabled) {
      const size = Number(cam.size || 0.22) * 100;
      pip.style.width = `${size}%`;
      pip.style.aspectRatio = cam.shape === "circle" || cam.shape === "square" ? "1" : cam.shape === "vertical" ? "9/16" : "16/9";
      pip.style.left = `${Number(cam.x || 0.82) * 100 - size / 2}%`;
      pip.style.top = `${Number(cam.y || 0.78) * 100 - size / 2}%`;
      pip.style.borderRadius = cam.shape === "circle" ? "999px" : `${(cam.roundness || 0.2) * 28}px`;
      pip.style.transform = cam.mirror ? "scaleX(-1)" : "";
    }
  }
  const located = Z.locateTimeline(project.clips, state.time);
  if (located && !state.playing) DogSCPreview.seekCoalesced(located.source, false);
  const clock = document.querySelector("#clock");
  if (clock) clock.innerHTML = `${formatTime(state.time)} <em>/ ${formatTime(Z.duration(project.clips))}</em>`;
}

function backgroundCss(canvas) {
  if (canvas.background_kind === "pattern") return patternPreview(canvas.pattern || "obsidianGrid");
  if (canvas.background_kind === "dynamic") return dynamicPreview(canvas.dynamic || "auroraFluid");
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
  if (!cursor || !located || state.project.capture?.cursor_baked || asset === "system.hidden") {
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
  const clipLane = makeLane(state.timelineMode === "waveform" ? "波形" : "画面", rows, (lane, row) => {
    const node = document.createElement("div");
    node.className = "clip";
    node.style.left = `${(row.start / duration) * 100}%`;
    node.style.width = `${(row.duration / duration) * 100}%`;
    node.innerHTML = `<span class="handle left"></span><span class="handle right"></span>`;
    if (state.timelineMode === "waveform") {
      node.style.background = "linear-gradient(180deg,#3a3d44,#2a2d33)";
      const wave = document.createElement("div");
      wave.style.cssText = "position:absolute;inset:8px 6px;opacity:0.75;background:repeating-linear-gradient(90deg,transparent 0 3px,rgba(133,209,66,0.55) 3px 4px)";
      node.append(wave);
    } else {
      for (let index = 0; index < 8; index += 1) {
        const image = document.createElement("img");
        image.src = `/api/projects/${state.project.id}/thumbs/${index}.jpg`;
        image.alt = "";
        image.onerror = () => image.remove();
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
    node.onclick = () => { state.selectedZoom = zoom.id; state.tab = "motion"; state.motionMode = "zoom"; render(); };
    lane.append(node);
  });
  const motionLane = makeLane("3D", (state.project.screen_motions || []).map(absoluteItem), (lane, item) => {
    const node = document.createElement("div");
    node.className = `motion${item.id === state.selectedMotion ? " selected" : ""}`;
    const end = Number(item.end) + Number(item.exit || 0);
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - item.start) / duration * 100, 1)}%`;
    node.onclick = () => { state.selectedMotion = item.id; state.tab = "motion"; state.motionMode = "tilt"; render(); };
    lane.append(node);
  });
  const mosaicLane = makeLane("马赛克", (state.project.mosaics || []).map(absoluteItem), (lane, item) => {
    const node = document.createElement("div");
    node.className = `mosaic${item.id === state.selectedMosaic?.id ? " selected" : ""}`;
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((item.end - item.start) / duration * 100, 1)}%`;
    node.onclick = () => { state.selectedMosaic = item; state.tab = "motion"; render(); };
    lane.append(node);
  });
  const stickerLane = makeLane("贴图", (state.project.stickers || []).map(absoluteItem), (lane, item) => {
    const node = document.createElement("div");
    node.className = "sticker-clip";
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((item.end - item.start) / duration * 100, 1)}%`;
    lane.append(node);
  });
  const head = document.createElement("div");
  head.className = "playhead";
  head.style.left = `${(state.time / duration) * 100}%`;
  clipLane.lane.append(head);
  state.project.markers.forEach((marker) => {
    const row = rows.find((item) => item.id === marker.clip_id);
    if (!row) return;
    const tick = document.createElement("div");
    tick.className = "marker";
    tick.style.left = `${((row.start + Number(marker.local)) / duration) * 100}%`;
    clipLane.lane.append(tick);
  });
  lanes.innerHTML = "";
  lanes.append(ruler);
  [clipLane, zoomLane, motionLane, mosaicLane, stickerLane].forEach((entry) => lanes.append(entry.wrap));
  const seek = (event, lane, exact = false) => {
    const rect = lane.getBoundingClientRect();
    let time = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
    if (state.magnetic) time = Math.round(time * 10) / 10;
    state.time = time;
    state.playing = false;
    const located = Z.locateTimeline(state.project.clips, state.time);
    if (located) DogSCPreview.seekCoalesced(located.source, exact);
    paintCanvas();
    head.style.left = `${(state.time / duration) * 100}%`;
  };
  clipLane.lane.onpointerdown = (event) => {
    if (event.target.closest(".handle, .zoom, .motion, .mosaic, .sticker-clip")) return;
    seek(event, clipLane.lane, false);
    const move = (next) => seek(next, clipLane.lane, false);
    const up = () => {
      DogSCPreview.settle();
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
      const located = Z.locateTimeline(state.project.clips, preview);
      if (located) DogSCPreview.seekCoalesced(located.source, false);
    };
    clipLane.lane.onpointerleave = () => {
      DogSCPreview.settle();
      paintCanvas();
    };
  }
}

function dragEdge(event, row, edge, duration, width) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const origin = edge === "start" ? row.start : row.end;
  const move = (next) => {
    const delta = (next.clientX - startX) / width * duration;
    const time = Z.clamp(origin + delta, 0, duration);
    mutate(`/api/projects/${state.project.id}/trim`, { id: row.id, edge, time });
  };
  const up = () => {
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
    render();
    return;
  }
  render();
  const start = performance.now();
  const origin = state.time;
  const total = Z.duration(state.project.clips);
  const stop = DogSCPreview.run((now) => {
    if (!state.playing) { stop(); return; }
    state.time = Math.min(origin + (now - start) / 1000, total);
    if (state.time >= total) {
      state.time = total;
      state.playing = false;
      video?.pause();
      DogSCPreview.settle();
      stop();
      render();
      return;
    }
    const locatedNow = Z.locateTimeline(state.project.clips, state.time);
    if (locatedNow) DogSCPreview.seekCoalesced(locatedNow.source, false);
    if (video && video.paused) video.play().catch(() => {});
    paintCanvas();
    const head = document.querySelector(".playhead");
    if (head) head.style.left = `${(state.time / total) * 100}%`;
  });
}

async function exportProject() {
  const button = document.querySelector("#export");
  button.disabled = true;
  try {
    await api(`/api/projects/${state.project.id}/export`, { method: "POST", body: {} });
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const status = await api(`/api/projects/${state.project.id}/export/status`);
      if (status.state === "done") {
        toast(state.lang === "zh" ? "导出完成" : "Export ready");
        const link = document.createElement("a");
        link.href = `/api/projects/${state.project.id}/export/file`;
        link.download = `${state.project.name || "dogsc"}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      if (status.state === "error") throw new Error(status.error || "导出失败");
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(state.lang === "zh" ? "导出时间太长，请稍后再看状态。" : "Export is still running.");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

function aspectRatio(aspect, width, height) {
  const table = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "9:16": 9 / 16, "3:4": 3 / 4, "2.39:1": 2.39, "1:2.39": 1 / 2.39, source: width / height };
  return table[aspect] || width / height;
}

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return;
  if (event.code === "Space" && state.view === "editor") { event.preventDefault(); togglePlay(); }
  if (event.key === "s" && state.view === "editor") mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
  if ((event.metaKey || event.ctrlKey) && event.key === "z" && state.view === "editor") {
    event.preventDefault();
    mutate(`/api/projects/${state.project.id}/${event.shiftKey ? "redo" : "undo"}`, {});
  }
  if (event.key === "ArrowRight" && state.view === "editor") { state.time = Math.min(state.time + 0.1, Z.duration(state.project.clips)); paintCanvas(); }
  if (event.key === "ArrowLeft" && state.view === "editor") { state.time = Math.max(state.time - 0.1, 0); paintCanvas(); }
});

async function boot() {
  try {
    state.env = await api("/api/environment");
    state.projects = await api("/api/projects");
    await loadSources();
  } catch (error) {
    toast(error.message);
  }
  render();
}

boot();
