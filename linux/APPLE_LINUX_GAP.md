# Apple Soft Silver ↔ Linux：像素 / 功能 Gap 与更优实现

对照基线：`Sources/DogSCApp/*` Soft Silver 原版 vs `linux/dogsc/web-*` Soft Silver 桥。

## P0（体验或预览真相源）

| ID | Gap | Apple | Linux 现状 | 更好的 Linux 实现 | Web 现在？ |
|---|---|---|---|---|---|
| G01 | GPU 预览 | CIImage→CAMetalLayer，CADisplayLink | `<video>` + CSS transform | **Qt6 QQuickItem + Vulkan RHI**（或 Tauri+wgpu） | 否 → Qt6 |
| G02 | 零容差 scrub | AVPlayer tolerance=0 | HTMLVideo seek coalesce + Full 精确 settle | 原生解码纹理 | 部分 |
| G03 | 浮动录制岛 | 独立 NSPanel + morph spring 0.5/0.82 | 页内 `.recorder-capsule` | Qt 无边框窗 / Wayland layer-shell | 部分 |
| G04 | Continuous 圆角 | `cornerCurve = .continuous` | CSS 圆形 radius | Qt SDF squircle / Skia | 否 → Qt6 |
| G06 | 指针流 | CGEvent | 仅 X11 PointerSampler | **libinput** / portal RD / 合成器 API | 否 |
| G07 | Crop 草稿态 | 确认/取消/清除 + 八控点 | **已落地**：草稿 overlay、检查器、Esc 取消、导出 `canvas.crop` | GPU 预览仍依赖 G01 | **是** |

## P1（可在 Web Soft Silver 落地）

| ID | Gap | 更好 Linux 路径 | Web 现状 |
|---|---|---|---|
| G09 | Inspector matchedGeometry spring | Qt Spring / JS spring | CSS 拇指 + `slideThumb` |
| G10 | 按压缩放 0.92/0.96 | 同 token | **已对齐** |
| G11 | 岛阴影 r1.5/18/44 | 同 token | **已对齐 box-shadow** |
| G13 | Stage dots 24 / 1.2 / α0.11 | 同 token | **已对齐** |
| G14 | Inspector 宽 384（340–480） | 可拖拽分栏 | **已落地** 拖拽 340–480 |
| G15 | Timeline 高可拖 | 拖拽手柄 | **已落地** 180–420 |
| G16 | Mockup 转盘 | WebGL/canvas 或 Qt PathView | 列表 choice-card（可接受最优解） |
| G17 | 系统壁纸目录 | `~/.local/share/backgrounds` + portal | CSS 预设（门户最优解另议） |
| G18 | 真波形 | ffmpeg peaks | **已落地** `/peaks` + canvas |
| G19 | 时间对齐胶片 | thumb-by-time | **已落地** `/thumb?t=` |
| G20 | 磁吸到 clip/overlay 边 | 同 Apple targets | **已落地** scrub + **trim** + snap guide |
| G21 | Export Sheet | export_plan 估大小 | **已落地** 估大小 / 进度 / 选项 sheet |
| G22 | Full / Fast 预览 | 原生档位 | **已落地** 菜单接线（Fast 降滤镜 + 放宽松 seek） |
| G23 | 页面 handoff 动效 | View Transition / Qt stack | softEnter + 局部更新 |
| G24 | 实况摄像头 PiP | getUserMedia / Qt Multimedia | **已接线** getUserMedia（无设备时占位） |
| G25 | focus-dot / mosaic / sticker 舞台 | Metal overlay | **已落地** stage overlays |

## P2+ 与原生毕业路径

| 需求（Apple） | 更优 Linux 栈 | 说明 |
|---|---|---|
| Soft Silver + 真 spring morph | **Qt 6 QML + Vulkan RHI**（parity 推荐） | 连续胶囊、原生窗、GPU 预览；见 `linux/native/qt6` |
| 快速复用现有 Soft Silver CSS | **Tauri 2 + wgpu** | 留 web chrome，换预览表面 |
| Ubuntu Wayland 采集 | **xdg-desktop-portal + PipeWire**（已有）/ GTK4+GStreamer | 门户契合度最高 |
| 指针轨迹 | **libinput** / portal remote desktop | 浏览器拿不到 CGEvent 级流 |

**结论：** Web Soft Silver 已收齐可复刻的 P1 UX（G07/G14/G15/G18–G22/G24/G25）。P0 预览真相源 / continuous 圆角 / 浮动录制窗的**最优解**仍是 **Qt6-QML-Vulkan**（`linux/native/qt6`），Web 桥作为过渡 chrome 保留。
