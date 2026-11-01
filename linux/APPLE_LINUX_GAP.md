# Apple Soft Silver ↔ Linux：像素 / 功能 Gap 与更优实现

对照基线：`Sources/DogSCApp/*` Soft Silver 原版 vs `linux/dogsc/web-*` Soft Silver 桥。

## P0（体验或预览真相源）

| ID | Gap | Apple | Linux 现状 | 更好的 Linux 实现 | Web 现在？ |
|---|---|---|---|---|---|
| G01 | GPU 预览 | CIImage→CAMetalLayer，CADisplayLink | `<video>` + CSS transform | **Qt6 QQuickItem + Vulkan RHI**（或 Tauri+wgpu） | 否 |
| G02 | 零容差 scrub | AVPlayer tolerance=0 | HTMLVideo seek ~40ms | 原生解码纹理 + 同 coalesce 契约 | 部分 |
| G03 | 浮动录制岛 | 独立 NSPanel + morph spring 0.5/0.82 | 页内 `.recorder-capsule` | Qt 无边框窗 / Wayland layer-shell | 部分 |
| G04 | Continuous 圆角 | `cornerCurve = .continuous` | CSS 圆形 radius | Qt SDF squircle / Skia | 否 |
| G06 | 指针流 | CGEvent | 仅 X11 PointerSampler | **libinput** / portal RD / 合成器 API | 否 |
| G07 | Crop 草稿态 | 完整 crop 确认/取消 | 仅 `cropping` 开关 | Web 可先做 overlay+API；GPU 预览依赖 G01 | 部分 |

## P1（可在 Web Soft Silver 落地 / 已部分落地）

| ID | Gap | 更好 Linux 路径 | Web 现状 |
|---|---|---|---|
| G09 | Inspector matchedGeometry spring | Qt Spring / JS spring 积分 | CSS 拇指 + `slideThumb` |
| G10 | 按压缩放 0.92/0.96 | 同 token | **已对齐** |
| G11 | 岛阴影 r1.5/18/44 | 同 token | **已对齐 box-shadow** |
| G13 | Stage dots 24 / 1.2 / α0.11 | 同 token | **已对齐** |
| G14 | Inspector 宽 384（340–480） | 可拖拽分栏 | **360px**（阶段预算） |
| G15 | Timeline 高可拖 | 拖拽手柄 | 固定 248 |
| G16 | Mockup 转盘 | WebGL/canvas 或 Qt PathView | 列表 choice-card |
| G17 | 系统壁纸目录 | `~/.local/share/backgrounds` + portal | CSS 预设 |
| G18 | 真波形 | ffmpeg peaks API | 假条纹 |
| G19 | 时间对齐胶片 | thumb-by-time API | 最多 8 张静态 thumb |
| G20 | 磁吸到 clip/overlay 边 | 同 Apple targets | **已落地 ~8px 磁吸** |
| G21 | Export Sheet | 复用 export_plan 估大小 | POST+poll |
| G23 | 页面 handoff 动效 | View Transition / Qt stack | softEnter + 局部更新 |
| G24 | 实况摄像头 PiP | getUserMedia 或 Qt Multimedia | CAM 占位 |

## P2+ 与原生毕业路径

| 需求（Apple） | 更优 Linux 栈 | 说明 |
|---|---|---|
| Soft Silver + 真 spring morph | **Qt 6 QML + Vulkan RHI**（parity 推荐） | 连续胶囊、原生窗、GPU 预览 |
| 快速复用现有 Soft Silver CSS | **Tauri 2 + wgpu** | 留 web chrome，换预览表面 |
| Ubuntu Wayland 采集 | **xdg-desktop-portal + PipeWire**（已有）/ GTK4+GStreamer | 门户契合度最高 |
| 指针轨迹 | **libinput** / portal remote desktop | 浏览器拿不到 CGEvent 级流 |

**结论：** Web Soft Silver 继续收 P1 像素/UX；预览真相源与浮动录制岛毕业到 **Qt6-QML-Vulkan**（仓库已有 `linux/native/qt6` 骨架）。
