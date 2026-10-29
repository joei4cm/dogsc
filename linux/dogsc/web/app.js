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
  record: { source: "display", display: 0, window: null, geometry: null, fps: 30, mic: false, system: false },
  sources: { displays: [], windows: [] },
  recording: { active: false, elapsed: 0 },
  dirty: false,
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
    note: "iPhone 有线采集仍依赖 macOS Continuity。摄像头画中画可在导入摄像头素材后使用；本机 v4l2 设备会出现在录制页。",
    noDisplay: "没有列出显示器。",
    noWindow: "没有列出窗口。",
    delete: "删除",
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
    note: "Cable iPhone capture still needs macOS Continuity. Camera PiP works after importing camera media; local v4l2 devices appear on the record page.",
    noDisplay: "No displays listed.",
    noWindow: "No windows listed.",
    delete: "Delete",
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
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
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
  if (state.view === "home") app.innerHTML = homeHtml();
  else if (state.view === "record") app.innerHTML = recordHtml();
  else app.innerHTML = editorHtml();
  bind();
  if (state.view === "editor") {
    mountPreview();
    drawTimeline();
    paintCanvas();
  }
  const pill = document.querySelector("#platform-pill");
  if (pill && state.env) pill.textContent = `${state.env.os_name?.split(" ")[0] || "Linux"} · ${state.env.backend_label || state.env.backend}`;
}

function shell(center, body) {
  return `<div class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark"></span><div><strong>DogSC</strong><em id="platform-pill">Linux</em></div></div>
      <div class="top-center">${center}</div>
      <div class="top-actions">
        <button class="btn ghost" id="lang">${t("lang")}</button>
      </div>
    </header>
    ${body}
  </div>`;
}

function homeHtml() {
  const hints = (state.env?.hints || []).map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  const cards = state.projects.map((project) => `
    <div class="project">
      <div class="project-row">
        <button data-open="${project.id}" style="text-align:left;flex:1">
          <strong>${escapeHtml(project.name || "未命名")}</strong>
          <span>${formatTime(project.duration || 0)} · ${project.width || "?"}×${project.height || "?"}</span>
        </button>
        <button class="btn ghost" data-delete="${project.id}">${t("delete")}</button>
      </div>
    </div>`).join("");
  return shell("", `<main class="home">
    <section class="hero">
      <div class="card">
        <h1>${t("title")}</h1>
        <p>${t("lead")}</p>
        <div class="actions">
          <button class="btn primary" id="go-record">${t("record")}</button>
          <button class="btn" id="go-demo">${t("demo")}</button>
          <label class="btn" style="display:inline-flex;align-items:center">${t("import")}<input id="file" type="file" accept="video/*" hidden></label>
          <button class="btn ghost" id="go-path">${t("path")}</button>
        </div>
      </div>
      <div class="card">
        <strong>${state.env ? escapeHtml(state.env.os_name) : ""}</strong>
        <ul class="hints">${hints}</ul>
        <p class="note">${t("note")}</p>
      </div>
    </section>
    <h2>${t("projects")}</h2>
    ${cards ? `<div class="projects">${cards}</div>` : `<p class="empty">${t("empty")}</p>`}
  </main>`);
}

