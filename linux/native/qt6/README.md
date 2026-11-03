# Qt6 Soft Silver host (optimal path)

P0 graduation path for DogSC on Linux: **Qt 6 QML + Vulkan RHI**.

This tree is the recommended native host for Soft Silver chrome parity with Apple
(`Sources/DogSCApp`). It targets the gaps that the web bridge cannot close:

| ID | Gap | Role here |
|---|---|---|
| **G01** | GPU preview (CIImage→CAMetalLayer) | `PreviewSurfaceItem` → `QSGSimpleTextureNode`; seam for `QRhiTexture` / Vulkan |
| **G03** | Floating recorder island (NSPanel + morph) | `RecorderIsland.qml` frameless `Tool` window + idle↔live morph |
| **G04** | Continuous corner curve | `ContinuousCorner` / `ContinuousPanel` (smoothness 0.6 ≈ Apple continuous) |

## Layout

| File | Role |
|---|---|
| `main.cpp` / `CMakeLists.txt` | Qt Quick host; registers `DogSC` types; prefers `QSG_RHI_BACKEND=vulkan` |
| `main.qml` | Soft Silver editor shell (stage dots, inspector, timeline, crop, export) |
| `PreviewSurfaceItem.{h,cpp}` | C++ preview plane — empty-stage QSG texture + `presentFrame()` |
| `PreviewSurface.qml` | QML wrapper around `DogSC.PreviewSurface` |
| `ContinuousCorner.{h,cpp}` | Continuous path + A8 mask + `ContinuousPanel` painted item |
| `RecorderIsland.qml` | Frameless always-on-top recorder capsule (NSPanel stand-in) |

Tokens: bg `#ecedef`, panel `#fdfdfe`, platinum `#1f1f1f`. Springs: settle ~380ms
OutCubic, morph ~500ms. No purple chrome.

## Relationship to other stacks

- **`linux/dogsc/web/*`** — interim Soft Silver chrome (CSS/JS). Keep shipping P1
  pixel/UX there; do not treat the web `<video>` stage as the preview source of truth.
- **Python ffmpeg sidecar** — stays for capture and export (portal / PipeWire in,
  encode out). The Qt host owns chrome + GPU preview; it does not replace the
  sidecar for media I/O.

## Build

Ubuntu 24.04 packages:

```bash
sudo apt-get install -y \
  qt6-base-dev qt6-declarative-dev libstdc++-14-dev \
  qml6-module-qtquick qml6-module-qtquick-controls \
  qml6-module-qtquick-templates qml6-module-qtquick-layouts \
  qml6-module-qtquick-window qml6-module-qtqml \
  qml6-module-qtqml-workerscript qml6-module-qtqml-models
```

```bash
cmake -S linux/native/qt6 -B linux/native/qt6/build -DCMAKE_BUILD_TYPE=Release
cmake --build linux/native/qt6/build -j
./linux/native/qt6/build/dogsc_soft_silver_host
```

Headless smoke (software RHI + offscreen QPA):

```bash
./linux/native/qt6/smoke_build.sh
```

## Status (this slice)

- **G01** — C++ `PreviewSurfaceItem` landed; CPU `presentFrame` + empty-stage QSG
  texture. Zero-copy Vulkan import still open.
- **G03** — Frameless floating `RecorderIsland` window with morph; Wayland
  layer-shell anchoring still open.
- **G04** — Continuous cubic path + `ContinuousPanel` chrome; SDF shader mask
  still open.
