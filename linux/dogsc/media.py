from __future__ import annotations

from pathlib import Path
import json
import struct
import subprocess
import zlib


def probe(path: Path) -> dict:
    completed = subprocess.run(
        [
            "ffprobe", "-v", "error", "-print_format", "json",
            "-show_streams", "-show_format", str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or "无法读取视频").strip().splitlines()
        raise RuntimeError(detail[-1] if detail else "无法读取视频")
    payload = json.loads(completed.stdout or "{}")
    video = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"), None)
    if video is None:
        raise RuntimeError("文件里没有视频轨。")
    audio = any(stream.get("codec_type") == "audio" for stream in payload.get("streams", []))
    rate = str(video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1")
    fps = _ratio(rate)
    duration = float(payload.get("format", {}).get("duration") or video.get("duration") or 0)
    return {
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "fps": fps or 30,
        "duration": max(duration, 0),
        "has_audio": audio,
    }


def _ratio(value: str) -> float:
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        den = float(denominator or 1)
        return float(numerator) / den if den else 0
    try:
        return float(value)
    except ValueError:
        return 0


def write_png(path: Path, rgba_rows: list[bytes]) -> None:
    height = len(rgba_rows)
    width = len(rgba_rows[0]) // 4
    raw = b"".join(b"\x00" + row for row in rgba_rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def rounded_mask(path: Path, width: int, height: int, radius: float) -> None:
    radius = min(max(radius, 0), min(width, height) / 2)
    rows = []
    for y in range(height):
        row = bytearray(width * 4)
        for x in range(width):
            if _inside_round(x + 0.5, y + 0.5, width, height, radius):
                row[x * 4:x * 4 + 4] = b"\xff\xff\xff\xff"
        rows.append(bytes(row))
    write_png(path, rows)


def _inside_round(x: float, y: float, width: int, height: int, radius: float) -> bool:
    if radius <= 0:
        return True
    dx = max(abs(x - width / 2) - (width / 2 - radius), 0)
    dy = max(abs(y - height / 2) - (height / 2 - radius), 0)
    return dx * dx + dy * dy <= radius * radius


ARROW = [
    "..X.............",
    "..XX............",
    "..X.X...........",
    "..X..X..........",
    "..X...X.........",
    "..X....X........",
    "..X.....X.......",
    "..X......X......",
    "..X.......X.....",
    "..X........X....",
    "..X......XXXXX..",
    "..X...X..X......",
    "..X..X..X.......",
    "..X.X...X.......",
    "..XX....X.......",
    "..X.....X.......",
    "........X.......",
    "........X.......",
]


def cursor_png(path: Path) -> None:
    height = len(ARROW)
    width = max(len(row) for row in ARROW)
    rows = []
    for y, line in enumerate(ARROW):
        row = bytearray(width * 4)
        padded = line.ljust(width, ".")
        for x, pixel in enumerate(padded):
            if pixel != "X":
                continue
            # A one-pixel dark rim keeps the arrow readable on light footage.
            row[x * 4:x * 4 + 4] = b"\xff\xff\xff\xff"
        rows.append(bytes(row))
    for y, line in enumerate(ARROW):
        padded = line.ljust(width, ".")
        for x, pixel in enumerate(padded):
            if pixel == "X":
                continue
            if any(
                0 <= y + dy < height and 0 <= x + dx < width and ARROW[y + dy].ljust(width, ".")[x + dx] == "X"
                for dy in (-1, 0, 1)
                for dx in (-1, 0, 1)
            ):
                rows[y] = bytearray(rows[y])
                rows[y][x * 4:x * 4 + 4] = b"\x11\x11\x14\xff"
                rows[y] = bytes(rows[y])
    write_png(path, rows)


def thumbs(media: Path, directory: Path, count: int = 8) -> list[str]:
    directory.mkdir(parents=True, exist_ok=True)
    info = probe(media)
    duration = max(info["duration"], 0.1)
    names = []
    for index in range(count):
        moment = duration * (index + 0.5) / count
        name = f"{index}.jpg"
        target = directory / name
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-ss", f"{moment:.3f}", "-i", str(media),
                "-frames:v", "1", "-vf", "scale=320:-2", str(target),
            ],
            check=False,
            capture_output=True,
        )
        if target.exists():
            names.append(name)
    return names
