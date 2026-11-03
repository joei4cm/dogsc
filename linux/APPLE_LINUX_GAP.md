# Apple Soft Silver ↔ Linux：像素 / 功能 Gap 与更优实现

对照基线：`Sources/DogSCApp/*` Soft Silver 原版 vs `linux/dogsc/web-*` Soft Silver 桥 + `linux/native/qt6`。

## P0（体验或预览真相源）

| ID | Gap | Apple | Linux 现状 | 更好的 Linux 实现 | 状态 |
|---|---|---|---|---|---|
| G01 | GPU 预览 | CIImage→CAMetalLayer，CADisplayLink | Web：`<video>`；**Qt6：`PreviewSurfaceItem` QSGPlainTexture/QRhi（Vulkan 优先）+ `presentNativeTexture` 零拷贝导入缝** | 生产 DMA-BUF 导出器接线 | Web 否；Qt6 **已落地** |
| G02 | 零容差 scrub | AVPlayer tolerance=0 | Web：Full ε≈0 settle；**Qt6：`presentMediaFrame` ffmpeg 解码→纹理** | 常驻解码器 + 时间码纹理缓存 | Web 部分；Qt6 **已落地**（解码→纹理路径） |
| G03 | 浮动录制岛 | 独立 NSPanel + morph spring 0.5/0.82 | Web：idle↔live morph；**Qt6：frameless `RecorderIsland` + `IslandAnchor`（layer-shell / screen）** | 合成器专有扩展 | Web 部分；Qt6 **已落地** |
| G04 | Continuous 圆角 | `cornerCurve = .continuous` | Web：CSS 圆形 radius；**Qt6：`ContinuousPanel` + SDF `ContinuousSdfPanel`** | — | Web 否；Qt6 **已落地** |
| G06 | 指针流 | CGEvent | **`dogsc.pointer`：libinput-evdev 优先，X11 回退**；recorder 已接线 | portal RD 指针注入 | **已落地** |
| G07 | Crop 草稿态 | 确认/取消/清除 + 八控点 | **已落地**：草稿 overlay、检查器、Esc 取消、导出 `canvas.crop` | GPU 预览跟 G01 | **是** |

## P1（可在 Web Soft Silver 落地）

| ID | Gap | 更好 Linux 路径 | Web 现状 |
|---|---|---|---|
| G09 | Inspector matchedGeometry spring | Qt Spring / JS spring | **已落地** `DogSCMotion.settle` 积分拇指 |
| G10 | 按压缩放 0.92/0.96 | 同 token | **已对齐** |
| G11 | 岛阴影 r1.5/18/44 | 同 token | **已对齐 box-shadow** |
| G13 | Stage dots 24 / 1.2 / α0.11 + mask | EditorWorkspaceGrid | **已对齐**（误用 StageDots 已纠正） |
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
| G36 | 摄像头主源 / 录屏 PiP 副轨 | AVCapture + Continuity Camera | **已落地** V4L2 枚举 + ffmpeg 主源/sidecar → `camera.mp4`；导出滤镜叠画中画 |
| G37 | Android 手机屏幕 | （mac 无） | **已落地** scrcpy 优先 / adb screenrecord 回退 |
| G38 | iPhone 有线屏幕 | Continuity / CMIO screen devices | **终态 / 明示不可达**：Linux 无 Continuity Camera；UVC 出现时走摄像头；idevice 仅枚举提示。不作为开项。 |
| G39 | 录制倒计时 | Soft Silver countdown orb | **已落地** Off/3s/5s + 大号 orb |
| G40 | 录制丢弃 / 停录决策 | discard + save&edit sheet | **已落地** live 丢弃 API + 停录决策岛 |
| G41 | 标记列表面板 | Marker list seek/rename/delete | **已落地** 时间线 chip + 面板 |
| G42 | 运镜焦点虚化 | FocusEffect radial | **已落地** 预览 radial + 导出 soft disc blur/dim |
| G43 | 贴纸完整 inspector | animation/exit/backdrop/边框阴影/层级 | **已落地** border/色/阴影/backdrop/层级/入退场；导出 border+层级 |
| G44 | 开场序列编排 | 元素 include / order / stagger | **已落地** stagger + include + 元素顺序上下移；预览跟顺序错峰 |
| G45 | 片段级音频覆写 | 选中 clip 的 system/mic 音量与静音 | **已落地** `clip-audio` API + 声音检查器覆写 |
| G46 | 导出音频-only / 选区 | ExportOutputKind + timeline range | **已落地** sheet kind/scope；选区 trim；audio → m4a |
| G47 | 时间线多选 | ⇧/⌘ 选多个 primary clip | **已落地** ⇧ 范围 / ⌘ 加选 + 批量删 + 选区导出 |
| G48 | Q/W ripple trim + 效果剪贴板 | 修剪快捷键 / 属性粘贴 | **已落地** Q/W trim；⌘C / ⌘⇧V 效果属性 |
| G49 | 录制暂停 / 继续 | pause + resume | **已落地** SIGSTOP/CONT + live capsule 暂停钮 |
| G50 | 马赛克 inspector 补齐 | style / dimming / 几何 | **已落地** 柔化/突出 + 暗度/圆角/宽高；预览 spotlight |
| G51 | 摄像头 PiP inspector 补齐 | border / opacity / roundness / shadow | **已落地** 圆角/描边/色/透明/阴影旋钮 |
| G52 | 场景 / 样式预设 | 保存/套用 canvas+opening 包 | **已落地** 全局 style-presets store；保存/套用/默认/删除；含 canvas+opening+cursor+audio+camera 外观 |

## P2+ 与原生毕业路径

| 需求（Apple） | 更优 Linux 栈 | 说明 |
|---|---|---|
| Soft Silver + 真 spring morph | **Qt 6 QML + Vulkan RHI**（parity 推荐） | 见 `linux/native/qt6`：PreviewSurface / RecorderIsland / ContinuousSdf / IslandAnchor |
| 快速复用现有 Soft Silver CSS | **Tauri 2 + wgpu** | 留 web chrome，换预览表面 |
| Ubuntu Wayland 采集 | **xdg-desktop-portal + PipeWire**（已有）/ GTK4+GStreamer | 门户契合度最高 |
| 指针轨迹 | **libinput-evdev / X11**（已有）+ 未来 portal RD | 见 `linux/dogsc/pointer.py` |

**结论：** Web Soft Silver 已收齐可复刻块（**G09–G52**，**G38 明示不可达终态**）。P0 Qt6 路径已落地：**G01** QSGPlainTexture/QRhi + `presentNativeTexture` 零拷贝导入、**G02** ffmpeg 解码→纹理、**G03** frameless 岛 + layer-shell/screen 锚定、**G04** continuous SDF、**G06** libinput 指针流。后续增强（生产 DMA-BUF 导出器、portal RD 指针注入、常驻解码器缓存）不阻断 parity 收口。

## Oil Pro 视觉复拍（本轮）

| 画面 | 路径 |
|---|---|
| 首页（录制岛 hero） | `.oil-ui/soft-silver-gap/hero-home/` |
| 编辑器（docked chrome） | `.oil-ui/soft-silver-gap/hero-editor/` |
| 开场顺序 / 导出选区 / QW | `.oil-ui/apple-parity-polish/{opening-order,export-scope,shortcuts-qw}/` |
