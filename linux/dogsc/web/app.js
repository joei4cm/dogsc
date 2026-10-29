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
  record: { source: "display", display: 0, window: null, geometry: null, fps: 30, mic: false, system: false },
  sources: { displays: [], windows: [] },
  recording: { active: false, elapsed: 0 },
};

const STR = {
  zh: {
    lang: "English",
    title: "录得清楚，剪得轻松。",
    lead: "这是 DogSC 的 Linux 版，给 Ubuntu 和 Omarchy 用。录显示器、窗口或一块区域，再在时间线上分割、裁剪，并让镜头跟着点击走。",
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
    export: "导出 MP4",
    aspect: "比例",
    padding: "留白",
    radius: "圆角",
    shadow: "阴影",
    background: "背景",
    resolution: "分辨率",
    fps: "帧率",
    cursor: "导出时绘制光标",
    easing: "缓动",
    scale: "缩放",
    deleteZoom: "删除运镜",
    deleteClip: "删除片段",
    earlier: "前移",
    later: "后移",
    speed: "速度",
    note: "3D 倾斜、摄像头和 iPhone 采集仍在 macOS 版。Linux 项目不能在 macOS 版里直接打开。",
    noDisplay: "没有列出显示器。",
    noWindow: "没有列出窗口。",
    playing: "播放",
    pause: "暂停",
  },
  en: {
    lang: "中文",
    title: "Record clearly. Cut lightly.",
    lead: "DogSC for Ubuntu and Omarchy. Capture a display, a window, or a region, then split, trim, and zoom toward clicks.",
    record: "Record",
    demo: "Open example",
    import: "Import video",
    path: "Import path",
    projects: "Projects",
    empty: "No projects yet. Open the example to try the timeline and zoom.",
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
    export: "Export MP4",
    aspect: "Aspect",
    padding: "Padding",
    radius: "Radius",
    shadow: "Shadow",
    background: "Background",
    resolution: "Resolution",
    fps: "Frame rate",
    cursor: "Draw cursor in export",
    easing: "Easing",
    scale: "Scale",
    deleteZoom: "Delete zoom",
    deleteClip: "Delete clip",
    earlier: "Move earlier",
    later: "Move later",
    speed: "Speed",
    note: "3D tilt, camera overlay, and iPhone capture stay on macOS. Linux projects do not open in the macOS app.",
    noDisplay: "No displays listed.",
    noWindow: "No windows listed.",
    playing: "Play",
    pause: "Pause",
  },
};

const EASING = {
  zh: { linear: "线性", quadratic: "二次", cubic: "三次", quintic: "五次", spring: "弹簧" },
  en: { linear: "Linear", quadratic: "Quadratic", cubic: "Cubic", quintic: "Quintic", spring: "Spring" },
};

function t(key) { return STR[state.lang][key] || key; }

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...options,
    body: options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
      ? JSON.stringify(options.body)
      : options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function render() {
  document.documentElement.lang = state.lang === "zh" ? "zh-Hans" : "en";
  document.querySelector("#lang").textContent = t("lang");
  const pill = document.querySelector("#platform-pill");
  if (state.env) {
    const family = state.env.family === "omarchy" ? "Omarchy" : state.env.family === "ubuntu" ? "Ubuntu" : "Linux";
    pill.textContent = `${family} · ${state.env.backend_label}`;
  }
  const app = document.querySelector("#app");
  if (state.view === "home") app.innerHTML = homeHtml();
  else if (state.view === "record") app.innerHTML = recordHtml();
  else app.innerHTML = editorHtml();
  bind();
  if (state.view === "editor") mountPreview();
}

