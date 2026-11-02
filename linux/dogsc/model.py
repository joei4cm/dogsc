"""Shared product model defaults that mirror the portable macOS project surface."""

from __future__ import annotations

from dogsc.zoom import new_id

SCHEMA = 2

ASPECTS = (
    "source",
    "16:9",
    "4:3",
    "1:1",
    "9:16",
    "3:4",
    "2.39:1",
    "1:2.39",
)

RESOLUTIONS = ("source", "1080p", "1440p", "4k")
EASINGS = ("linear", "quadratic", "cubic", "quintic", "spring")
FRAME_STYLES = ("none", "windowLight", "windowDark", "browserLight", "browserDark", "devicePhone")
BACKGROUND_KINDS = ("solid", "pattern", "dynamic", "image")
PATTERN_PRESETS = (
    "obsidianGrid",
    "engineeringWhiteGrid",
    "midnightDots",
    "architecturalDots",
    "isometricMesh",
)
DYNAMIC_PRESETS = ("cyberDriftGrid", "starfieldDots", "auroraFluid")
CURSOR_ASSETS = (
    "system.arrow",
    "system.pointing-hand",
    "system.crosshair",
    "system.ibeam",
    "system.touch-dot",
    "system.hidden",
)
CLICK_EFFECTS = ("ripple", "glow", "pulse", "burst", "none")
CURSOR_MOTION = ("smooth", "medium", "rapid", "none")
OPENING_PRESETS = ("converge", "sideSlide", "light3D")
OPENING_CURVES = ("smooth", "swift", "gentle")
MOSAIC_STYLES = ("blur", "spotlight")
CAMERA_SHAPES = ("square", "horizontal", "vertical", "original", "circle")


def blank_crop() -> dict:
    """Normalized source crop — mirrors RecorderCore.NormalizedCrop."""
    return {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}


def clamp_crop(crop: dict | None, minimum: float = 0.02) -> dict:
    value = {**blank_crop(), **(crop or {})}
    floor = min(max(float(minimum), 0.001), 1.0)
    x = min(max(float(value.get("x") or 0), 0.0), 1.0 - floor)
    y = min(max(float(value.get("y") or 0), 0.0), 1.0 - floor)
    width = min(max(float(value.get("width") or 1), floor), 1.0 - x)
    height = min(max(float(value.get("height") or 1), floor), 1.0 - y)
    return {"x": x, "y": y, "width": width, "height": height}


def blank_canvas() -> dict:
    return {
        "aspect": "16:9",
        "padding": 0.06,
        "radius": 28,
        "shadow": 0.35,
        "border": 0,
        "border_color": "#ffffff",
        "border_opacity": 0.18,
        "background_kind": "solid",
        "background": "#16161a",
        "background_image": None,
        "pattern": "obsidianGrid",
        "pattern_scale": 1.0,
        "pattern_opacity": 1.0,
        "dynamic": "auroraFluid",
        "background_blur": 0,
        "content_scale": 1.0,
        "content_x": 0.5,
        "content_y": 0.5,
        "crop": blank_crop(),
        "screen_frame": "none",
        "frame_scale": 1.0,
        "toolbar_scale": 1.0,
        "frame_title": "DogSC",
        "frame_address": "dogsc.app",
    }


def blank_cursor() -> dict:
    return {
        "asset": "system.arrow",
        "size": 1.0,
        "hide_when_idle": False,
        "idle_delay": 1.2,
        "click_effect": "ripple",
        "click_opacity": 0.7,
        "click_scale": 1.0,
        "motion": "smooth",
        "tilt": 3.0,
        "time_offset": 0.0,
    }


def blank_audio() -> dict:
    return {
        "system_volume": 1.0,
        "system_muted": False,
        "mic_volume": 1.0,
        "mic_muted": False,
    }


def blank_camera() -> dict:
    return {
        "enabled": False,
        "device": None,
        "shape": "circle",
        "x": 0.82,
        "y": 0.78,
        "size": 0.22,
        "roundness": 1.0,
        "border": 3,
        "border_color": "#ffffff",
        "shadow": 0.35,
        "mirror": True,
        "opacity": 1.0,
        "media": None,
    }


def blank_opening() -> dict:
    return {
        "enabled": False,
        "preset": "converge",
        "curve": "smooth",
        "duration": 1.4,
        "stagger": 0.12,
        "include_screen": True,
        "include_camera": True,
        "include_stickers": True,
    }


def blank_clip(src_in: float, src_out: float) -> dict:
    return {
        "id": new_id(),
        "src_in": float(src_in),
        "src_out": float(src_out),
        "speed": 1.0,
        "audio": {"system_volume": 1.0, "system_muted": False, "mic_volume": 1.0, "mic_muted": False},
    }


def blank_screen_motion(start: float, end: float) -> dict:
    return {
        "id": new_id(),
        "clip_id": None,
        "start": float(start),
        "end": float(end),
        "enter": 0.5,
        "exit": 0.5,
        "easing": "cubic",
        "position_x": 0.5,
        "position_y": 0.5,
        "scale": 1.0,
        "rotation_x": 12.0,
        "rotation_y": -10.0,
        "rotation_z": 0.0,
        "perspective": 0.65,
    }


def blank_mosaic(start: float, end: float) -> dict:
    return {
        "id": new_id(),
        "clip_id": None,
        "start": float(start),
        "end": float(end),
        "x": 0.35,
        "y": 0.35,
        "width": 0.3,
        "height": 0.25,
        "corner_radius": 0.08,
        "style": "blur",
        "intensity": 0.55,
        "dimming": 0.22,
    }


def blank_sticker(start: float, end: float, relative_path: str) -> dict:
    return {
        "id": new_id(),
        "clip_id": None,
        "start": float(start),
        "end": float(end),
        "path": relative_path,
        "x": 0.72,
        "y": 0.18,
        "width": 0.22,
        "rotation": 0.0,
        "opacity": 1.0,
        "corner_radius": 18,
        "animation": "pop",
    }


def migrate(project: dict) -> dict:
    """Lift schema 1 Linux projects into the richer schema 2 surface."""
    project = dict(project)
    project["schema"] = SCHEMA
    canvas = blank_canvas()
    canvas.update(project.get("canvas") or {})
    if "background_kind" not in canvas:
        canvas["background_kind"] = "solid"
    canvas["crop"] = clamp_crop(canvas.get("crop"))
    project["canvas"] = canvas
    project["cursor"] = {**blank_cursor(), **(project.get("cursor") or {})}
    if project.get("draw_cursor") is False:
        project["cursor"]["asset"] = "system.hidden"
    project["audio"] = {**blank_audio(), **(project.get("audio") or {})}
    project["camera"] = {**blank_camera(), **(project.get("camera") or {})}
    project["opening"] = {**blank_opening(), **(project.get("opening") or {})}
    project.setdefault("screen_motions", [])
    project.setdefault("mosaics", [])
    project.setdefault("stickers", [])
    project.setdefault("history", [])
    project.setdefault("history_index", -1)
    project.setdefault("deleted_clips", [])
    clips = []
    for clip in project.get("clips") or []:
        row = dict(clip)
        row.setdefault("audio", blank_clip(0, 1)["audio"])
        clips.append(row)
    project["clips"] = clips
    export = {"resolution": "1080p", "fps": 30}
    export.update(project.get("export") or {})
    project["export"] = export
    project.setdefault("draw_cursor", True)
    return project
