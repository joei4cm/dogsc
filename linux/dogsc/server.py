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
from dogsc.export_plan import build_export
from dogsc.media import probe
from dogsc.platform import detect
from dogsc.project import (
    delete,
    import_media,
    list_projects,
    load,
    load_pointer,
    media_path,
    project_dir,
    save,
)
from dogsc.recorder import Recorder, pick_region_for
from dogsc.sources import list_hypr_monitors, list_hypr_windows, list_x11_windows, list_xrandr
from dogsc.timeline import add_manual_zoom, delete_clip, move_clip, set_speed, split_clip, trim_clip
from dogsc.zoom import new_id, plan_auto_zooms


WEB = Path(__file__).resolve().parent / "web"


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
            if path.startswith("/api/projects/"):
                return self._project_get(path)
            if path == "/" or path == "":
                return self._file(WEB / "index.html", "text/html; charset=utf-8")
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
            if len(parts) == 5 and parts[:2] == ["api", "projects"] and parts[3] == "zooms":
                project = load(parts[2])
                project["zooms"] = [zoom for zoom in project["zooms"] if zoom["id"] != parts[4]]
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
            return self._json(load(project_id))
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
        project = load(project_id)
        body = self._body()
        if action == "meta":
            _apply_meta(project, body)
        elif action == "split":
            project["clips"], project["zooms"], project["markers"] = split_clip(
                project["clips"], project["zooms"], project["markers"], float(body["time"])
            )
        elif action == "delete-clip":
            project["clips"], project["zooms"], project["markers"] = delete_clip(
                project["clips"], project["zooms"], project["markers"], str(body["id"])
            )
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
            project["zooms"].append(zoom)
        elif action == "zoom-auto":
            project["zooms"] = [
                zoom for zoom in project["zooms"] if zoom.get("origin") != "automatic"
            ] + plan_auto_zooms(project["clips"], load_pointer(project_id))
        elif action == "zoom-update":
            _update_zoom(project, body)
        elif action == "marker":
            from dogsc.timeline import clip_at
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
        canvas = dict(project.get("canvas") or {})
        incoming = body["canvas"]
        aspect = str(incoming.get("aspect") or canvas.get("aspect"))
        if aspect not in {"source", "16:9", "4:3", "1:1", "9:16", "3:4"}:
            raise DogSCError("不支持的画面比例。")
        canvas["aspect"] = aspect
        canvas["padding"] = min(max(float(incoming.get("padding", canvas.get("padding", 0))), 0), 0.2)
        canvas["radius"] = min(max(float(incoming.get("radius", canvas.get("radius", 0))), 0), 160)
        canvas["shadow"] = min(max(float(incoming.get("shadow", canvas.get("shadow", 0))), 0), 1)
        background = str(incoming.get("background", canvas.get("background", "#16161a")))
        if len(background) == 7 and background.startswith("#"):
            canvas["background"] = background
        project["canvas"] = canvas
    if "export" in body:
        export = dict(project.get("export") or {})
        resolution = str(body["export"].get("resolution") or export.get("resolution") or "1080p")
        if resolution not in {"source", "1080p", "1440p", "4k"}:
            raise DogSCError("不支持的导出分辨率。")
        fps = int(body["export"].get("fps") or export.get("fps") or 30)
        if fps not in {30, 60}:
            raise DogSCError("导出帧率只支持 30 或 60。")
        export["resolution"] = resolution
        export["fps"] = fps
        project["export"] = export
    if "draw_cursor" in body:
        project["draw_cursor"] = bool(body["draw_cursor"])
    if "zoom" in body:
        _update_zoom(project, body["zoom"])


def _update_zoom(project: dict, body: dict) -> None:
    zoom_id = str(body.get("id") or "")
    for zoom in project["zooms"]:
        if zoom["id"] != zoom_id:
            continue
        if "scale" in body:
            zoom["scale"] = min(max(float(body["scale"]), 1), 4)
        if "focus_x" in body:
            zoom["focus_x"] = min(max(float(body["focus_x"]), 0), 1)
        if "focus_y" in body:
            zoom["focus_y"] = min(max(float(body["focus_y"]), 0), 1)
        if "easing" in body and body["easing"] in {"linear", "quadratic", "cubic", "quintic", "spring"}:
            zoom["easing"] = body["easing"]
        if "start" in body:
            zoom["start"] = max(float(body["start"]), 0)
        if "end" in body:
            zoom["end"] = max(float(body["end"]), float(zoom["start"]))
        return
    raise DogSCError("找不到这段运镜。")


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
