# Qt6 Soft Silver host (optimal path)

P0 graduation path for DogSC on Linux: **Qt 6 QML + Vulkan RHI**.

| ID | Gap | Status here |
|---|---|---|
| **G01** | GPU preview | `PreviewSurfaceItem` QSG texture; RHI backend reflected (`vulkan` preferred) |
| **G02** | Native decode→texture / scrub | `FrameCache` LRU + `HostBridge` sidecar thumbs + `presentMediaFrame` |
| **G03** | Floating recorder island | `RecorderIsland.qml` + `IslandAnchor` (`layer-shell` / `screen`) |
| **G04** | Continuous corners | `ContinuousPanel` + SDF `ContinuousSdfPanel` (qsb) |

## Layout

| File | Role |
|---|---|
| `main.cpp` / `CMakeLists.txt` | Host bootstrap; DogSC types; Vulkan RHI preference; shader bake; layer-shell protocols |
| `main.qml` | Soft Silver editor shell |
| `PreviewSurfaceItem.*` | QSG preview plane + ffmpeg decode→texture |
| `ContinuousCorner.*` / `ContinuousSdfPanel.qml` | Continuous path + GPU SDF fill |
| `IslandAnchor.*` / `RecorderIsland.qml` | Frameless island + Wayland layer-shell / screen anchor |
| `FrameCache.*` | Resident decode LRU for playhead scrub |
| `HostBridge.*` | HTTP client for Python sidecar (`:47321`) projects + thumbs |
| `shaders/continuous_corner.*` | SDF vertex/fragment sources |
| `protocols/wlr-layer-shell-unstable-v1.xml` | Vendored layer-shell protocol |

Tokens: bg `#ecedef`, panel `#fdfdfe`, platinum `#1f1f1f`. Springs: settle ~380ms
OutCubic, morph ~500ms. No purple chrome.

## Build

```bash
sudo apt-get install -y \
  qt6-base-dev qt6-declarative-dev qt6-shader-baker qt6-shadertools-dev \
  libstdc++-14-dev libwayland-dev \
  qml6-module-qtquick qml6-module-qtquick-controls \
  qml6-module-qtquick-templates qml6-module-qtquick-layouts \
  qml6-module-qtquick-window qml6-module-qtqml \
  qml6-module-qtqml-workerscript qml6-module-qtqml-models

./linux/native/qt6/smoke_build.sh
```

## Pointer stream (G06)

Python capture uses `dogsc.pointer.make_pointer_sampler` — libinput-evdev when
`/dev/input/event*` is readable, otherwise X11 `PointerSampler`.