function homeHtml() {
  const hints = (state.env?.hints || []).map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  const cards = state.projects.map((project) => `
    <button class="project" data-open="${project.id}">
      <strong>${escapeHtml(project.name || "未命名")}</strong>
      <span>${formatTime(project.duration || 0)} · ${project.width || "?"}×${project.height || "?"}</span>
    </button>`).join("");
  return `<section class="home">
    <div class="hero">
      <div class="card">
        <h1>${t("title")}</h1>
        <p>${t("lead")}</p>
        <div class="actions">
          <button class="primary" id="go-record">${t("record")}</button>
          <button class="ghost" id="go-demo">${t("demo")}</button>
          <label class="ghost" style="display:inline-flex;align-items:center">${t("import")}<input id="file" type="file" accept="video/*" hidden></label>
          <button class="quiet" id="go-path">${t("path")}</button>
        </div>
      </div>
      <div class="card">
        <strong>${state.env ? escapeHtml(state.env.os_name) : ""}</strong>
        <ul class="hints">${hints}</ul>
        <p class="note">${t("note")}</p>
      </div>
    </div>
    <h2>${t("projects")}</h2>
    ${cards ? `<div class="projects">${cards}</div>` : `<p class="empty">${t("empty")}</p>`}
  </section>`;
}

function recordHtml() {
  if (state.recording.active) {
    return `<section class="record"><div class="card">
      <div class="timer" id="elapsed">${formatTime(state.recording.elapsed)}</div>
      <div class="actions">
        <button class="ghost" id="add-marker">${t("marker")}</button>
        <button class="danger" id="stop-record">${t("stop")}</button>
      </div>
    </div></section>`;
  }
  const source = state.record.source;
  const displays = state.sources.displays.map((display, index) => `
    <button class="choice ${index === state.record.display ? "active" : ""}" data-display="${index}">
      ${escapeHtml(display.name)} · ${display.width}×${display.height}
    </button>`).join("") || `<p class="note">${t("noDisplay")}</p>`;
  const windows = state.sources.windows.map((window) => `
    <button class="choice ${window.id === state.record.window ? "active" : ""}" data-window="${escapeHtml(window.id)}">
      ${escapeHtml(window.title)}
    </button>`).join("") || `<p class="note">${t("noWindow")}</p>`;
  const list = source === "display" ? displays : source === "window" ? windows : `
    <p class="note">${state.record.geometry ? `${state.record.geometry.width}×${state.record.geometry.height}` : ""}</p>
    <button class="ghost" id="pick-region">${t("pick")}</button>`;
  return `<section class="record"><div class="card">
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
    <div class="actions"><button class="primary" id="start-record">${t("start")}</button><button class="quiet" id="cancel-record">${t("back")}</button></div>
  </div></section>`;
}

function editorHtml() {
  const project = state.project;
  const canvas = project.canvas;
  const selected = project.zooms.find((zoom) => zoom.id === state.selectedZoom);
  const clip = Z.locateTimeline(project.clips, state.time)?.clip;
  return `<section class="editor">
    <div class="workspace">
      <div class="stage"><div class="canvas-frame" id="canvas"></div></div>
      <aside class="inspector">
        <h2>${escapeHtml(project.name)}</h2>
        <label class="field">${t("aspect")}<select id="aspect">${options(["source", "16:9", "4:3", "1:1", "9:16", "3:4"], canvas.aspect)}</select></label>
        <label class="field">${t("padding")}<input id="padding" type="range" min="0" max="0.2" step="0.01" value="${canvas.padding}"></label>
        <label class="field">${t("radius")}<input id="radius" type="range" min="0" max="80" step="1" value="${canvas.radius}"></label>
        <label class="field">${t("shadow")}<input id="shadow" type="range" min="0" max="1" step="0.05" value="${canvas.shadow}"></label>
        <label class="field">${t("background")}<input id="background" type="color" value="${canvas.background}">
          <span class="swatches">${["#16161a", "#f4f1ea", "#1d2430", "#2c241c"].map((color) => `<button data-color="${color}" style="background:${color}"></button>`).join("")}</span>
        </label>
        <label class="field">${t("resolution")}<select id="resolution">${options(["source", "1080p", "1440p", "4k"], project.export.resolution)}</select></label>
        <label class="field">${t("fps")}<select id="export-fps">${options(["30", "60"], String(project.export.fps))}</select></label>
        <label class="row"><input id="draw-cursor" type="checkbox" ${project.draw_cursor ? "checked" : ""}> ${t("cursor")}</label>
        ${selected ? `<label class="field">${t("scale")}<input id="zoom-scale" type="range" min="1" max="3" step="0.05" value="${selected.scale}"></label>
          <label class="field">${t("easing")}<select id="easing">${options(Object.keys(EASING[state.lang]), selected.easing, EASING[state.lang])}</select></label>
          <button class="ghost" id="delete-zoom">${t("deleteZoom")}</button>` : ""}
        ${clip ? `<label class="field">${t("speed")}<input id="speed" type="range" min="0.5" max="2" step="0.25" value="${clip.speed || 1}"></label>
          <div class="actions"><button class="ghost" id="move-earlier">${t("earlier")}</button><button class="ghost" id="move-later">${t("later")}</button><button class="quiet" id="delete-clip">${t("deleteClip")}</button></div>` : ""}
        <div class="actions"><button class="primary" id="export">${t("export")}</button></div>
        <p class="note">${t("note")}</p>
      </aside>
    </div>
    <div class="timeline">
      <div class="transport">
        <button class="ghost" id="back">${t("back")}</button>
        <button class="primary" id="play">${state.playing ? t("pause") : t("playing")}</button>
        <span class="time" id="clock">${formatTime(state.time)} / ${formatTime(Z.duration(project.clips))}</span>
        <button class="ghost" id="split">${t("split")}</button>
        <button class="ghost" id="add-zoom">${t("zoom")}</button>
        <button class="ghost" id="auto-zoom">${t("auto")}</button>
        <button class="quiet" id="add-edit-marker">${t("marker")}</button>
      </div>
      <div class="lanes" id="lanes"></div>
    </div>
  </section>`;
}

