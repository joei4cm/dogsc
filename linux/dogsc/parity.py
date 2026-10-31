"""Linux stack choices that can track Apple Soft Silver UX / motion / perf.

Apple DogSC is not a web app: Soft Silver chrome is SwiftUI continuous
capsules + SpringMotion, preview is Metal+Core Image on a CAMetalLayer paced
by CADisplayLink, capture is ScreenCaptureKit with a separate Core Audio tap.
A browser-only shell can match tokens and layout, but not the full motion and
GPU preview contract. This module records the Linux replacements that can.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StackChoice:
    id: str
    title: str
    ux: str
    motion: str
    preview: str
    capture: str
    score: int
    verdict: str
    notes: str


# Ranked for Soft Silver island morphing + 60 fps GPU preview + Linux capture.
CHOICES: tuple[StackChoice, ...] = (
    StackChoice(
        id="qt6-qml-vulkan",
        title="Qt 6 Quick / QML + RHI (Vulkan)",
        ux="QML continuous capsules, Soft Silver tokens, native window chrome",
        motion="Qt Quick springs can mirror SpringMotion response/damping; shared scene graph",
        preview="QVideoSink / custom QQuickItem + Vulkan/OpenGL compositor ≈ Metal+CIImage",
        capture="PipeWire portal / ffmpeg / wf-recorder behind a C++ or Python service",
        score=95,
        verdict="recommended",
        notes="Same path Kdenlive took for Linux Vulkan performance. Best long-term parity.",
    ),
    StackChoice(
        id="tauri-wgpu",
        title="Tauri 2 + Soft Silver WebView + wgpu preview surface",
        ux="Reuse Soft Silver web chrome; native titlebar / tray",
        motion="Web springs for chrome; native island host can own morph springs",
        preview="Separate wgpu/Vulkan surface for zoom/frame composite (avoid CSS video path)",
        capture="Keep current Python/ffmpeg backends as a sidecar",
        score=82,
        verdict="strong",
        notes="Fastest reuse of the Soft Silver web work while escaping browser media limits.",
    ),
    StackChoice(
        id="flutter-impeller",
        title="Flutter desktop + Impeller + FFI ffmpeg",
        ux="Custom Soft Silver painter; no stock macOS look",
        motion="Impeller springs are strong; matched-geometry needs hand-rolled thumbs",
        preview="Texture import from ffmpeg/VA-API via FFI; more glue than Qt Multimedia",
        capture="FFI to existing recorder backends",
        score=70,
        verdict="viable",
        notes="Good motion budget, heavier custom video pipeline than Qt.",
    ),
    StackChoice(
        id="gtk4-gstreamer",
        title="GTK 4 / libadwaita + GStreamer GL",
        ux="Native Ubuntu/GNOME; Soft Silver must be painted over Adwaita",
        motion="Adwaita animations are softer; island morph weaker than Qt Quick springs",
        preview="GstGL / gtk4paintablesink can be fast on Wayland",
        capture="Natural fit for xdg-desktop-portal + PipeWire",
        score=62,
        verdict="partial",
        notes="Strong on Ubuntu Wayland capture; weaker Soft Silver morph fidelity.",
    ),
    StackChoice(
        id="slint-ffmpeg",
        title="Slint + FFmpeg/libplacebo",
        ux="Declarative GPU UI; Soft Silver doable",
        motion="Reactive property springs are good for chrome",
        preview="Official video path still immature; custom FFmpeg/libplacebo required",
        capture="External service",
        score=55,
        verdict="early",
        notes="Attractive chrome toolkit; not ready as a video-editor host alone.",
    ),
    StackChoice(
        id="web-soft-silver",
        title="Current Soft Silver web shell + Python backends",
        ux="Tokens and layout can match; not a native NSPanel island",
        motion="JS spring integrator can mirror SpringMotion constants for chrome",
        preview="HTML video + CSS/WebGL; coalesced seeks help, still not Metal drawable",
        capture="Already: x11grab / wf-recorder / portal",
        score=48,
        verdict="bridge",
        notes="Ship Soft Silver now; graduate preview/chrome into Qt or Tauri+wgpu.",
    ),
)


APPLE_CONTRACT = {
    "chrome": "Opaque Soft Silver slabs, continuous capsules, platinum selection, sparse .regularMaterial over media only",
    "motion": "SpringMotion critically damped springs; RecorderMotion morph 0.5/0.82; matchedGeometry tab thumbs; reduce-motion",
    "preview": "CIImage → Metal drawable, displaySyncEnabled=false, CADisplayLink pacing, full/low preview modes, coalesced seeks",
    "capture": "ScreenCaptureKit ≤60fps, separate Core Audio system tap, mic AVCaptureSession, CGEvent pointer stream",
}


def matrix() -> dict[str, object]:
    recommended = next(choice for choice in CHOICES if choice.verdict == "recommended")
    return {
        "apple": APPLE_CONTRACT,
        "recommended": recommended.id,
        "active": "web-soft-silver",
        "bridge": {
            "motion": "DogSCMotion springs ported from SpringMotion / RecorderMotion",
            "preview": "display-link rAF clock + coalesced HTMLVideoElement seeks",
            "next": recommended.id,
        },
        "choices": [
            {
                "id": choice.id,
                "title": choice.title,
                "ux": choice.ux,
                "motion": choice.motion,
                "preview": choice.preview,
                "capture": choice.capture,
                "score": choice.score,
                "verdict": choice.verdict,
                "notes": choice.notes,
            }
            for choice in CHOICES
        ],
    }
