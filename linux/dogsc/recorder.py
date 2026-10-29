from __future__ import annotations

from pathlib import Path
import json
import os
import signal
import socket
import subprocess
import threading
import time
import uuid

from dogsc.errors import DogSCError
from dogsc.media import probe, thumbs
from dogsc.platform import Desktop, detect
from dogsc.portal import PortalCast
from dogsc.project import new_project, project_dir, projects_dir, save
from dogsc.sources import (
    audio_sidecar_command,
    hyprland_record_command,
    list_hypr_monitors,
    list_hypr_windows,
    list_x11_windows,
    list_xrandr,
    mux_command,
    normalize_geometry,
    portal_ffmpeg_command,
    portal_gstreamer_command,
    x11_record_command,
)
from dogsc.x11 import PointerSampler
from dogsc.zoom import new_id


class Recorder:
    def __init__(self):
        self._lock = threading.Lock()
        self._video: subprocess.Popen | None = None
        self._audio: subprocess.Popen | None = None
        self._sampler: PointerSampler | None = None
        self._portal: PortalCast | None = None
        self._started = 0.0
        self._directory: Path | None = None
        self._spec: dict | None = None
        self._markers: list[dict] = []
        self._log = None
        self._socket: socket.socket | None = None
        self._socket_thread: threading.Thread | None = None
        self._stop_socket = threading.Event()
        self.error: str | None = None

    def active(self) -> bool:
        return self._video is not None and self._video.poll() is None

    def status(self) -> dict:
        running = self.active()
        elapsed = time.monotonic() - self._started if running else 0
        return {
            "active": running,
            "elapsed": round(elapsed, 3) if running else 0,
            "markers": len(self._markers),
            "backend": (self._spec or {}).get("backend"),
            "error": self.error,
        }

    def start(self, request: dict, desktop: Desktop | None = None) -> dict:
        with self._lock:
            if self.active():
                raise DogSCError("已经有一条录制在进行。")
            self.error = None
            desktop = desktop or detect()
            if desktop.backend is None:
                detail = desktop.hints[0] if desktop.hints else "这台电脑还不能录屏。"
                raise DogSCError(detail)
            backend = str(request.get("backend") or desktop.backend)
            if request.get("backend") and request["backend"] != desktop.backend:
                backend = str(request["backend"])
            fps = 60 if int(request.get("fps") or 30) >= 45 else 30
            want_mic = bool(request.get("microphone"))
            want_system = bool(request.get("system_audio"))
            audio = []
            if want_mic and desktop.microphone:
                audio.append(desktop.microphone)
            if want_system and desktop.system_audio:
                audio.append(desktop.system_audio)
            project_id = uuid.uuid4().hex
            directory = projects_dir() / project_id
            directory.mkdir(parents=True, exist_ok=True)
            output = directory / "media.mp4"
            geometry, cursor_baked, command, sidecar, portal = self._command(
                backend, request, desktop, fps, audio, output
            )
            video_log = open(directory / "capture.log", "w", encoding="utf-8")
            try:
                video = subprocess.Popen(command, stdout=video_log, stderr=subprocess.STDOUT)
            except OSError as error:
                video_log.close()
                if portal:
                    portal.close()
                raise DogSCError(f"无法启动录制：{error}") from error
            self._log = video_log
            audio_proc = None
            if sidecar:
                audio_proc = subprocess.Popen(sidecar, stdout=video_log, stderr=subprocess.STDOUT)
            sampler = None
            if not cursor_baked and geometry is not None and backend == "x11":
                sampler = PointerSampler(os.environ.get("DISPLAY"), geometry)
                sampler.start()
            self._video = video
            self._audio = audio_proc
            self._sampler = sampler
            self._portal = portal
            self._started = time.monotonic()
            self._directory = directory
            self._markers = []
            self._spec = {
                "id": project_id,
                "backend": backend,
                "fps": fps,
                "geometry": geometry,
                "cursor_baked": cursor_baked,
                "name": request.get("name") or _default_name(),
                "audio": audio,
                "sidecar": sidecar is not None,
            }
            self._serve_marks()
            time.sleep(0.4)
            if video.poll() not in (None, 0):
                detail = _tail(directory / "capture.log")
                self._cleanup_failed()
                raise DogSCError(detail or "录制进程马上退出了。")
            return self.status() | {"id": project_id}

    def mark(self, label: str = "") -> dict:
        if not self.active():
            raise DogSCError("现在没有正在进行的录制。")
        self._markers.append({
            "id": new_id(),
            "local": round(time.monotonic() - self._started, 4),
            "label": label.strip() or "标记",
        })
        return {"markers": len(self._markers)}

    def stop(self) -> dict:
        with self._lock:
            if self._video is None or self._directory is None or self._spec is None:
                raise DogSCError("现在没有正在进行的录制。")
            directory = self._directory
            spec = self._spec
            markers = list(self._markers)
            video = self._video
            audio = self._audio
            sampler = self._sampler
            portal = self._portal
            self._video = None
            self._audio = None
            self._sampler = None
            self._portal = None
            self._spec = None
            self._directory = None
            self._close_socket()
            self._close_log()
        _interrupt(video)
        if audio:
            _interrupt(audio)
        events = sampler.stop() if sampler else []
        if portal:
            portal.close()
        media = directory / "media.mp4"
        if spec.get("sidecar") and (directory / "audio.m4a").exists() and media.exists():
            muxed = directory / "muxed.mp4"
            subprocess.run(mux_command(str(media), str(directory / "audio.m4a"), str(muxed)), check=False)
            if muxed.exists() and muxed.stat().st_size > 0:
                muxed.replace(media)
        if not media.exists() or media.stat().st_size == 0:
            raise DogSCError(_tail(directory / "capture.log") or "没有写出视频文件。")
        try:
            info = probe(media)
        except RuntimeError as error:
            raise DogSCError(str(error)) from error
        capture = {
            "backend": spec["backend"],
            "cursor_baked": spec["cursor_baked"],
            "geometry": spec["geometry"],
        }
        project = new_project(spec["name"], info, capture)
        project["id"] = spec["id"]
        project["markers"] = [
            {"id": item["id"], "clip_id": project["clips"][0]["id"], "local": min(item["local"], info["duration"]), "label": item["label"]}
            for item in markers
            if item["local"] <= info["duration"] + 0.05
        ]
        project["draw_cursor"] = not spec["cursor_baked"] and bool(events)
        final_dir = project_dir(project["id"])
        if final_dir != directory:
            directory.rename(final_dir)
        else:
            final_dir = directory
        (final_dir / "pointer.json").write_text(json.dumps({"events": events}, ensure_ascii=False), encoding="utf-8")
        try:
            thumbs(final_dir / "media.mp4", final_dir / "thumbs")
        except Exception:
            pass
        save(project)
        return project

    def _command(self, backend: str, request: dict, desktop: Desktop, fps: int, audio: list[str], output: Path):
        source = str(request.get("source") or "display")
        if backend == "fixture":
            duration = float(request.get("duration") or 1)
            command = [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", f"testsrc=size=640x360:rate=30:duration={duration}",
                "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
                str(output),
            ]
            return {"x": 0, "y": 0, "width": 640, "height": 360}, True, command, None, None
        if backend == "x11":
            geometry = self._x11_geometry(source, request)
            return geometry, False, x11_record_command(os.environ.get("DISPLAY") or ":0", geometry, fps, audio, str(output)), None, None
        if backend == "hyprland":
            geometry, output_name = self._hypr_target(source, request)
            single = audio[0] if len(audio) == 1 else None
            command = hyprland_record_command(output_name, geometry, fps, single, str(output))
            sidecar = audio_sidecar_command(audio, str(output.parent / "audio.m4a")) if len(audio) > 1 else None
            return geometry, True, command, sidecar, None
        if backend == "portal":
            portal = PortalCast("window" if source == "window" else "monitor")
            try:
                node = portal.start()
            except DogSCError:
                portal.close()
                raise
            if desktop.tools.ffmpeg_pipewire:
                return None, True, portal_ffmpeg_command(node, fps, audio, str(output)), None, portal
            sidecar = audio_sidecar_command(audio, str(output.parent / "audio.m4a")) if audio else None
            return None, True, portal_gstreamer_command(node, str(output)), sidecar, portal
        raise DogSCError(f"不支持的录制方式：{backend}")

    def _x11_geometry(self, source: str, request: dict) -> dict:
        displays = list_xrandr()
        if source == "region":
            geometry = request.get("geometry") or {}
            if not geometry:
                raise DogSCError("区域录制需要先框选范围。")
            return normalize_geometry(geometry)
        if source == "window":
            window_id = str(request.get("window_id") or "")
            windows = list_x11_windows()
            window = next((item for item in windows if item["id"] == window_id), None)
            if window is None:
                raise DogSCError("找不到要录的窗口。")
            return normalize_geometry(window)
        index = int(request.get("display_index") or 0)
        if not displays:
            from dogsc.x11 import _X11
            connection = _X11(os.environ.get("DISPLAY"))
            try:
                width, height = connection.size() if hasattr(connection, "size") else (0, 0)
            finally:
                connection.close()
            if width <= 0:
                raise DogSCError("没有找到显示器。")
            return normalize_geometry({"x": 0, "y": 0, "width": width, "height": height})
        index = min(max(index, 0), len(displays) - 1)
        return normalize_geometry(displays[index])

    def _hypr_target(self, source: str, request: dict) -> tuple[dict | None, str | None]:
        if source == "region":
            geometry = request.get("geometry")
            if not geometry:
                raise DogSCError("区域录制需要 slurp 选出的范围。")
            return normalize_geometry(geometry), None
        if source == "window":
            window_id = str(request.get("window_id") or "")
            window = next((item for item in list_hypr_windows() if item["id"] == window_id), None)
            if window is None:
                raise DogSCError("找不到要录的窗口。")
            return normalize_geometry(window), None
        monitors = list_hypr_monitors()
        index = int(request.get("display_index") or 0)
        if not monitors:
            return None, None
        index = min(max(index, 0), len(monitors) - 1)
        return None, monitors[index]["name"]

    def _serve_marks(self) -> None:
        self._close_socket()
        path = projects_dir().parent / "active.sock"
        if path.exists():
            path.unlink()
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(str(path))
        server.listen(4)
        server.settimeout(0.3)
        self._socket = server
        self._stop_socket.clear()
        active = projects_dir().parent / "active.json"
        active.write_text(json.dumps({"socket": str(path), "pid": os.getpid()}), encoding="utf-8")

        def loop() -> None:
            while not self._stop_socket.is_set():
                try:
                    conn, _addr = server.accept()
                except socket.timeout:
                    continue
                except OSError:
                    break
                with conn:
                    data = conn.recv(1024).decode("utf-8", "replace").strip()
                    if data.startswith("mark"):
                        label = data.split(" ", 1)[1] if " " in data else ""
                        try:
                            result = self.mark(label)
                            conn.sendall(json.dumps(result).encode())
                        except DogSCError as error:
                            conn.sendall(json.dumps({"error": str(error)}).encode())

        self._socket_thread = threading.Thread(target=loop, name="dogsc-mark", daemon=True)
        self._socket_thread.start()

    def _close_log(self) -> None:
        if self._log:
            self._log.close()
            self._log = None

    def _close_socket(self) -> None:
        self._stop_socket.set()
        if self._socket:
            self._socket.close()
            self._socket = None
        active = projects_dir().parent / "active.json"
        if active.exists():
            active.unlink()

    def _cleanup_failed(self) -> None:
        if self._portal:
            self._portal.close()
        if self._sampler:
            self._sampler.stop()
        self._close_socket()
        self._close_log()
        self._video = None
        self._audio = None
        self._sampler = None
        self._portal = None
        self._spec = None
        self._directory = None