function options(values, current, labels) {
  return values.map((value) => `<option value="${value}" ${String(value) === String(current) ? "selected" : ""}>${labels ? labels[value] : value}</option>`).join("");
}

function bind() {
  document.querySelector("#lang").onclick = () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("dogsc-lang", state.lang);
    render();
  };
  document.querySelectorAll("[data-open]").forEach((node) => node.onclick = () => openProject(node.dataset.open));
  const goRecord = document.querySelector("#go-record");
  if (goRecord) goRecord.onclick = () => { state.view = "record"; loadSources().then(render); };
  const demo = document.querySelector("#go-demo");
  if (demo) demo.onclick = async () => {
    demo.disabled = true;
    toast(state.lang === "zh" ? "正在生成示例…" : "Creating the example…");
    try { await openProject((await api("/api/demo", { method: "POST" })).id); }
    catch (error) { toast(error.message); }
    finally { demo.disabled = false; }
  };
  const file = document.querySelector("#file");
  if (file) file.onchange = async () => {
    const data = new FormData();
    data.append("file", file.files[0]);
    try { await openProject((await api("/api/projects/import", { method: "POST", body: data })).id); }
    catch (error) { toast(error.message); }
  };
  const pathButton = document.querySelector("#go-path");
  if (pathButton) pathButton.onclick = async () => {
    const path = prompt(state.lang === "zh" ? "视频文件的绝对路径" : "Absolute path to a video");
    if (!path) return;
    try { await openProject((await api("/api/projects/import", { method: "POST", body: { path } })).id); }
    catch (error) { toast(error.message); }
  };
  document.querySelectorAll("[data-source]").forEach((node) => node.onclick = () => { state.record.source = node.dataset.source; render(); });
  document.querySelectorAll("[data-display]").forEach((node) => node.onclick = () => { state.record.display = Number(node.dataset.display); render(); });
  document.querySelectorAll("[data-window]").forEach((node) => node.onclick = () => { state.record.window = node.dataset.window; render(); });
  const mic = document.querySelector("#mic");
  if (mic) mic.onchange = () => { state.record.mic = mic.checked; };
  const system = document.querySelector("#system");
  if (system) system.onchange = () => { state.record.system = system.checked; };
  const fps = document.querySelector("#fps");
  if (fps) fps.onchange = () => { state.record.fps = Number(fps.value); };
  const pick = document.querySelector("#pick-region");
  if (pick) pick.onclick = async () => {
    pick.disabled = true;
    try { state.record.geometry = await api("/api/record/region", { method: "POST", body: {} }); render(); }
    catch (error) { toast(error.message); pick.disabled = false; }
  };
  const start = document.querySelector("#start-record");
  if (start) start.onclick = startRecording;
  const cancel = document.querySelector("#cancel-record");
  if (cancel) cancel.onclick = () => { state.view = "home"; render(); };
  const stop = document.querySelector("#stop-record");
  if (stop) stop.onclick = stopRecording;
  const marker = document.querySelector("#add-marker");
  if (marker) marker.onclick = () => api("/api/record/marker", { method: "POST", body: {} }).catch((error) => toast(error.message));
  bindEditor();
}

