# Qt6 Soft Silver host (optimal path)

P0 graduation path for DogSC on Linux: **Qt 6 QML + Vulkan RHI**.

This tree is the recommended native host for Soft Silver chrome parity with Apple
(`Sources/DogSCApp`). It targets the gaps that the web bridge cannot close:

| ID | Gap | Role here |
|---|---|---|
| **G01** | GPU preview (CIImage→CAMetalLayer) | `PreviewSurface.qml` → Vulkan `QQuickItem` |
| **G03** | Floating recorder island (NSPanel + morph) | Capsule in `main.qml`; later frameless / layer-shell |
| **G04** | Continuous corner curve | Large radii + future SDF squircle |

## Relationship to other stacks

- **`linux/dogsc/web/*`** — interim Soft Silver chrome (CSS/JS). Keep shipping P1
  pixel/UX there; do not treat the web `<video>` stage as the preview source of truth.
- **Python ffmpeg sidecar** — stays for capture and export (portal / PipeWire in,
  encode out). The Qt host owns chrome + GPU preview; it does not replace the
  sidecar for media I/O.

## Layout of this skeleton

- `main.cpp` / `CMakeLists.txt` — Qt Quick host bootstrap
- `main.qml` — Soft Silver shell stubs: stage dots, inspector rail (340–480),
  timeline lanes (画面 / 运镜 / 马赛克), crop toolbar + overlay handles,
  export sheet island, recorder capsule
- `PreviewSurface.qml` — placeholder where the Vulkan QQuickItem plugs in

Tokens: bg `#ecedef`, panel `#fdfdfe`, platinum `#1f1f1f`. Springs: settle ~380ms
OutCubic, morph ~500ms. No purple chrome.

## Build (when Qt6 is available)

```bash
cmake -S . -B build -DCMAKE_PREFIX_PATH=/path/to/Qt6
cmake --build build
```
