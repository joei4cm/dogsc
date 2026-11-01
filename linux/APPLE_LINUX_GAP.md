# Apple Soft Silver ↔ Linux：像素 / 功能 Gap 与更优实现

对照基线：`Sources/DogSCApp/*` Soft Silver 原版 vs `linux/dogsc/web-*` Soft Silver 桥。

## P0（体验或预览真相源）

| ID | Gap | Apple | Linux 现状 | 更好的 Linux 实现 | Web 现在？ |
|---|---|---|---|---|---|
| G01 | GPU 预览 | CIImage→CAMetalLayer，CADisplayLink | `<video>` + CSS transform | **Qt6 QQuickItem + Vulkan RHI**（或 Tauri+wgpu） | 否 → Qt6 |
| G02 | 零容差 scrub | AVPlayer tolerance=0 | **加强**：Full ε≈0 settle + hover 虚线引导 + 时间徽章；Fast 粗 scrub；Alt 切割引导 | 原生解码纹理 | 部分 |
| G03 | 浮动录制岛 | 独立 NSPanel + morph spring 0.5/0.82 | **加强**：idle↔live morph；Qt 无边框窗仍为最优 | Qt / Wayland layer-shell | 部分 |
| G04 | Continuous 圆角 | `cornerCurve = .continuous` | CSS 圆形 radius | Qt SDF squircle / Skia | 否 → Qt6 |
| G06 | 指针流 | CGEvent | 仅 X11 PointerSampler | **libinput** / portal RD / 合成器 API | 否 |
| G07 | Crop 草稿态 | 确认/取消/清除 + 八控点 | **已落地**：草稿 overlay、检查器、Esc 取消、导出 `canvas.crop` | GPU 预览仍依赖 G01 | **是** |

## P1（可在 Web Soft Silver 落地）

| ID | Gap | 更好 Linux 路径 | Web 现状 |
|---|---|---|---|
| G09 | Inspector matchedGeometry spring | Qt Spring / JS spring | **已落地** `DogSCMotion.settle` 积分拇指 |
| G10 | 按压缩放 0.92/0.96 | 同 token | **已对齐** |
| G11 | 岛阴影 r1.5/18/44 | 同 token | **已对齐 box-shadow** |
| G13 | Stage dots 18 / r0.8 / α0.13 | 同 token | **已对齐** EditorStageDots |
| G14 | Inspector 宽 384（340–480） | 可拖拽分栏 | **已落地** 拖拽 340–480 |
| G15 | Timeline 高可拖 | 拖拽手柄 | **已落地** 180–420 |
| G16 | Mockup 转盘 | WebGL/canvas 或 Qt PathView | **已落地** 横向 snap 转盘 + 剪影 |
| G17 | 系统壁纸目录 | `~/.local/share/backgrounds` + portal | **已落地** `/api/wallpapers` 扫描 |
| G18 | 真波形 | ffmpeg peaks | **已落地** `/peaks` + canvas |
| G19 | 时间对齐胶片 | thumb-by-time | **已落地** `/thumb?t=` |
| G20 | 磁吸到 clip/overlay 边 | 同 Apple targets | **已落地** capture/escape 滞回 + 抑制起始边 + scrub/trim guide |
| G21 | Export Sheet | export_plan 估大小 | **已落地** 估大小 / 进度 / 选项 sheet |
| G22 | Full / Fast 预览 | 原生档位 | **已落地** 菜单接线（Fast 降滤镜 + 放宽松 seek） |
| G23 | 页面 handoff 动效 | View Transition / Qt stack | **已落地** `startViewTransition` + softEnter |
| G26 | 恢复已删剪辑 / 标记 | 原生 undo bag | **已落地** `deleted_clips` + marker 改名/删除 |
| G24 | 实况摄像头 PiP | getUserMedia / Qt Multimedia | **已接线** getUserMedia（无设备时占位） |
| G25 | focus-dot / mosaic / sticker 舞台 | Metal overlay | **已落地** overlays + **拖拽** / PiP 拖拽 |
| G27 | 快捷键 ⌘E / fit-all / reduce-motion | AppKit menu | **已落地** |
| G28 | Clip chrome 强调层级 | idle/hover/selected/editing | **已落地** hover 控点 + 描边层级 + 胶片 reveal |
| G29 | 轨道显隐 | EditorTimelineTrackVisibility | **已落地** 时间线轨道菜单（运镜/3D/马赛克/贴图） |
| G30 | Hover 时间徽章 | NativeTimelineHoverGuide | **已落地** 虚线 + 0:00.00 徽章 |
| G31 | Option 切割引导 | Alt edit target | **已落地** Alt 虚线 + Alt-click 分割 |
| G32 | Playhead 握柄 | NativeTimelinePlayhead knob 11×17 | **已落地** 胶囊握柄 + scrub 强调缩放 |
| G33 | Mosaic 舞台缩放 | 四角控点 | **已落地** 选中后四角 resize |
| G34 | Focus map 拖拽 | 运镜焦点 | **已落地** pointer drag |
| G35 | 逐帧 / 跳秒 / 片段换序 | ←→ ⇧ , . [ ] | **已落地** |

## P2+ 与原生毕业路径

| 需求（Apple） | 更优 Linux 栈 | 说明 |
|---|---|---|
| Soft Silver + 真 spring morph | **Qt 6 QML + Vulkan RHI**（parity 推荐） | 连续胶囊、原生窗、GPU 预览；见 `linux/native/qt6` |
| 快速复用现有 Soft Silver CSS | **Tauri 2 + wgpu** | 留 web chrome，换预览表面 |
| Ubuntu Wayland 采集 | **xdg-desktop-portal + PipeWire**（已有）/ GTK4+GStreamer | 门户契合度最高 |
| 指针轨迹 | **libinput** / portal remote desktop | 浏览器拿不到 CGEvent 级流 |

**结论：** Web Soft Silver 已收齐可复刻 P1（含 G09/G13/G16/G17/G20 滞回、G23/G26、G28–G35）。P0 预览真相源 / continuous 圆角 / 浮动录制窗的**最优解**仍是 **Qt6-QML-Vulkan**（`linux/native/qt6`）；Web 用 `corner-shape: squircle` 作 continuous 过渡近似。