function bindEditor() {
  if (state.view !== "editor" || !state.project) return;
  document.querySelector("#back").onclick = () => { state.playing = false; state.view = "home"; refresh().then(render); };
  document.querySelector("#play").onclick = togglePlay;
  document.querySelector("#split").onclick = () => mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
  document.querySelector("#add-zoom").onclick = () => mutate(`/api/projects/${state.project.id}/zoom`, { time: state.time, focus_x: 0.5, focus_y: 0.5 });
  document.querySelector("#auto-zoom").onclick = () => mutate(`/api/projects/${state.project.id}/zoom-auto`, {});
  document.querySelector("#add-edit-marker").onclick = () => mutate(`/api/projects/${state.project.id}/marker`, { time: state.time });
  document.querySelector("#export").onclick = exportProject;
  document.querySelector("#aspect").onchange = (event) => meta({ canvas: { ...state.project.canvas, aspect: event.target.value } });
  document.querySelector("#resolution").onchange = (event) => meta({ export: { ...state.project.export, resolution: event.target.value } });
  document.querySelector("#export-fps").onchange = (event) => meta({ export: { ...state.project.export, fps: Number(event.target.value) } });
  document.querySelector("#background").onchange = (event) => meta({ canvas: { ...state.project.canvas, background: event.target.value } });
  document.querySelectorAll("[data-color]").forEach((node) => node.onclick = () => meta({ canvas: { ...state.project.canvas, background: node.dataset.color } }));
  bindRange("#padding", "padding");
  bindRange("#radius", "radius");
  bindRange("#shadow", "shadow");
  const draw = document.querySelector("#draw-cursor");
  if (draw) draw.onchange = () => meta({ draw_cursor: draw.checked });
  const zoomScale = document.querySelector("#zoom-scale");
  if (zoomScale) zoomScale.onchange = () => mutate(`/api/projects/${state.project.id}/zoom-update`, { id: state.selectedZoom, scale: Number(zoomScale.value) });
  const easing = document.querySelector("#easing");
  if (easing) easing.onchange = () => mutate(`/api/projects/${state.project.id}/zoom-update`, { id: state.selectedZoom, easing: easing.value });
  const deleteZoom = document.querySelector("#delete-zoom");
  if (deleteZoom) deleteZoom.onclick = async () => {
    state.project = await api(`/api/projects/${state.project.id}/zooms/${state.selectedZoom}`, { method: "DELETE" });
    state.selectedZoom = null;
    render();
  };
  const speed = document.querySelector("#speed");
  const located = Z.locateTimeline(state.project.clips, state.time);
  if (speed && located) speed.onchange = () => mutate(`/api/projects/${state.project.id}/speed`, { id: located.clip.id, speed: Number(speed.value) });
  const earlier = document.querySelector("#move-earlier");
  if (earlier && located) earlier.onclick = () => mutate(`/api/projects/${state.project.id}/move`, { id: located.clip.id, direction: -1 });
  const later = document.querySelector("#move-later");
  if (later && located) later.onclick = () => mutate(`/api/projects/${state.project.id}/move`, { id: located.clip.id, direction: 1 });
  const deleteClip = document.querySelector("#delete-clip");
  if (deleteClip && located) deleteClip.onclick = () => mutate(`/api/projects/${state.project.id}/delete-clip`, { id: located.clip.id });
  drawTimeline();
}

function bindRange(selector, key) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.oninput = () => paintCanvas();
  node.onchange = () => meta({ canvas: { ...state.project.canvas, [key]: Number(node.value) } });
}

async function meta(body) {
  try {
    state.project = await api(`/api/projects/${state.project.id}/meta`, { method: "POST", body });
    paintCanvas();
  } catch (error) { toast(error.message); }
}

async function mutate(path, body) {
  try {
    state.project = await api(path, { method: "POST", body });
    render();
  } catch (error) { toast(error.message); }
}