function recordHtml() {
  if (state.recording.active) {
    return shell("", `<main class="record"><div class="card">
      <div class="timer" id="elapsed">${formatTime(state.recording.elapsed)}</div>
      <div class="actions">
        <button class="btn" id="add-marker">${t("marker")}</button>
        <button class="btn primary" id="stop-record" style="background:var(--red)">${t("stop")}</button>
      </div>
    </div></main>`);
  }
  const source = state.record.source;
  const displays = (state.sources.displays || []).map((display, index) => `
    <button class="choice ${index === state.record.display ? "active" : ""}" data-display="${index}">
      ${escapeHtml(display.name || display.id || `Display ${index + 1}`)} · ${display.width || "?"}×${display.height || "?"}
    </button>`).join("") || `<p class="note">${t("noDisplay")}</p>`;
  const windows = (state.sources.windows || []).map((window) => `
    <button class="choice ${window.id === state.record.window ? "active" : ""}" data-window="${escapeHtml(window.id)}">
      ${escapeHtml(window.title)}
    </button>`).join("") || `<p class="note">${t("noWindow")}</p>`;
  const list = source === "display" ? displays : source === "window" ? windows : `
    <p class="note">${state.record.geometry ? `${state.record.geometry.width}×${state.record.geometry.height}` : ""}</p>
    <button class="btn" id="pick-region">${t("pick")}</button>`;
  return shell("", `<main class="record"><div class="card">
    <div class="segmented">
      ${["display", "window", "region"].map((kind) => `<button data-source="${kind}" class="${source === kind ? "active" : ""}">${t(kind)}</button>`).join("")}
    </div>
    <div class="choices">${list}</div>
    <div class="row">
      <label><input type="checkbox" id="mic" ${state.record.mic ? "checked" : ""} ${state.env?.microphone ? "" : "disabled"}> ${t("mic")}</label>
      <label><input type="checkbox" id="system" ${state.record.system ? "checked" : ""} ${state.env?.system_audio ? "" : "disabled"}> ${t("system")}</label>
      <label>${t("fps")}
        <select id="fps"><option ${state.record.fps === 30 ? "selected" : ""}>30</option><option ${state.record.fps === 60 ? "selected" : ""}>60</option></select>
      </label>
    </div>
    <div class="actions"><button class="btn primary" id="start-record">${t("start")}</button><button class="btn ghost" id="cancel-record">${t("back")}</button></div>
  </div></main>`);
}

function editorHtml() {
  const project = state.project;
  const center = `
    <button class="btn ghost" id="back">${t("back")}</button>
    <input class="title" id="project-name" value="${escapeHtml(project.name)}">
    <span class="saved">${t("saved")}</span>
    <button class="btn icon" id="undo" title="${t("undo")}">↶</button>
    <button class="btn icon" id="redo" title="${t("redo")}">↷</button>`;
  const actions = `
    <button class="btn ghost" id="lang">${t("lang")}</button>
    <button class="btn primary" id="export">${t("export")}</button>`;
  return `<div class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark"></span><div><strong>DogSC</strong><em id="platform-pill">Linux</em></div></div>
      <div class="top-center">${center}</div>
      <div class="top-actions">${actions}</div>
    </header>
    <section class="editor">
      <div class="workspace">
        <div class="stage">
          <div class="canvas-frame" id="canvas"></div>
          <div class="transport-float">
            <select id="aspect">${options(["source", "16:9", "4:3", "1:1", "9:16", "3:4", "2.39:1", "1:2.39"], project.canvas.aspect)}</select>
            <button class="btn icon" id="step-back">‹</button>
            <button class="btn primary" id="play">${state.playing ? t("pause") : t("playing")}</button>
            <button class="btn icon" id="step-forward">›</button>
            <span class="time" id="clock">${formatTime(state.time)} | ${formatTime(Z.duration(project.clips))}</span>
          </div>
        </div>
        <aside class="inspector">
          <div class="inspector-rail">
            ${[["frame","画面"],["opening","开场"],["motion","运镜"],["cursor","光标"],["camera","摄像头"],["audio","声音"]].map(([id, label]) => `
              <button data-tab="${id}" class="${state.tab === id ? "active" : ""}">${state.lang === "zh" ? label : t(id)}</button>`).join("")}
          </div>
          <div class="inspector-body">${inspectorBody()}</div>
        </aside>
      </div>
      <div class="timeline">
        <div class="timeline-bar">
          <button class="btn" id="split">${t("split")}</button>
          <button class="btn" id="add-zoom">${t("zoom")}</button>
          <button class="btn" id="auto-zoom">${t("auto")}</button>
          <button class="btn" id="add-tilt">${t("addTilt")}</button>
          <button class="btn" id="add-mosaic">${t("addMosaic")}</button>
          <label class="btn">${t("addSticker")}<input id="sticker-file" type="file" accept="image/*" hidden></label>
          <button class="btn ghost" id="add-edit-marker">${t("marker")}</button>
        </div>
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
    <div class="segmented" style="margin-bottom:14px">
      ${["background","layout","mockup"].map((id) => `<button data-frame-tab="${id}" class="${state.frameTab === id ? "active" : ""}">${t(id)}</button>`).join("")}
    </div>
    ${state.frameTab === "background" ? backgroundPanel(canvas) : ""}
    ${state.frameTab === "layout" ? layoutPanel(canvas) : ""}
    ${state.frameTab === "mockup" ? mockupPanel(canvas) : ""}
    <div class="section">
      <div class="section-title">${t("export")}</div>
      <label class="field">${t("resolution")}<select id="resolution">${options(["source", "1080p", "1440p", "4k"], state.project.export.resolution)}</select></label>
      <label class="field">${t("fps")}<select id="export-fps">${options(["30", "60"], String(state.project.export.fps))}</select></label>
    </div>`;
}

