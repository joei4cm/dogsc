from __future__ import annotations

import json
import re
import subprocess


def parse_xrandr(text: str) -> list[dict]:
    displays = []
    pattern = re.compile(r"^(\S+) connected(?: primary)? (\d+)x(\d+)\+(\d+)\+(\d+)")
    for line in text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        displays.append({
            "name": match.group(1),
            "width": int(match.group(2)),
            "height": int(match.group(3)),
            "x": int(match.group(4)),
            "y": int(match.group(5)),
            "primary": " primary " in f" {line} ",
        })
    return displays


def parse_hypr_monitors(payload: str) -> list[dict]:
    raw = json.loads(payload or "[]")
    displays = []
    for item in raw:
        displays.append({
            "name": str(item.get("name") or "monitor"),
            "width": int(item.get("width") or 0),
            "height": int(item.get("height") or 0),
            "x": int(item.get("x") or 0),
            "y": int(item.get("y") or 0),
            "primary": bool(item.get("focused")),
        })
    return [item for item in displays if item["width"] > 0 and item["height"] > 0]


def parse_hypr_clients(payload: str) -> list[dict]:
    raw = json.loads(payload or "[]")
    windows = []
    for item in raw:
        at = item.get("at") or [0, 0]
        size = item.get("size") or [0, 0]
        width = int(size[0] if len(size) > 0 else 0)
        height = int(size[1] if len(size) > 1 else 0)
        if width < 80 or height < 80:
            continue
        title = str(item.get("title") or item.get("class") or "窗口")
        windows.append({
            "id": str(item.get("address") or title),
            "title": title,
            "x": int(at[0] if len(at) > 0 else 0),
            "y": int(at[1] if len(at) > 1 else 0),
            "width": width,
            "height": height,
        })
    return windows


def even(value: int) -> int:
    value = int(value)
    if value < 2:
        return 2
    return value - (value % 2)


def normalize_geometry(geometry: dict) -> dict:
    return {
        "x": max(int(geometry.get("x") or 0), 0),
        "y": max(int(geometry.get("y") or 0), 0),
        "width": even(int(geometry.get("width") or 2)),
        "height": even(int(geometry.get("height") or 2)),
    }


def x11_input(display: str, x: int, y: int) -> str:
    base = (display or ":0").split("+", 1)[0]
    if not re.search(r"\.\d+$", base):
        base = f"{base}.0"
    return f"{base}+{int(x)},{int(y)}"


def x11_record_command(display: str, geometry: dict, fps: int, audio: list[str], output: str) -> list[str]:
    geometry = normalize_geometry(geometry)
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-thread_queue_size", "512",
        "-f", "x11grab",
        "-draw_mouse", "0",
        "-framerate", str(int(fps)),
        "-video_size", f"{geometry['width']}x{geometry['height']}",
        "-i", x11_input(display, geometry["x"], geometry["y"]),
    ]
    command.extend(audio_input_args(audio))
    command.extend(video_encode_args())
    command.extend(audio_encode_args(len(audio)))
    command.extend(["-movflags", "+faststart", output])
    return command


def hyprland_record_command(output_name: str | None, geometry: dict | None, fps: int, audio_device: str | None, output: str) -> list[str]:
    command = ["wf-recorder", "-y", "-D", "-r", str(int(fps)), "-f", output, "-p", "preset=veryfast", "-p", "crf=18"]
    if output_name and geometry is None:
        command.extend(["-o", output_name])
    if geometry is not None:
        geometry = normalize_geometry(geometry)
        command.extend(["-g", f"{geometry['x']},{geometry['y']} {geometry['width']}x{geometry['height']}"])
    if audio_device:
        command.append(f"--audio={audio_device}")
    return command


def portal_ffmpeg_command(node_id: int, fps: int, audio: list[str], output: str) -> list[str]:
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-f", "pipewire", "-framerate", str(int(fps)), "-i", str(int(node_id)),
    ]
    command.extend(audio_input_args(audio))
    command.extend(video_encode_args())
    command.extend(audio_encode_args(len(audio)))
    command.extend(["-movflags", "+faststart", output])
    return command


def portal_gstreamer_command(node_id: int, output: str) -> list[str]:
    return [
        "gst-launch-1.0", "-e",
        "pipewiresrc", f"path={int(node_id)}", "!",
        "videoconvert", "!",
        "x264enc", "tune=zerolatency", "speed-preset=veryfast", "!",
        "h264parse", "!",
        "mp4mux", "!",
        "filesink", f"location={output}",
    ]


def audio_sidecar_command(devices: list[str], output: str) -> list[str]:
    command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning"]
    for device in devices:
        command.extend(["-f", "pulse", "-i", device])
    if len(devices) > 1:
        command.extend([
            "-filter_complex",
            f"amix=inputs={len(devices)}:duration=longest:dropout_transition=0",
        ])
    command.extend(["-c:a", "aac", "-b:a", "160k", output])
    return command


def audio_input_args(devices: list[str]) -> list[str]:
    args: list[str] = []
    for device in devices:
        args.extend(["-thread_queue_size", "512", "-f", "pulse", "-i", device])
    return args


def video_encode_args() -> list[str]:
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]


def audio_encode_args(count: int) -> list[str]:
    if count <= 0:
        return ["-an"]
    if count == 1:
        return ["-c:a", "aac", "-b:a", "160k"]
    return [
        "-filter_complex",
        f"amix=inputs={count}:duration=longest:dropout_transition=0[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-c:a", "aac",
        "-b:a", "160k",
    ]


def mux_command(video: str, audio: str, output: str) -> list[str]:
    return [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", video, "-i", audio,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy", "-shortest", "-movflags", "+faststart", output,
    ]


def run_checked(command: list[str]) -> str:
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "命令失败").strip()
        raise RuntimeError(detail.splitlines()[-1] if detail else "命令失败")
    return completed.stdout


def list_xrandr() -> list[dict]:
    try:
        return parse_xrandr(run_checked(["xrandr", "--current"]))
    except (OSError, RuntimeError):
        return []


def list_hypr_monitors() -> list[dict]:
    try:
        return parse_hypr_monitors(run_checked(["hyprctl", "monitors", "-j"]))
    except (OSError, RuntimeError, json.JSONDecodeError):
        return []


def list_hypr_windows() -> list[dict]:
    try:
        return parse_hypr_clients(run_checked(["hyprctl", "clients", "-j"]))
    except (OSError, RuntimeError, json.JSONDecodeError):
        return []


def list_x11_windows() -> list[dict]:
    try:
        listing = subprocess.run(
            ["xdotool", "search", "--onlyvisible", "--name", "."],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return []
    windows = []
    for window_id in listing.stdout.split():
        if not window_id.isdigit():
            continue
        geometry = subprocess.run(
            ["xdotool", "getwindowgeometry", "--shell", window_id],
            check=False,
            capture_output=True,
            text=True,
        )
        name = subprocess.run(
            ["xdotool", "getwindowname", window_id],
            check=False,
            capture_output=True,
            text=True,
        )
        values = {}
        for line in geometry.stdout.splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                values[key] = value
        width = int(values.get("WIDTH") or 0)
        height = int(values.get("HEIGHT") or 0)
        if width < 80 or height < 80:
            continue
        title = name.stdout.strip() or f"窗口 {window_id}"
        windows.append({
            "id": window_id,
            "title": title,
            "x": int(values.get("X") or 0),
            "y": int(values.get("Y") or 0),
            "width": width,
            "height": height,
        })
        if len(windows) >= 40:
            break
    return windows
