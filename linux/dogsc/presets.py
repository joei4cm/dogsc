from __future__ import annotations

from pathlib import Path
import json

from dogsc.errors import DogSCError
from dogsc.model import (
    blank_audio,
    blank_camera,
    blank_canvas,
    blank_cursor,
    blank_opening,
    clamp_crop,
    migrate,
    normalize_opening_order,
)
from dogsc.project import home_dir
from dogsc.zoom import new_id


STORE_NAME = "style-presets.json"


def presets_path() -> Path:
    return home_dir() / STORE_NAME


def load_store() -> dict:
    path = presets_path()
    if not path.is_file():
        return {"presets": [], "default_id": None}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise DogSCError("场景预设文件损坏。") from error
    if not isinstance(data, dict):
        return {"presets": [], "default_id": None}
    presets = []
    for item in data.get("presets") or []:
        if isinstance(item, dict) and item.get("id") and item.get("name"):
            presets.append(_normalize_preset(item))
    default_id = data.get("default_id")
    if default_id and not any(item["id"] == default_id for item in presets):
        default_id = None
    return {"presets": presets, "default_id": default_id}


def save_store(store: dict) -> dict:
    path = presets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "presets": [_normalize_preset(item) for item in (store.get("presets") or [])],
        "default_id": store.get("default_id"),
    }
    if payload["default_id"] and not any(item["id"] == payload["default_id"] for item in payload["presets"]):
        payload["default_id"] = None
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)
    return payload


def list_presets() -> dict:
    return load_store()


def snapshot_from_project(project: dict, name: str, preset_id: str | None = None) -> dict:
    cleaned = str(name or "").strip()
    if not cleaned:
        raise DogSCError("预设名不能为空。")
    project = migrate(project)
    camera = dict(project.get("camera") or blank_camera())
    camera.pop("media", None)
    return _normalize_preset({
        "id": preset_id or new_id(),
        "name": cleaned[:40],
        "format_version": 2,
        "includes_background": True,
        "includes_crop": True,
        "canvas": dict(project.get("canvas") or blank_canvas()),
        "opening": dict(project.get("opening") or blank_opening()),
        "cursor": dict(project.get("cursor") or blank_cursor()),
        "audio": dict(project.get("audio") or blank_audio()),
        "camera": camera,
    })


def upsert_preset(preset: dict) -> dict:
    store = load_store()
    preset = _normalize_preset(preset)
    presets = list(store["presets"])
    for index, item in enumerate(presets):
        if item["id"] == preset["id"]:
            presets[index] = preset
            break
    else:
        if any(item["name"].casefold() == preset["name"].casefold() for item in presets):
            raise DogSCError("已有同名场景预设。")
        presets.append(preset)
    store["presets"] = presets
    return save_store(store)


def delete_preset(preset_id: str) -> dict:
    store = load_store()
    before = len(store["presets"])
    store["presets"] = [item for item in store["presets"] if item["id"] != preset_id]
    if len(store["presets"]) == before:
        raise DogSCError("找不到这个场景预设。")
    if store.get("default_id") == preset_id:
        store["default_id"] = None
    return save_store(store)


def set_default_preset(preset_id: str | None) -> dict:
    store = load_store()
    if preset_id:
        if not any(item["id"] == preset_id for item in store["presets"]):
            raise DogSCError("找不到这个场景预设。")
        store["default_id"] = preset_id
    else:
        store["default_id"] = None
    return save_store(store)


def get_preset(preset_id: str) -> dict:
    store = load_store()
    for item in store["presets"]:
        if item["id"] == preset_id:
            return item
    raise DogSCError("找不到这个场景预设。")


def apply_preset_to_project(project: dict, preset: dict) -> dict:
    """Mutate project presentation to match a scene preset (Apple style package)."""
    project = migrate(project)
    preset = _normalize_preset(preset)
    canvas = dict(blank_canvas())
    canvas.update(dict(preset.get("canvas") or {}))
    canvas["crop"] = clamp_crop(canvas.get("crop"))
    if not preset.get("includes_crop", True):
        canvas["crop"] = clamp_crop((project.get("canvas") or {}).get("crop"))
    if not preset.get("includes_background", True):
        current = project.get("canvas") or {}
        for key in (
            "background_kind", "background", "background_image", "pattern",
            "pattern_scale", "pattern_opacity", "dynamic", "background_blur",
        ):
            if key in current:
                canvas[key] = current[key]
    project["canvas"] = canvas

    opening = dict(blank_opening())
    opening.update(dict(preset.get("opening") or {}))
    opening["element_order"] = normalize_opening_order(opening.get("element_order"))
    project["opening"] = opening

    cursor = dict(blank_cursor())
    cursor.update(dict(preset.get("cursor") or {}))
    project["cursor"] = cursor
    project["draw_cursor"] = cursor.get("asset") != "system.hidden"

    audio = dict(blank_audio())
    audio.update(dict(preset.get("audio") or {}))
    project["audio"] = audio

    camera = dict(blank_camera())
    camera.update(dict(preset.get("camera") or {}))
    # Keep the project's recorded camera track; only apply presentation knobs.
    existing = project.get("camera") or {}
    if existing.get("media"):
        camera["media"] = existing["media"]
    if not preset.get("includes_crop", True) and "enabled" in existing:
        camera["enabled"] = existing["enabled"]
    project["camera"] = camera
    return migrate(project)


def _normalize_preset(raw: dict) -> dict:
    canvas = dict(blank_canvas())
    canvas.update(dict(raw.get("canvas") or {}))
    canvas["crop"] = clamp_crop(canvas.get("crop"))
    opening = dict(blank_opening())
    opening.update(dict(raw.get("opening") or {}))
    opening["element_order"] = normalize_opening_order(opening.get("element_order"))
    cursor = dict(blank_cursor())
    cursor.update(dict(raw.get("cursor") or {}))
    audio = dict(blank_audio())
    audio.update(dict(raw.get("audio") or {}))
    camera = dict(blank_camera())
    camera.update(dict(raw.get("camera") or {}))
    camera.pop("media", None)
    preset_id = str(raw.get("id") or new_id())
    name = str(raw.get("name") or "").strip() or "场景"
    return {
        "id": preset_id,
        "name": name[:40],
        "format_version": int(raw.get("format_version") or 2),
        "includes_background": bool(raw.get("includes_background", True)),
        "includes_crop": bool(raw.get("includes_crop", True)),
        "canvas": canvas,
        "opening": opening,
        "cursor": cursor,
        "audio": audio,
        "camera": camera,
    }