def send_mark(label: str = "") -> dict:
    active_path = projects_dir().parent / "active.json"
    if not active_path.exists():
        raise DogSCError("现在没有正在进行的录制。")
    payload = json.loads(active_path.read_text(encoding="utf-8"))
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        client.settimeout(2)
        client.connect(payload["socket"])
        message = "mark" if not label else f"mark {label}"
        client.sendall(message.encode())
        raw = client.recv(1024)
    except OSError as error:
        raise DogSCError("没法把标记送给正在录制的 DogSC。") from error
    finally:
        client.close()
    body = json.loads(raw.decode() or "{}")
    if body.get("error"):
        raise DogSCError(str(body["error"]))
    return body


def _interrupt(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    process.send_signal(signal.SIGINT)
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


def _tail(path: Path) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
    return lines[-1] if lines else ""


def _default_name() -> str:
    from datetime import datetime
    return "录制 " + datetime.now().astimezone().strftime("%m-%d %H:%M")


def pick_region_for(desktop: Desktop) -> dict:
    if desktop.session == "x11" or desktop.backend == "x11":
        from dogsc.x11 import pick_region
        return pick_region(os.environ.get("DISPLAY"))
    if desktop.tools.slurp:
        completed = subprocess.run(["slurp"], check=False, capture_output=True, text=True)
        if completed.returncode != 0:
            raise DogSCError((completed.stderr or "已取消区域选择").strip())
        text = completed.stdout.strip().replace("x", " ")
        parts = text.replace(",", " ").split()
        if len(parts) != 4:
            raise DogSCError("slurp 没有返回区域。")
        return normalize_geometry({
            "x": int(parts[0]),
            "y": int(parts[1]),
            "width": int(parts[2]),
            "height": int(parts[3]),
        })
    raise DogSCError("当前会话不能框选区域。X11 可以直接拖拽；Hyprland 需要安装 slurp。")