function backgroundPanel(canvas) {
  return `
    <div class="segmented" style="margin-bottom:12px">
      ${["wallpaper","pattern","dynamic","custom"].map((id) => `<button data-bg-tab="${id}" class="${state.bgTab === id ? "active" : ""}">${t(id)}</button>`).join("")}
    </div>
    ${state.bgTab === "wallpaper" || state.bgTab === "custom" ? `
      <label class="field">${t("background")}
        <span class="swatches">
          <input id="background" type="color" value="${canvas.background || "#16161a"}">
          ${["#16161a", "#f4f1ea", "#1d2430", "#2c241c", "#0b1c2c", "#203040"].map((color) => `<button data-color="${color}" style="background:${color}"></button>`).join("")}
        </span>
      </label>` : ""}
    ${state.bgTab === "pattern" ? `
      <div class="preset-grid">
        ${Object.keys(PATTERN_LABELS.zh).map((id) => `<button class="tile ${canvas.pattern === id ? "active" : ""}" data-pattern="${id}" style="background:${patternPreview(id)}"><span>${PATTERN_LABELS[state.lang][id]}</span></button>`).join("")}
      </div>
      <label class="field">${t("scale")}<input id="pattern-scale" type="range" min="0.5" max="5" step="0.1" value="${canvas.pattern_scale || 1}"></label>
      <label class="field">不透明度<input id="pattern-opacity" type="range" min="0.05" max="1" step="0.05" value="${canvas.pattern_opacity || 1}"></label>` : ""}
    ${state.bgTab === "dynamic" ? `
      <div class="preset-grid">
        ${Object.keys(DYNAMIC_LABELS.zh).map((id) => `<button class="tile ${canvas.dynamic === id ? "active" : ""}" data-dynamic="${id}" style="background:${dynamicPreview(id)}"><span>${DYNAMIC_LABELS[state.lang][id]}</span></button>`).join("")}
      </div>` : ""}`;
}

function layoutPanel(canvas) {
  return `
    <label class="field">${t("padding")}<input id="padding" type="range" min="0" max="0.25" step="0.01" value="${canvas.padding}"></label>
    <label class="field">${t("radius")}<input id="radius" type="range" min="0" max="80" step="1" value="${canvas.radius}"></label>
    <label class="field">${t("shadow")}<input id="shadow" type="range" min="0" max="1" step="0.05" value="${canvas.shadow}"></label>
    <label class="field">${t("border")}<input id="border" type="range" min="0" max="24" step="1" value="${canvas.border || 0}"></label>
    <label class="field">${t("scale")}<input id="content-scale" type="range" min="0.5" max="1.5" step="0.01" value="${canvas.content_scale || 1}"></label>
    <label class="field">水平位置<input id="content-x" type="range" min="0" max="1" step="0.01" value="${canvas.content_x ?? 0.5}"></label>
    <label class="field">垂直位置<input id="content-y" type="range" min="0" max="1" step="0.01" value="${canvas.content_y ?? 0.5}"></label>`;
}

