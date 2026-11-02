from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import json
import mimetypes
import subprocess
import sys
import threading
import webbrowser

from dogsc.errors import DogSCError
from dogsc.export_plan import build_export, estimate_export
from dogsc.media import audio_peaks, probe, thumb_at
from dogsc.model import (
    ASPECTS,
    BACKGROUND_KINDS,
    CAMERA_SHAPES,
    CLICK_EFFECTS,
    CURSOR_ASSETS,
    CURSOR_MOTION,
    DYNAMIC_PRESETS,
    FRAME_STYLES,
    MOSAIC_STYLES,
    OPENING_CURVES,
    OPENING_PRESETS,
    PATTERN_PRESETS,
    RESOLUTIONS,
    blank_mosaic,
    blank_screen_motion,
    blank_sticker,
    clamp_crop,
    migrate,
)
from dogsc.wallpapers import list_wallpapers, resolve_wallpaper
from dogsc.platform import detect
from dogsc.project import (
    assets_dir,
    delete,
    import_media,
    list_projects,
    load,
    load_pointer,
    media_path,
    project_dir,
    push_history,
    redo,
    save,
    undo,
)
from dogsc.recorder import Recorder, pick_region_for
from dogsc.sources import list_hypr_monitors, list_hypr_windows, list_x11_windows, list_xrandr
from dogsc.timeline import add_manual_zoom, clip_at, delete_clip, move_clip, set_speed, split_clip, trim_clip
from dogsc.zoom import new_id, plan_auto_zooms


WEB = Path(__file__).resolve().parent / "web"
FONTS = Path(__file__).resolve().parents[2] / "Resources" / "Fonts"


class App:
    def __init__(self):
        self.recorder = Recorder()
        self.exports: dict[str, dict] = {}
        self.lock = threading.Lock()


