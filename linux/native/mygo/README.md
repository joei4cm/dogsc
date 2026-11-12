# MyGo Soft Silver host — 怎么用 mygo 重建 UI

对照仓库：[`egoist/mygo`](https://github.com/egoist/mygo)（本机可看 `joei4cm/mygo` fork）。  
目标：把 DogSC Linux Soft Silver 的**壳层**从 Web/CSS（或 Qt6 QML）迁到 MyGo **native UI**，录制仍走 Python sidecar。

## MyGo 怎么「重建」一帧 UI

```
view (Go, 读 app state)
  → ui: 每帧 build / layout / paint
  → internal/scene（显示列表；圆角可标 Continuous）
  → gpu: Metal | D3D11 | OpenGL（Linux）或 CPU raster
```

要点（见 mygo `docs/architecture.md` · Native UI）：

1. **View = 状态的函数**  
   `Content: ui.View(app.view)`。输入、状态变更、动画未 settle 时，主线程再调一次 view。  
   一帧内最多再 build 几次，好让点击的结果出现在同帧画面上。

2. **不要把 Element 存进 app state**  
   `Element` 只活在一次 build；跨帧身份用 `ui.Handle`，后台回写用 `Window.Update` / `Invalidate`。

3. **Spring 即 Soft Silver morph**  
   `AnimateTo(key, target, ui.Animation{Spring: …})` —— 参数是 SwiftUI 式 `Duration` + `Bounce`。  
   Soft Silver 岛：`Duration: 500ms`, `Bounce: 0.18` ≈ Apple `response 0.5 / dampingFraction 0.82`。

4. **两套窗口可以混用**  
   - Native UI：录制岛、设置岛、检查器（立刻开窗、无 webview）  
   - 系统 webview：复杂文档页（可选）  
   录制岛用 `Frameless` + `AlwaysOnTop`（或 `NewFlyout`）对标 Apple NSPanel。

5. **材料**  
   Soft Silver 是**不透明铂金岛**（`#fdfdfe` + 分层阴影），不是 Liquid Glass。  
   `plugins/glass` 可做实验材质，默认壳不要用。

## 与现有路径的映射

| Soft Silver / Gap | Web | Qt6 | MyGo（本目录） |
|---|---|---|---|
| 岛 morph spring G03 | JS settle | QML spring | `morphSpring` + frameless window |
| Continuous 圆角 G04 | CSS 圆角 | SDF `ContinuousSdfPanel` | mygo `Op.Continuous` **目前仅 darwin**（`continuousCorners = GOOS=="darwin"`） |
| GPU 预览 G01 | `<video>` | `PreviewSurfaceItem` | 下一步：`ui/video`（Linux GStreamer） |
| Scrub G02 | Full ε | FrameCache/DecodePool | sidecar thumbs → bitmap / video seek |
| 指针 G06 | — | — | 仍在 Python `dogsc.pointer` |
| Platinum tokens | `app.css` | QML | `theme.go` |

**结论：** MyGo 是「用 Go 每帧重建 Soft Silver 壳」的正确模型；G04 在 Linux 上还需给 mygo GL 打开 continuous（或继续用 Qt6 SDF）。Qt6 宿主不废：预览零拷贝 / layer-shell 仍可并存，MyGo 先吃交互壳与 morph。

## 本脚手架

| 文件 | 作用 |
|---|---|
| `main.go` | 编辑器窗 + 浮动录制岛 |
| `theme.go` | Soft Silver token + morph/settle spring |
| `island.go` | 录制岛 idle/armed/live/paused morph |
| `shell.go` | 编辑器舞台 + 项目条 |
| `sidecar.go` | HTTP → `:47321`（同 Qt6 `HostBridge`） |

```bash
# 需要 Go ≥ 1.27.3（mygo 要求）
./linux/native/mygo/smoke_build.sh

# 有显示会话时：
dogsc edit --port 47321 &          # 或现有 Soft Silver sidecar
go run ./linux/native/mygo -sidecar http://127.0.0.1:47321
```

## 本轮进度（soft-silver-next）

| 项 | 状态 |
|---|---|
| **G04** Linux continuous | **已用 `continuousCornerPath`（与 Qt6 ContinuousCorner 同公式）画岛/卡片**；仍可再 patch mygo `Op.Continuous` |
| **G03** 岛锚点 | frameless + `AlwaysOnTop` + 主屏 work area **底部居中**，随 morph `SetBounds` |
| **G01/G02** 预览 / scrub | 打开项目 → `media_path` 试 `ui/video.Open`；失败则 `/thumb?t=`；Slider scrub |
| Sidecar | `Project` / `Thumb` / `MediaURL` |

## 下一步

1. 检查器 / 时间线：按 view 拆包，同一套 token + spring。  
2. 录制岛 `NewFlyout` / layer-shell 级置顶（合成器相关）。  
3. upstream mygo：Linux 打开 `continuousCorners`。