async function openProject(id) {
  state.project = await api(`/api/projects/${id}`);
  state.pointer = (await api(`/api/projects/${id}/pointer`)).events || [];
  state.time = 0;
  state.playing = false;
  state.selectedZoom = state.project.zooms[0]?.id || null;
  state.view = "editor";
  render();
}

async function refresh() {
  state.projects = await api("/api/projects");
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
  frame.innerHTML = `<div class="content-box" id="content"><div class="camera" id="camera"><video id="video" src="/api/projects/${project.id}/media" playsinline></video><div class="cursor" id="cursor" hidden></div><div class="focus-dot" id="focus" hidden></div></div></div>`;
  const video = document.querySelector("#video");
  video.onloadedmetadata = paintCanvas;
  document.querySelector("#content").onclick = (event) => {
    if (!state.selectedZoom) return;
    const rect = document.querySelector("#content").getBoundingClientRect();
    const view = Z.sampleViewport(project.clips, project.zooms, state.time);
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    mutate(`/api/projects/${project.id}/zoom-update`, {
      id: state.selectedZoom,
      focus_x: Z.clamp(u * view.size + view.left, 0, 1),
      focus_y: Z.clamp(v * view.size + view.top, 0, 1),
    });
  };
  paintCanvas();
  drawTimeline();
}

function paintCanvas() {
  if (state.view !== "editor") return;
  const project = state.project;
  const canvas = {
    ...project.canvas,
    padding: Number(document.querySelector("#padding")?.value ?? project.canvas.padding),
    radius: Number(document.querySelector("#radius")?.value ?? project.canvas.radius),
    shadow: Number(document.querySelector("#shadow")?.value ?? project.canvas.shadow),
  };
  const frame = document.querySelector("#canvas");
  const ratio = aspectRatio(canvas.aspect, project.media.width, project.media.height);
  frame.style.aspectRatio = `${ratio}`;
  frame.style.background = canvas.background;
  const pad = Number(canvas.padding) * 100;
  const content = document.querySelector("#content");
  content.style.left = `${pad}%`;
  content.style.right = `${pad}%`;
  content.style.top = `${pad}%`;
  content.style.bottom = `${pad}%`;
  content.style.borderRadius = `${canvas.radius}px`;
  content.style.boxShadow = canvas.shadow > 0 ? `0 18px 30px rgba(0,0,0,${canvas.shadow})` : "none";
  const view = Z.sampleViewport(project.clips, project.zooms, state.time);
  const camera = document.querySelector("#camera");
  const shiftX = -view.left / view.size;
  const shiftY = -view.top / view.size;
  camera.style.transform = `translate(${shiftX * 100}%, ${shiftY * 100}%) scale(${1 / view.size})`;
  const located = Z.locateTimeline(project.clips, state.time);
  const video = document.querySelector("#video");
  if (located && video && Math.abs((video.currentTime || 0) - located.source) > 0.12 && !state.playing) {
    video.currentTime = located.source;
  }
  placeCursor(located, view);
  const focus = document.querySelector("#focus");
  const selected = project.zooms.find((zoom) => zoom.id === state.selectedZoom);
  if (focus && selected) {
    focus.hidden = false;
    focus.style.left = `${selected.focus_x * 100}%`;
    focus.style.top = `${selected.focus_y * 100}%`;
  } else if (focus) focus.hidden = true;
  const clock = document.querySelector("#clock");
  if (clock) clock.textContent = `${formatTime(state.time)} / ${formatTime(Z.duration(project.clips))}`;
}

function placeCursor(located, view) {
  const cursor = document.querySelector("#cursor");
  if (!cursor || !located || state.project.capture?.cursor_baked) {
    if (cursor) cursor.hidden = true;
    return;
  }
  const event = [...state.pointer].reverse().find((item) => Number(item.t) <= located.source + 0.02);
  if (!event) { cursor.hidden = true; return; }
  cursor.hidden = false;
  cursor.style.left = `${Number(event.x) * 100}%`;
  cursor.style.top = `${Number(event.y) * 100}%`;
  cursor.classList.toggle("click", event.kind === "left" && located.source - Number(event.t) < 0.25);
}