APP = App()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        return

    def handle_error(self, request, client_address) -> None:
        error = sys.exc_info()[1]
        if isinstance(error, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path == "/api/environment":
                return self._json(detect().as_dict())
            if path == "/api/sources":
                return self._json(_sources())
            if path == "/api/projects":
                return self._json(list_projects())
            if path == "/api/record":
                return self._json(APP.recorder.status())
            if path == "/api/wallpapers":
                return self._json({"items": list_wallpapers()})
            if path.startswith("/api/wallpapers/"):
                key = path.split("/api/wallpapers/", 1)[1]
                target = resolve_wallpaper(key)
                if target is None:
                    return self._error(404, "没有这张壁纸。")
                return self._file(target, mimetypes.guess_type(target.name)[0] or "image/jpeg")
            if path.startswith("/api/projects/"):
                return self._project_get(path)
            if path == "/" or path == "":
                return self._file(WEB / "index.html", "text/html; charset=utf-8")
            if path.startswith("/fonts/"):
                target = (FONTS / path.split("/fonts/", 1)[1]).resolve()
                if FONTS.resolve() not in target.parents and target != FONTS.resolve():
                    return self._error(404, "没有这个字体。")
                if target.is_file():
                    return self._file(target, "font/otf")
                return self._error(404, "没有这个字体。")
            target = (WEB / path.lstrip("/")).resolve()
            if WEB.resolve() not in target.parents and target != WEB.resolve():
                return self._error(404, "没有这个页面。")
            if target.is_file():
                return self._file(target, mimetypes.guess_type(target.name)[0] or "application/octet-stream")
            return self._error(404, "没有这个页面。")
        except DogSCError as error:
            self._error(400, str(error))
        except Exception as error:
            self._error(500, str(error))

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path == "/api/projects/import":
                return self._import()
            if path == "/api/demo":
                return self._json(create_demo())
            if path == "/api/record/start":
                return self._json(APP.recorder.start(self._body()))
            if path == "/api/record/stop":
                return self._json(APP.recorder.stop())
            if path == "/api/record/marker":
                body = self._body()
                return self._json(APP.recorder.mark(str(body.get("label") or "")))
            if path == "/api/record/region":
                return self._json(pick_region_for(detect()))
            if path.startswith("/api/projects/"):
                return self._project_post(path)
            return self._error(404, "没有这个接口。")
        except DogSCError as error:
            self._error(400, str(error))
        except ValueError as error:
            self._error(400, str(error))
        except Exception as error:
            self._error(500, str(error))

    def do_DELETE(self) -> None:
        path = unquote(urlparse(self.path).path)
        try:
            parts = [part for part in path.split("/") if part]
            if len(parts) == 3 and parts[:2] == ["api", "projects"]:
                delete(parts[2])
                return self._json({"ok": True})
            if len(parts) == 5 and parts[:2] == ["api", "projects"]:
                project = migrate(load(parts[2]))
                push_history(project)
                key = {
                    "zooms": "zooms",
                    "screen-motions": "screen_motions",
                    "mosaics": "mosaics",
                    "stickers": "stickers",
                    "markers": "markers",
                }.get(parts[3])
                if not key:
                    return self._error(404, "没有这个接口。")
                project[key] = [item for item in project.get(key) or [] if item.get("id") != parts[4]]
                save(project)
                return self._json(project)
            return self._error(404, "没有这个接口。")
        except DogSCError as error:
            self._error(400, str(error))

    def _project_get(self, path: str) -> None:
        parts = [part for part in path.split("/") if part]
        # api/projects/:id/...
        if len(parts) < 3:
            return self._error(404, "没有这个项目。")
        project_id = parts[2]
        if len(parts) == 3:
            return self._json(migrate(load(project_id)))
        tail = "/".join(parts[3:])
        if tail == "pointer":
            return self._json({"events": load_pointer(project_id)})
        if tail == "media":
            return self._range(media_path(project_id), "video/mp4")
        if tail.startswith("thumbs/"):
            name = Path(tail.split("/", 1)[1]).name
            target = project_dir(project_id) / "thumbs" / name
            if not target.is_file():
                return self._error(404, "没有这张缩略图。")
            return self._file(target, "image/jpeg")
        if tail == "thumb":
            query = urlparse(self.path).query
            params = dict(part.split("=", 1) for part in query.split("&") if "=" in part)
            try:
                source_time = float(unquote(params.get("t", "0")))
            except ValueError:
                source_time = 0.0
            target = thumb_at(
                media_path(project_id),
                project_dir(project_id) / "thumbs" / "timed",
                source_time,
            )
            if target is None:
                return self._error(404, "没有这张缩略图。")
            return self._file(target, "image/jpeg")
        if tail == "peaks":
            peaks = audio_peaks(media_path(project_id), buckets=240)
            return self._json({"peaks": peaks})
        if tail.startswith("assets/"):
            name = Path(tail.split("/", 1)[1]).name
            target = assets_dir(project_id) / name
            if not target.is_file():
                return self._error(404, "没有这个素材。")
            return self._file(target, mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        if tail == "export/estimate":
            project = migrate(load(project_id))
            return self._json(estimate_export(project, media_path(project_id)))
        if tail == "export/status":
            return self._json(APP.exports.get(project_id) or {"state": "idle"})
        if tail == "export/file":
            job = APP.exports.get(project_id) or {}
            file_path = job.get("path")
            if job.get("state") != "done" or not file_path or not Path(file_path).is_file():
                return self._error(404, "导出文件还没准备好。")
            return self._range(Path(file_path), "video/mp4", download=f"{load(project_id)['name']}.mp4")
        return self._error(404, "没有这个接口。")

    def _project_post(self, path: str) -> None:
        parts = [part for part in path.split("/") if part]
        project_id = parts[2]
        action = parts[3] if len(parts) > 3 else ""
        project = migrate(load(project_id))
        if action == "sticker-upload":
            return self._json(self._sticker_upload(project))
        body = self._body()
        mutating = action not in {"export"}
        if mutating and action not in {"undo", "redo"}:
            push_history(project)
        if action == "meta":
            _apply_meta(project, body)
        elif action == "undo":
            project = undo(project)
        elif action == "redo":
            project = redo(project)
        elif action == "split":
            project["clips"], project["zooms"], project["markers"] = split_clip(
                project["clips"], project["zooms"], project["markers"], float(body["time"])
            )
        elif action == "delete-clip":
            clip_id = str(body["id"])
            removed = next((clip for clip in project["clips"] if clip["id"] == clip_id), None)
            if removed is not None:
                bag = {
                    "clip": removed,
                    "zooms": [zoom for zoom in project["zooms"] if zoom.get("clip_id") == clip_id],
                    "markers": [marker for marker in project["markers"] if marker.get("clip_id") == clip_id],
                    "index": next((index for index, clip in enumerate(project["clips"]) if clip["id"] == clip_id), len(project["clips"])),
                }
                deleted = list(project.get("deleted_clips") or [])
                deleted.append(bag)
                project["deleted_clips"] = deleted[-20:]
            project["clips"], project["zooms"], project["markers"] = delete_clip(
                project["clips"], project["zooms"], project["markers"], clip_id
            )
        elif action == "restore-clip":
            deleted = list(project.get("deleted_clips") or [])
            if not deleted:
                raise DogSCError("没有可恢复的剪辑。")
            bag = deleted.pop()
            project["deleted_clips"] = deleted
            clip = dict(bag.get("clip") or {})
            if not clip.get("id"):
                raise DogSCError("恢复数据损坏。")
            index = min(max(int(bag.get("index") or len(project["clips"])), 0), len(project["clips"]))
            clips = list(project["clips"])
            clips.insert(index, clip)
            project["clips"] = clips
            project["zooms"] = list(project["zooms"]) + list(bag.get("zooms") or [])
            project["markers"] = list(project["markers"]) + list(bag.get("markers") or [])
        elif action == "marker-update":
            marker_id = str(body.get("id") or "")
            marker = next((item for item in project["markers"] if item.get("id") == marker_id), None)
            if marker is None:
                raise DogSCError("找不到这个标记。")
            if "label" in body:
                marker["label"] = str(body["label"])[:40]
            if "local" in body:
                marker["local"] = max(float(body["local"]), 0)
        elif action == "marker-delete":
            marker_id = str(body.get("id") or "")
            before = len(project["markers"])
            project["markers"] = [item for item in project["markers"] if item.get("id") != marker_id]
            if len(project["markers"]) == before:
                raise DogSCError("找不到这个标记。")
        elif action == "trim":
            project["clips"], project["zooms"], project["markers"] = trim_clip(
                project["clips"], project["zooms"], project["markers"],
                str(body["id"]), str(body["edge"]), float(body["time"]),
            )
        elif action == "move":
            project["clips"] = move_clip(project["clips"], str(body["id"]), int(body.get("direction") or 1))
        elif action == "speed":
            project["clips"], project["zooms"] = set_speed(
                project["clips"], project["zooms"], str(body["id"]), float(body["speed"])
            )
        elif action == "zoom":
            zoom = add_manual_zoom(
                project["clips"], project["zooms"], float(body["time"]),
                float(body.get("focus_x", 0.5)), float(body.get("focus_y", 0.5)),
                float(body.get("scale", 1.6)), str(body.get("easing") or "cubic"),
            )
            if "enter" in body:
                zoom["enter"] = min(max(float(body["enter"]), 0), 3)
            if "exit" in body:
                zoom["exit"] = min(max(float(body["exit"]), 0), 3)
            project["zooms"].append(zoom)
        elif action == "zoom-auto":
            project["zooms"] = [
                zoom for zoom in project["zooms"] if zoom.get("origin") != "automatic"
            ] + plan_auto_zooms(project["clips"], load_pointer(project_id))
        elif action == "zoom-update":
            _update_zoom(project, body)
        elif action == "screen-motion":
            project["screen_motions"].append(_make_screen_motion(project, body))
        elif action == "screen-motion-update":
            _update_item(project["screen_motions"], body, _screen_motion_fields)
        elif action == "mosaic":
            project["mosaics"].append(_make_mosaic(project, body))
        elif action == "mosaic-update":
            _update_item(project["mosaics"], body, _mosaic_fields)
        elif action == "sticker":
            project["stickers"].append(_make_sticker(project, body))
        elif action == "sticker-update":
            _update_item(project["stickers"], body, _sticker_fields)
        elif action == "marker":
            found = clip_at(project["clips"], float(body["time"]))
            if found is None:
                raise DogSCError("播放头不在片段上。")
            clip, local, _offset = found
            project["markers"].append({
                "id": new_id(),
                "clip_id": clip["id"],
                "local": local,
                "label": str(body.get("label") or "标记"),
            })
        elif action == "export":
            return self._json(_start_export(project))
        else:
            return self._error(404, "没有这个操作。")
        save(project)
        return self._json(project)

    def _sticker_upload(self, project: dict) -> dict:
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            raise DogSCError("请用 multipart 上传贴图。")
        filename, data = _read_upload(self._raw(), content_type)
        suffix = Path(filename).suffix.lower() or ".png"
        if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise DogSCError("贴图只支持图片文件。")
        push_history(project)
        name = f"{new_id()}{suffix}"
        target = assets_dir(project["id"]) / name
        target.write_bytes(data)
        relative = f"assets/{name}"
        item = _make_sticker(project, {"time": 0, "path": relative})
        # Prefer current playhead if the client sent it as a query later; default start near zero.
        project["stickers"].append(item)
        save(project)
        return project

    def _import(self) -> None:
        content_type = self.headers.get("Content-Type", "")
        if content_type.startswith("multipart/form-data"):
            filename, data = _read_upload(self._raw(), content_type)
            temporary = project_dir_parent() / "incoming"
            temporary.mkdir(parents=True, exist_ok=True)
            target = temporary / (Path(filename).name or "import.mp4")
            target.write_bytes(data)
            try:
                project = import_media(target, Path(filename).stem)
            finally:
                target.unlink(missing_ok=True)
            return self._json(project)
        body = self._body()
        source = Path(str(body.get("path") or "")).expanduser()
        return self._json(import_media(source, body.get("name")))

    def _body(self) -> dict:
        raw = self._raw()
        if not raw:
            return {}
        payload = json.loads(raw.decode("utf-8"))
        if not isinstance(payload, dict):
            raise DogSCError("请求格式不正确。")
        return payload

    def _raw(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _json(self, payload: object, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return

    def _error(self, status: int, message: str) -> None:
        self._json({"error": message}, status)

    def _file(self, path: Path, content_type: str) -> None:
        data = path.read_bytes()
        try:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return

    def _range(self, path: Path, content_type: str, download: str | None = None) -> None:
        size = path.stat().st_size
        start, end = 0, size - 1
        status = 200
        header = self.headers.get("Range")
        if header and header.startswith("bytes="):
            piece = header.split("=", 1)[1].split(",", 1)[0]
            left, _, right = piece.partition("-")
            if left:
                start = int(left)
            if right:
                end = int(right)
            end = min(end, size - 1)
            if start > end or start < 0:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        if download:
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{_quote(download)}")
        try:
            self.end_headers()
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining:
                    chunk = handle.read(min(remaining, 1024 * 256))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return


def _quote(name: str) -> str:
    from urllib.parse import quote
    return quote(name)


def project_dir_parent() -> Path:
    from dogsc.project import projects_dir
    return projects_dir().parent


def _sources() -> dict:
    desktop = detect()
    if desktop.backend == "hyprland" or desktop.compositor == "hyprland":
        displays = list_hypr_monitors()
        windows = list_hypr_windows()
    else:
        displays = list_xrandr()
        windows = list_x11_windows() if desktop.session == "x11" or desktop.backend == "x11" else []
    return {
        "displays": displays,
        "windows": windows,
        "microphone": desktop.microphone,
        "system_audio": desktop.system_audio,
        "backend": desktop.backend,
        "region": desktop.session == "x11" or desktop.backend in {"x11", "hyprland"},
    }


def _apply_meta(project: dict, body: dict) -> None:
    if "name" in body:
        name = str(body["name"]).strip()
        if not name:
            raise DogSCError("项目名不能为空。")
        project["name"] = name[:80]
    if "canvas" in body:
        project["canvas"] = _merge_canvas(project.get("canvas") or {}, body["canvas"])
    if "cursor" in body:
        project["cursor"] = _merge_cursor(project.get("cursor") or {}, body["cursor"])
        project["draw_cursor"] = project["cursor"].get("asset") != "system.hidden"
    if "audio" in body:
        project["audio"] = _merge_audio(project.get("audio") or {}, body["audio"])
    if "camera" in body:
        project["camera"] = _merge_camera(project.get("camera") or {}, body["camera"])
    if "opening" in body:
        project["opening"] = _merge_opening(project.get("opening") or {}, body["opening"])
    if "export" in body:
        export = dict(project.get("export") or {})
        resolution = str(body["export"].get("resolution") or export.get("resolution") or "1080p")
        if resolution not in RESOLUTIONS:
            raise DogSCError("不支持的导出分辨率。")
        fps = int(body["export"].get("fps") or export.get("fps") or 30)
        if fps not in {30, 60}:
            raise DogSCError("导出帧率只支持 30 或 60。")
        export["resolution"] = resolution
        export["fps"] = fps
        project["export"] = export
    if "draw_cursor" in body:
        project["draw_cursor"] = bool(body["draw_cursor"])
        if not project["draw_cursor"]:
            project.setdefault("cursor", {})["asset"] = "system.hidden"
    if "zoom" in body:
        _update_zoom(project, body["zoom"])


def _merge_canvas(canvas: dict, incoming: dict) -> dict:
    canvas = dict(canvas)
    if "aspect" in incoming:
        aspect = str(incoming["aspect"])
        if aspect not in ASPECTS:
            raise DogSCError("不支持的画面比例。")
        canvas["aspect"] = aspect
    for key, low, high in (
        ("padding", 0, 0.3),
        ("radius", 0, 160),
        ("shadow", 0, 1),
        ("border", 0, 40),
        ("border_opacity", 0, 1),
        ("pattern_scale", 0.5, 5),
        ("pattern_opacity", 0.05, 1),
        ("background_blur", 0, 80),
        ("content_scale", 0.25, 4),
        ("content_x", 0, 1),
        ("content_y", 0, 1),
        ("frame_scale", 0.6, 1.6),
        ("toolbar_scale", 0.65, 1.6),
    ):
        if key in incoming:
            canvas[key] = min(max(float(incoming[key]), low), high)
    if "background" in incoming:
        background = str(incoming["background"])
        if len(background) == 7 and background.startswith("#"):
            canvas["background"] = background
    if "border_color" in incoming:
        color = str(incoming["border_color"])
        if len(color) == 7 and color.startswith("#"):
            canvas["border_color"] = color
    if "background_kind" in incoming:
        kind = str(incoming["background_kind"])
        if kind not in BACKGROUND_KINDS:
            raise DogSCError("不支持的背景类型。")
        canvas["background_kind"] = kind
    if "background_image" in incoming:
        image = incoming["background_image"]
        if image in (None, ""):
            canvas["background_image"] = None
        else:
            text = str(image)
            if text.startswith("/api/wallpapers/") or resolve_wallpaper(text.split("/")[-1]) or resolve_wallpaper(text):
                canvas["background_image"] = text
            else:
                raise DogSCError("壁纸路径无效。")
    if "pattern" in incoming:
        pattern = str(incoming["pattern"])
        if pattern not in PATTERN_PRESETS:
            raise DogSCError("不支持的网格背景。")
        canvas["pattern"] = pattern
    if "dynamic" in incoming:
        dynamic = str(incoming["dynamic"])
        if dynamic not in DYNAMIC_PRESETS:
            raise DogSCError("不支持的动效背景。")
        canvas["dynamic"] = dynamic
    if "screen_frame" in incoming:
        style = str(incoming["screen_frame"])
        if style not in FRAME_STYLES:
            raise DogSCError("不支持的样机框。")
        canvas["screen_frame"] = style
    if "frame_title" in incoming:
        canvas["frame_title"] = str(incoming["frame_title"])[:40]
    if "frame_address" in incoming:
        canvas["frame_address"] = str(incoming["frame_address"])[:80]
    if "crop" in incoming and isinstance(incoming["crop"], dict):
        canvas["crop"] = clamp_crop(incoming["crop"])
    return canvas


def _merge_cursor(cursor: dict, incoming: dict) -> dict:
    cursor = dict(cursor)
    if "asset" in incoming:
        asset = str(incoming["asset"])
        if asset not in CURSOR_ASSETS:
            raise DogSCError("不支持的光标样式。")
        cursor["asset"] = asset
    if "size" in incoming:
        cursor["size"] = min(max(float(incoming["size"]), 0.25), 6)
    if "hide_when_idle" in incoming:
        cursor["hide_when_idle"] = bool(incoming["hide_when_idle"])
    if "idle_delay" in incoming:
        cursor["idle_delay"] = min(max(float(incoming["idle_delay"]), 0.2), 8)
    if "click_effect" in incoming:
        effect = str(incoming["click_effect"])
        if effect not in CLICK_EFFECTS:
            raise DogSCError("不支持的点击反馈。")
        cursor["click_effect"] = effect
    if "click_opacity" in incoming:
        cursor["click_opacity"] = min(max(float(incoming["click_opacity"]), 0), 1)
    if "click_scale" in incoming:
        cursor["click_scale"] = min(max(float(incoming["click_scale"]), 0.5), 3)
    if "motion" in incoming:
        motion = str(incoming["motion"])
        if motion not in CURSOR_MOTION:
            raise DogSCError("不支持的光标手感。")
        cursor["motion"] = motion
    if "tilt" in incoming:
        cursor["tilt"] = min(max(float(incoming["tilt"]), 2), 4)
    if "time_offset" in incoming:
        cursor["time_offset"] = min(max(float(incoming["time_offset"]), -2), 2)
    return cursor


def _merge_audio(audio: dict, incoming: dict) -> dict:
    audio = dict(audio)
    for key in ("system_volume", "mic_volume"):
        if key in incoming:
            audio[key] = min(max(float(incoming[key]), 0), 2)
    for key in ("system_muted", "mic_muted"):
        if key in incoming:
            audio[key] = bool(incoming[key])
    return audio


def _merge_camera(camera: dict, incoming: dict) -> dict:
    camera = dict(camera)
    if "enabled" in incoming:
        camera["enabled"] = bool(incoming["enabled"])
    if "shape" in incoming:
        shape = str(incoming["shape"])
        if shape not in CAMERA_SHAPES:
            raise DogSCError("不支持的摄像头形状。")
        camera["shape"] = shape
    for key, low, high in (
        ("x", 0, 1), ("y", 0, 1), ("size", 0.08, 0.6), ("roundness", 0, 1),
        ("border", 0, 20), ("shadow", 0, 1), ("opacity", 0, 1),
    ):
        if key in incoming:
            camera[key] = min(max(float(incoming[key]), low), high)
    if "mirror" in incoming:
        camera["mirror"] = bool(incoming["mirror"])
    if "border_color" in incoming:
        color = str(incoming["border_color"])
        if len(color) == 7 and color.startswith("#"):
            camera["border_color"] = color
    return camera


def _merge_opening(opening: dict, incoming: dict) -> dict:
    opening = dict(opening)
    if "enabled" in incoming:
        opening["enabled"] = bool(incoming["enabled"])
    if "preset" in incoming:
        preset = str(incoming["preset"])
        if preset not in OPENING_PRESETS:
            raise DogSCError("不支持的开场方式。")
        opening["preset"] = preset
    if "curve" in incoming:
        curve = str(incoming["curve"])
        if curve not in OPENING_CURVES:
            raise DogSCError("不支持的开场节奏。")
        opening["curve"] = curve
    if "duration" in incoming:
        opening["duration"] = min(max(float(incoming["duration"]), 0.4), 8)
    if "stagger" in incoming:
        opening["stagger"] = min(max(float(incoming["stagger"]), 0), 1.5)
    for key in ("include_screen", "include_camera", "include_stickers"):
        if key in incoming:
            opening[key] = bool(incoming[key])
    return opening


def _update_zoom(project: dict, body: dict) -> None:
    zoom_id = str(body.get("id") or "")
    for zoom in project["zooms"]:
        if zoom["id"] != zoom_id:
            continue
        if "scale" in body:
            zoom["scale"] = min(max(float(body["scale"]), 1), 6)
        if "focus_x" in body:
            zoom["focus_x"] = min(max(float(body["focus_x"]), 0), 1)
        if "focus_y" in body:
            zoom["focus_y"] = min(max(float(body["focus_y"]), 0), 1)
        if "easing" in body and body["easing"] in {"linear", "quadratic", "cubic", "quintic", "spring"}:
            zoom["easing"] = body["easing"]
        if "enter" in body:
            zoom["enter"] = min(max(float(body["enter"]), 0), 3)
        if "exit" in body:
            zoom["exit"] = min(max(float(body["exit"]), 0), 3)
        if "start" in body:
            zoom["start"] = max(float(body["start"]), 0)
        if "end" in body:
            zoom["end"] = max(float(body["end"]), float(zoom["start"]))
        return
    raise DogSCError("找不到这段运镜。")


def _locate_clip(project: dict, time: float):
    found = clip_at(project["clips"], time)
    if found is None:
        raise DogSCError("播放头不在片段上。")
    return found


def _make_screen_motion(project: dict, body: dict) -> dict:
    clip, local, _offset = _locate_clip(project, float(body.get("time") or 0))
    item = blank_screen_motion(max(local - 0.2, 0), min(local + 1.2, float(clip["src_out"] - clip["src_in"]) / max(float(clip.get("speed") or 1), 0.05)))
    item["clip_id"] = clip["id"]
    for key in ("rotation_x", "rotation_y", "rotation_z", "perspective", "scale", "position_x", "position_y", "enter", "exit"):
        if key in body:
            item[key] = float(body[key])
    if "easing" in body:
        item["easing"] = str(body["easing"])
    return item


def _make_mosaic(project: dict, body: dict) -> dict:
    clip, local, _offset = _locate_clip(project, float(body.get("time") or 0))
    item = blank_mosaic(max(local - 0.1, 0), min(local + 1.5, 60))
    item["clip_id"] = clip["id"]
    for key in ("x", "y", "width", "height", "corner_radius", "intensity", "dimming", "start", "end"):
        if key in body:
            item[key] = float(body[key])
    if "style" in body and str(body["style"]) in MOSAIC_STYLES:
        item["style"] = str(body["style"])
    return item


def _make_sticker(project: dict, body: dict) -> dict:
    clip, local, _offset = _locate_clip(project, float(body.get("time") or 0))
    path = str(body.get("path") or "")
    if not path or ".." in path:
        raise DogSCError("贴图路径不正确。")
    item = blank_sticker(max(local - 0.1, 0), min(local + 2.0, 60), path)
    item["clip_id"] = clip["id"]
    for key in ("x", "y", "width", "rotation", "opacity", "corner_radius", "start", "end"):
        if key in body:
            item[key] = float(body[key])
    if "animation" in body:
        item["animation"] = str(body["animation"])
    return item


def _screen_motion_fields(item: dict, body: dict) -> None:
    for key in ("rotation_x", "rotation_y", "rotation_z", "perspective", "scale", "position_x", "position_y", "enter", "exit", "start", "end"):
        if key in body:
            item[key] = float(body[key])
    if "easing" in body:
        item["easing"] = str(body["easing"])


def _mosaic_fields(item: dict, body: dict) -> None:
    for key in ("x", "y", "width", "height", "corner_radius", "intensity", "dimming", "start", "end"):
        if key in body:
            item[key] = float(body[key])
    if "style" in body and str(body["style"]) in MOSAIC_STYLES:
        item["style"] = str(body["style"])


def _sticker_fields(item: dict, body: dict) -> None:
    for key in ("x", "y", "width", "rotation", "opacity", "corner_radius", "start", "end"):
        if key in body:
            item[key] = float(body[key])
    if "animation" in body:
        item["animation"] = str(body["animation"])


def _update_item(items: list[dict], body: dict, apply) -> None:
    item_id = str(body.get("id") or "")
    for item in items:
        if item.get("id") != item_id:
            continue
        apply(item, body)
        return
    raise DogSCError("找不到这段效果。")


def _upload_sticker(project: dict, body: dict) -> dict:
    raise DogSCError("请用 multipart 上传贴图。")


def _ffmpeg_failure(completed: subprocess.CompletedProcess[str]) -> str:
    if completed.returncode < 0:
        return "导出被中断。"
    lines = []
    for line in (completed.stderr or "").splitlines():
        text = line.strip()
        if not text:
            continue
        if "no version information available" in text or "libncurses" in text or "libcaca" in text:
            continue
        lines.append(text)
    return lines[-1] if lines else "导出失败"


def _start_export(project: dict) -> dict:
    project_id = project["id"]
    with APP.lock:
        current = APP.exports.get(project_id)
        if current and current.get("state") == "running":
            return current
        APP.exports[project_id] = {"state": "running"}

    def run() -> None:
        directory = project_dir(project_id)
        output = directory / "export.mp4"
        partial = directory / "export.partial.mp4"
        work = directory / "export-work"
        try:
            command = build_export(load(project_id), media_path(project_id), load_pointer(project_id), partial, work)
            completed = subprocess.run(command, check=False, capture_output=True, text=True)
            if completed.returncode != 0 or not partial.is_file():
                partial.unlink(missing_ok=True)
                raise DogSCError(_ffmpeg_failure(completed))
            info = probe(partial)
            if info["duration"] <= 0 or info["width"] <= 0:
                partial.unlink(missing_ok=True)
                raise DogSCError("导出的视频无法播放。")
            partial.replace(output)
            APP.exports[project_id] = {"state": "done", "path": str(output)}
        except Exception as error:
            APP.exports[project_id] = {"state": "error", "error": str(error)}

    threading.Thread(target=run, name="dogsc-export", daemon=True).start()
    return {"state": "running"}


def create_demo() -> dict:
    temporary = project_dir_parent() / "incoming" / "demo.mp4"
    temporary.parent.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=4",
            "-f", "lavfi", "-i", "sine=frequency=523:duration=4",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
            str(temporary),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise DogSCError((completed.stderr or "生成示例失败").strip().splitlines()[-1])
    project = import_media(temporary, "示例画面")
    temporary.unlink(missing_ok=True)
    events = []
    for step in range(0, 40):
        moment = step / 10
        events.append({
            "t": round(moment, 3),
            "x": round(0.2 + 0.5 * (moment / 4), 4),
            "y": round(0.42 + ((step % 12) - 6) * 0.012, 4),
            "kind": "move",
        })
    events.append({"t": 1.0, "x": 0.32, "y": 0.42, "kind": "left"})
    events.append({"t": 2.4, "x": 0.68, "y": 0.55, "kind": "left"})
    project["capture"] = {"backend": "demo", "cursor_baked": False, "geometry": {"x": 0, "y": 0, "width": 1280, "height": 720}}
    project["draw_cursor"] = True
    project["zooms"] = plan_auto_zooms(project["clips"], events)
    (project_dir(project["id"]) / "pointer.json").write_text(
        json.dumps({"events": events}, ensure_ascii=False),
        encoding="utf-8",
    )
    save(project)
    return project


def _read_upload(body: bytes, content_type: str) -> tuple[str, bytes]:
    marker = ""
    for piece in content_type.split(";"):
        piece = piece.strip()
        if piece.startswith("boundary="):
            marker = piece.split("=", 1)[1].strip('"')
    if not marker:
        raise DogSCError("上传内容缺少分隔。")
    boundary = ("--" + marker).encode()
    for part in body.split(boundary):
        if b"filename=" not in part:
            continue
        header, _, data = part.partition(b"\r\n\r\n")
        data = data.removesuffix(b"\r\n")
        if data.endswith(b"--"):
            data = data[:-2].removesuffix(b"\r\n")
        header_text = header.decode("utf-8", "replace")
        filename = "upload.mp4"
        for token in header_text.split(";"):
            token = token.strip()
            if token.startswith("filename="):
                filename = token.split("=", 1)[1].strip().strip('"') or filename
        if not data:
            raise DogSCError("上传的视频是空的。")
        return filename, data
    raise DogSCError("没有在上传里找到视频。")


def serve(port: int = 47321, open_browser: bool = True) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"DogSC Linux  {url}")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        server.server_close()
