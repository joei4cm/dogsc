from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import shutil
import uuid

from dogsc.errors import DogSCError
from dogsc.media import probe, thumbs
from dogsc.zoom import new_id


def home_dir() -> Path:
    import os
    override = os.environ.get("DOGSC_HOME")
    root = Path(override) if override else Path.home() / ".local" / "share" / "dogsc"
    root.mkdir(parents=True, exist_ok=True)
    return root


def projects_dir() -> Path:
    path = home_dir() / "projects"
    path.mkdir(parents=True, exist_ok=True)
    return path


def blank_canvas() -> dict:
    return {
        "aspect": "16:9",
        "padding": 0.06,
        "radius": 28,
        "shadow": 0.35,
        "background": "#16161a",
    }


def new_project(name: str, media: dict, capture: dict | None = None) -> dict:
    clip_id = new_id()
    return {
        "schema": 1,
        "id": uuid.uuid4().hex,
        "name": name,
        "created": datetime.now().astimezone().isoformat(timespec="seconds"),
        "media": media,
        "clips": [{
            "id": clip_id,
            "src_in": 0,
            "src_out": float(media["duration"]),
            "speed": 1,
        }],
        "zooms": [],
        "markers": [],
        "canvas": blank_canvas(),
        "export": {"resolution": "1080p", "fps": 30 if float(media.get("fps") or 30) < 45 else 60},
        "capture": capture or {"backend": "import", "cursor_baked": True, "geometry": None},
        "draw_cursor": not bool((capture or {}).get("cursor_baked", True)),
    }


def project_dir(project_id: str) -> Path:
    if len(project_id) != 32 or any(char not in "0123456789abcdef" for char in project_id):
        raise DogSCError("项目编号不正确。")
    return projects_dir() / project_id


def load(project_id: str) -> dict:
    path = project_dir(project_id) / "project.json"
    if not path.exists():
        raise DogSCError("找不到这个项目。")
    return json.loads(path.read_text(encoding="utf-8"))


def save(project: dict) -> None:
    directory = project_dir(project["id"])
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "project.json"
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)


def list_projects() -> list[dict]:
    found = []
    for directory in sorted(projects_dir().iterdir(), key=lambda item: item.stat().st_mtime, reverse=True):
        path = directory / "project.json"
        if not path.exists():
            continue
        try:
            project = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        found.append({
            "id": project.get("id"),
            "name": project.get("name"),
            "created": project.get("created"),
            "duration": project.get("media", {}).get("duration"),
            "width": project.get("media", {}).get("width"),
            "height": project.get("media", {}).get("height"),
        })
    return found


def delete(project_id: str) -> None:
    directory = project_dir(project_id)
    if directory.exists():
        shutil.rmtree(directory)


def import_media(source: Path, name: str | None = None) -> dict:
    if not source.is_file():
        raise DogSCError("找不到要导入的视频。")
    info = probe(source)
    if info["width"] < 2 or info["height"] < 2 or info["duration"] <= 0:
        raise DogSCError("这个视频没有可用的画面时长。")
    project = new_project(name or source.stem, info, {"backend": "import", "cursor_baked": True, "geometry": None})
    directory = project_dir(project["id"])
    directory.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, directory / "media.mp4")
    (directory / "pointer.json").write_text(json.dumps({"events": []}, ensure_ascii=False), encoding="utf-8")
    thumbs(directory / "media.mp4", directory / "thumbs")
    save(project)
    return project


def load_pointer(project_id: str) -> list[dict]:
    path = project_dir(project_id) / "pointer.json"
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return list(payload.get("events") or [])


def media_path(project_id: str) -> Path:
    path = project_dir(project_id) / "media.mp4"
    if not path.exists():
        raise DogSCError("项目里还没有视频。")
    return path