function drawTimeline() {
  const lanes = document.querySelector("#lanes");
  if (!lanes || !state.project) return;
  const duration = Math.max(Z.duration(state.project.clips), 0.1);
  const width = Math.max(lanes.clientWidth - 24, duration * 120);
  const rows = Z.layout(state.project.clips);
  const clipLane = document.createElement("div");
  clipLane.className = "lane";
  clipLane.style.width = `${width}px`;
  rows.forEach((row) => {
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
    clipLane.append(node);
  });
  const zoomLane = document.createElement("div");
  zoomLane.className = "lane";
  zoomLane.style.width = `${width}px`;
  Z.absoluteZooms(state.project.clips, state.project.zooms).forEach((zoom) => {
    const node = document.createElement("div");
    node.className = `zoom${zoom.id === state.selectedZoom ? " selected" : ""}`;
    const end = Number(zoom.end) + Number(zoom.exit || 0);
    node.style.left = `${(zoom.start / duration) * 100}%`;
    node.style.width = `${Math.max((end - zoom.start) / duration * 100, 1)}%`;
    node.onclick = () => { state.selectedZoom = zoom.id; render(); };
    zoomLane.append(node);
  });
  state.project.markers.forEach((marker) => {
    const row = rows.find((item) => item.id === marker.clip_id);
    if (!row) return;
    const tick = document.createElement("div");
    tick.className = "marker";
    tick.style.left = `${((row.start + Number(marker.local)) / duration) * 100}%`;
    clipLane.append(tick);
  });
  const head = document.createElement("div");
  head.className = "playhead";
  head.style.left = `${(state.time / duration) * 100}%`;
  clipLane.append(head);
  lanes.innerHTML = "";
  lanes.append(clipLane, zoomLane);
  lanes.onpointerdown = (event) => {
    if (event.target.closest(".handle, .zoom")) return;
    const rect = clipLane.getBoundingClientRect();
    state.time = Z.clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
    state.playing = false;
    paintCanvas();
    head.style.left = `${(state.time / duration) * 100}%`;
  };
}

function dragEdge(event, row, edge, duration, width) {
  event.stopPropagation();
  event.preventDefault();
  const startX = event.clientX;
  const origin = state.time;
  function move(next) {
    const delta = ((next.clientX - startX) / width) * duration;
    const time = edge === "start" ? row.start + delta : row.end + delta;
    state.time = Z.clamp(time, row.start, row.end);
    paintCanvas();
  }
  function up(next) {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const delta = ((next.clientX - startX) / width) * duration;
    const time = edge === "start" ? row.start + delta : row.end + delta;
    state.time = origin;
    mutate(`/api/projects/${state.project.id}/trim`, { id: row.id, edge, time: Z.clamp(time, row.start, row.end) });
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function togglePlay() {
  state.playing = !state.playing;
  const video = document.querySelector("#video");
  const button = document.querySelector("#play");
  if (button) button.textContent = state.playing ? t("pause") : t("playing");
  if (!state.playing) { video?.pause(); return; }
  const located = Z.locateTimeline(state.project.clips, state.time);
  if (video && located) {
    video.currentTime = located.source;
    video.play().catch(() => {});
  }
  let previous = performance.now();
  function frame(now) {
    if (!state.playing || state.view !== "editor") return;
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    state.time += dt;
    const total = Z.duration(state.project.clips);
    if (state.time >= total) {
      state.time = total;
      state.playing = false;
      video?.pause();
      render();
      return;
    }
    const locatedNow = Z.locateTimeline(state.project.clips, state.time);
    if (video && locatedNow && Math.abs(video.currentTime - locatedNow.source) > 0.18) video.currentTime = locatedNow.source;
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
  const table = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "9:16": 9 / 16, "3:4": 3 / 4, source: width / height };
  return table[aspect] || width / height;
}

function formatTime(seconds) {
  const safe = Math.max(Number(seconds) || 0, 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return;
  if (event.code === "Space" && state.view === "editor") { event.preventDefault(); togglePlay(); }
  if (event.key === "s" && state.view === "editor") mutate(`/api/projects/${state.project.id}/split`, { time: state.time });
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