function mockupPanel(canvas) {
  return `
    <div class="section">
      ${Object.keys(FRAME_LABELS.zh).map((id) => `<button class="choice-card ${canvas.screen_frame === id ? "active" : ""}" data-frame="${id}"><strong>${FRAME_LABELS[state.lang][id]}</strong></button>`).join("")}
    </div>
    <label class="field">框体比例<input id="frame-scale" type="range" min="0.6" max="1.6" step="0.05" value="${canvas.frame_scale || 1}"></label>
    <label class="field">顶栏高度<input id="toolbar-scale" type="range" min="0.65" max="1.6" step="0.05" value="${canvas.toolbar_scale || 1}"></label>
    <label class="field">标题<input id="frame-title" type="text" value="${escapeHtml(canvas.frame_title || "DogSC")}"></label>
    <label class="field">地址<input id="frame-address" type="text" value="${escapeHtml(canvas.frame_address || "dogsc.app")}"></label>`;
}

function openingInspector() {
  const opening = state.project.opening || {};
  return `
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
  return `
    <div class="segmented" style="margin-bottom:14px">
      <button data-motion-mode="zoom" class="${state.motionMode === "zoom" ? "active" : ""}">${t("scale")}</button>
      <button data-motion-mode="tilt" class="${state.motionMode === "tilt" ? "active" : ""}">${t("tilt")}</button>
    </div>
    ${state.motionMode === "zoom" ? (selected ? `
      <div class="knob-row">
        <div class="knob"><strong id="zoom-scale-val">${Number(selected.scale).toFixed(2)}x</strong><span>${t("scale")}</span></div>
        <div class="knob"><strong>${Number(selected.enter || 0).toFixed(1)}s</strong><span>${t("enter")}</span></div>
        <div class="knob"><strong>${Number(selected.exit || 0).toFixed(1)}s</strong><span>${t("exit")}</span></div>
      </div>
      <label class="field">${t("scale")}<input id="zoom-scale" type="range" min="1" max="4" step="0.05" value="${selected.scale}"></label>
      <label class="field">${t("enter")}<input id="zoom-enter" type="range" min="0" max="2" step="0.05" value="${selected.enter || 0.45}"></label>
      <label class="field">${t("exit")}<input id="zoom-exit" type="range" min="0" max="2" step="0.05" value="${selected.exit || 0.45}"></label>
      <label class="field">${t("easing")}<select id="easing">${options(Object.keys(EASING[state.lang]), selected.easing, EASING[state.lang])}</select></label>
      <button class="btn" id="delete-zoom">${t("deleteZoom")}</button>
      <p class="note">在预览上点击可设置焦点。</p>` : `<p class="note">在时间线选择一段缩放，或点“${t("zoom")}”。</p>`) : (motion ? `
      <div class="tilt-pad" id="tilt-pad"><div class="knob-dot" id="tilt-dot" style="left:${50 + Number(motion.rotation_y || 0)}%;top:${50 - Number(motion.rotation_x || 0)}%"></div></div>
      <label class="field">Z 旋转<input id="rotation-z" type="range" min="-30" max="30" step="1" value="${motion.rotation_z || 0}"></label>
      <label class="field">透视<input id="perspective" type="range" min="0" max="2" step="0.05" value="${motion.perspective || 0.65}"></label>
      <label class="field">${t("scale")}<input id="motion-scale" type="range" min="0.5" max="2" step="0.05" value="${motion.scale || 1}"></label>
      <button class="btn" id="delete-motion">${t("delete")}</button>` : `<p class="note">点“${t("addTilt")}”在播放头加入 3D 运镜。</p>`)}
    ${state.selectedMosaic ? `
      <div class="section"><div class="section-title">${t("mosaic")}</div>
        <label class="field">强度<input id="mosaic-intensity" type="range" min="0.1" max="1" step="0.05" value="${state.selectedMosaic.intensity || 0.55}"></label>
        <button class="btn" id="delete-mosaic">${t("delete")}</button>
      </div>` : ""}`;
}

function cursorInspector() {
  const cursor = state.project.cursor || {};
  return `
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
    <div class="section-title">调音台</div>
    <label class="field">系统声音<input id="system-volume" type="range" min="0" max="2" step="0.05" value="${audio.system_volume ?? 1}"></label>
    <label class="row"><input id="system-muted" type="checkbox" ${audio.system_muted ? "checked" : ""}> 静音系统声音</label>
    <label class="field">麦克风<input id="mic-volume" type="range" min="0" max="2" step="0.05" value="${audio.mic_volume ?? 1}"></label>
    <label class="row"><input id="mic-muted" type="checkbox" ${audio.mic_muted ? "checked" : ""}> 静音麦克风</label>
    ${clip ? `
      <div class="section"><div class="section-title">当前片段</div>
        <label class="field">${t("speed")}<input id="speed" type="range" min="0.5" max="4" step="0.25" value="${clip.speed || 1}"></label>
        <div class="actions">
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

function bind() {
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
  document.querySelector("#go-record")?.addEventListener("click", () => { state.view = "record"; loadSources().then(render); });
  document.querySelector("#go-demo")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    toast(state.lang === "zh" ? "正在生成示例…" : "Creating the example…");
    try { await openProject((await api("/api/demo", { method: "POST" })).id); }
    catch (error) { toast(error.message); }
    finally { event.currentTarget.disabled = false; }
  });
  const file = document.querySelector("#file");
  if (file) file.onchange = async () => {
    const data = new FormData();
    data.append("file", file.files[0]);
    try { await openProject((await api("/api/projects/import", { method: "POST", body: data })).id); }
    catch (error) { toast(error.message); }
  };
  document.querySelector("#go-path")?.addEventListener("click", async () => {
    const path = prompt(state.lang === "zh" ? "视频文件的绝对路径" : "Absolute path to a video");
    if (!path) return;
    try { await openProject((await api("/api/projects/import", { method: "POST", body: { path } })).id); }
    catch (error) { toast(error.message); }
  });
  document.querySelectorAll("[data-source]").forEach((node) => node.onclick = () => { state.record.source = node.dataset.source; render(); });
  document.querySelectorAll("[data-display]").forEach((node) => node.onclick = () => { state.record.display = Number(node.dataset.display); render(); });
  document.querySelectorAll("[data-window]").forEach((node) => node.onclick = () => { state.record.window = node.dataset.window; render(); });
  const mic = document.querySelector("#mic");
  if (mic) mic.onchange = () => { state.record.mic = mic.checked; };
  const system = document.querySelector("#system");
  if (system) system.onchange = () => { state.record.system = system.checked; };
  const fps = document.querySelector("#fps");
  if (fps) fps.onchange = () => { state.record.fps = Number(fps.value); };
  document.querySelector("#pick-region")?.addEventListener("click", async () => {
    try { state.record.geometry = await api("/api/record/region", { method: "POST", body: {} }); render(); }
    catch (error) { toast(error.message); }
  });
  document.querySelector("#start-record")?.addEventListener("click", startRecording);
  document.querySelector("#stop-record")?.addEventListener("click", stopRecording);
  document.querySelector("#cancel-record")?.addEventListener("click", () => { state.view = "home"; render(); });
  document.querySelector("#add-marker")?.addEventListener("click", () => api("/api/record/marker", { method: "POST", body: {} }).catch((error) => toast(error.message)));

  if (state.view !== "editor") return;
  document.querySelector("#back").onclick = () => { state.view = "home"; state.project = null; state.playing = false; render(); };
  document.querySelector("#undo").onclick = () => mutate(`/api/projects/${state.project.id}/undo`, {});
  document.querySelector("#redo").onclick = () => mutate(`/api/projects/${state.project.id}/redo`, {});
  document.querySelector("#export").onclick = exportProject;
  document.querySelector("#play").onclick = togglePlay;
  document.querySelector("#step-back").onclick = () => { state.time = Math.max(state.time - 0.1, 0); paintCanvas(); };
  document.querySelector("#step-forward").onclick = () => { state.time = Math.min(state.time + 0.1, Z.duration(state.project.clips)); paintCanvas(); };
  document.querySelector("#split").onclick = () => mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
  document.querySelector("#add-zoom").onclick = () => mutate(`/api/projects/${state.project.id}/zoom`, { time: state.time, focus_x: 0.5, focus_y: 0.5, scale: 1.6 });
  document.querySelector("#auto-zoom").onclick = () => mutate(`/api/projects/${state.project.id}/zoom-auto`, {});
  document.querySelector("#add-tilt").onclick = () => mutate(`/api/projects/${state.project.id}/screen-motion`, { time: state.time, rotation_x: 12, rotation_y: -10 });
  document.querySelector("#add-mosaic").onclick = () => mutate(`/api/projects/${state.project.id}/mosaic`, { time: state.time });
  document.querySelector("#add-edit-marker").onclick = () => mutate(`/api/projects/${state.project.id}/marker`, { time: state.time });
  document.querySelector("#sticker-file")?.addEventListener("change", async (event) => {
    const data = new FormData();
    data.append("file", event.target.files[0]);
    try {
      state.project = await api(`/api/projects/${state.project.id}/sticker-upload`, { method: "POST", body: data });
      render();
    } catch (error) { toast(error.message); }
  });
  document.querySelector("#project-name").onchange = (event) => meta({ name: event.target.value });
  document.querySelector("#aspect").onchange = (event) => meta({ canvas: { ...state.project.canvas, aspect: event.target.value } });
  document.querySelectorAll("[data-tab]").forEach((node) => node.onclick = () => { state.tab = node.dataset.tab; render(); });
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
    state.recording = await api("/api/record/start", { method: "POST", body: {
      source: state.record.source,
      display_index: state.record.display,
      window_id: state.record.window,
      geometry: state.record.geometry,
      fps: state.record.fps,
      microphone: state.record.mic,
      system_audio: state.record.system,
    }});
    render();
    pollRecording();
  } catch (error) { toast(error.message); }
}

async function pollRecording() {
  if (state.view !== "record") return;
  try { state.recording = await api("/api/record"); } catch (error) { return; }
  const elapsed = document.querySelector("#elapsed");
  if (elapsed) elapsed.textContent = formatTime(state.recording.elapsed || 0);
  if (state.recording.active) setTimeout(pollRecording, 300);
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
  if (located && Math.abs(video.currentTime - located.source) > 0.12 && !state.playing) video.currentTime = located.source;
  const clock = document.querySelector("#clock");
  if (clock) clock.textContent = `${formatTime(state.time)} | ${formatTime(Z.duration(project.clips))}`;
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
  const width = Math.max(lanes.clientWidth - 100, duration * 140);
  const rows = Z.layout(state.project.clips);
  const makeLane = (label, className, items, paint) => {
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
  const clipLane = makeLane("画面", "clip", rows, (lane, row) => {
    const node = document.createElement("div");
    node.className = "clip";
    node.style.left = `${(row.start / duration) * 100}%`;
    node.style.width = `${(row.duration / duration) * 100}%`;
    node.innerHTML = `<span class="handle left"></span><span class="handle right"></span>`;
    for (let index = 0; index < 8; index += 1) {
      const image = document.createElement("img");
      image.src = `/api/projects/${state.project.id}/thumbs/${index}.jpg`;
      image.alt = "";
      image.onerror = () => image.remove();
      node.append(image);
    }
    node.querySelector(".left").onpointerdown = (event) => dragEdge(event, row, "start", duration, width);
    node.querySelector(".right").onpointerdown = (event) => dragEdge(event, row, "end", duration, width);
    lane.append(node);
  });
  const zoomLane = makeLane("运镜", "zoom", Z.absoluteZooms(state.project.clips, state.project.zooms), (lane, zoom) => {
    const node = document.createElement("div");
    node.className = `zoom${zoom.id === state.selectedZoom ? " selected" : ""}`;
    const end = Number(zoom.end) + Number(zoom.exit || 0);
    node.style.left = `${(zoom.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - zoom.start) / duration * 100, 1)}%`;
    node.title = `${Number(zoom.scale).toFixed(1)}x`;
    node.onclick = () => { state.selectedZoom = zoom.id; state.tab = "motion"; state.motionMode = "zoom"; render(); };
    lane.append(node);
  });
  const motionLane = makeLane("3D", "motion", (state.project.screen_motions || []).map(absoluteItem), (lane, item) => {
    const node = document.createElement("div");
    node.className = `motion${item.id === state.selectedMotion ? " selected" : ""}`;
    const end = Number(item.end) + Number(item.exit || 0);
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - item.start) / duration * 100, 1)}%`;
    node.onclick = () => { state.selectedMotion = item.id; state.tab = "motion"; state.motionMode = "tilt"; render(); };
    lane.append(node);
  });
  const mosaicLane = makeLane("马赛克", "mosaic", (state.project.mosaics || []).map(absoluteItem), (lane, item) => {
    const node = document.createElement("div");
    node.className = `mosaic${item.id === state.selectedMosaic?.id ? " selected" : ""}`;
    node.style.left = `${(item.start / duration) * 100}%`;
    node.style.width = `${Math.max((item.end - item.start) / duration * 100, 1)}%`;
    node.onclick = () => { state.selectedMosaic = item; state.tab = "motion"; render(); };
    lane.append(node);
  });
  const stickerLane = makeLane("贴图", "sticker", (state.project.stickers || []).map(absoluteItem), (lane, item) => {
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
  [clipLane, zoomLane, motionLane, mosaicLane, stickerLane].forEach((entry) => lanes.append(entry.wrap));
  const seek = (event, lane) => {
    const rect = lane.getBoundingClientRect();
    state.time = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
    state.playing = false;
    paintCanvas();
    head.style.left = `${(state.time / duration) * 100}%`;
  };
  clipLane.lane.onpointerdown = (event) => {
    if (event.target.closest(".handle, .zoom, .motion, .mosaic, .sticker-clip")) return;
    seek(event, clipLane.lane);
  };
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
  if (!state.playing) { video?.pause(); render(); return; }
  render();
  const start = performance.now();
  const origin = state.time;
  const total = Z.duration(state.project.clips);
  function frame(now) {
    if (!state.playing) return;
    state.time = Math.min(origin + (now - start) / 1000, total);
    if (state.time >= total) {
      state.time = total;
      state.playing = false;
      video?.pause();
      render();
      return;
    }
    const locatedNow = Z.locateTimeline(state.project.clips, state.time);
    if (video && locatedNow && Math.abs(video.currentTime - locatedNow.source) > 0.18) video.currentTime = locatedNow.source;
    if (video && video.paused) video.play().catch(() => {});
    paintCanvas();
    const head = document.querySelector(".playhead");
    if (head) head.style.left = `${(state.time / total) * 100}%`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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
  } catch (error) {
    toast(error.message);
  }
  render();
}

boot();
