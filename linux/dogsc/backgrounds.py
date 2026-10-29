"""Generate canvas background stills used by preview and export."""

from __future__ import annotations

from pathlib import Path
import math

from dogsc.media import write_png


def solid_color(path: Path, width: int, height: int, hex_color: str) -> None:
    r, g, b = _rgb(hex_color)
    row = bytes([r, g, b, 255]) * width
    write_png(path, [row] * height)


def pattern_png(path: Path, width: int, height: int, preset: str, scale: float = 1.0, opacity: float = 1.0) -> None:
    scale = min(max(scale, 0.5), 5.0)
    opacity = min(max(opacity, 0.05), 1.0)
    if preset == "engineeringWhiteGrid":
        base = (244, 241, 234)
        line = (196, 188, 176)
        step = max(int(28 / scale), 8)
        return _grid(path, width, height, base, line, step, opacity, dots=False)
    if preset == "midnightDots":
        base = (10, 12, 18)
        mark = (120, 140, 180)
        step = max(int(18 / scale), 6)
        return _grid(path, width, height, base, mark, step, opacity, dots=True)
    if preset == "architecturalDots":
        base = (236, 236, 232)
        mark = (120, 120, 118)
        step = max(int(22 / scale), 7)
        return _grid(path, width, height, base, mark, step, opacity, dots=True)
    if preset == "isometricMesh":
        base = (18, 22, 28)
        line = (70, 110, 130)
        return _isometric(path, width, height, base, line, scale, opacity)
    # obsidianGrid default
    base = (12, 13, 16)
    line = (48, 52, 60)
    step = max(int(32 / scale), 8)
    _grid(path, width, height, base, line, step, opacity, dots=False)


def dynamic_png(path: Path, width: int, height: int, preset: str) -> None:
    if preset == "cyberDriftGrid":
        return _gradient_grid(path, width, height, (8, 14, 24), (40, 90, 120), (180, 140, 60))
    if preset == "starfieldDots":
        return _starfield(path, width, height)
    _aurora(path, width, height)


def _rgb(value: str) -> tuple[int, int, int]:
    text = (value or "#16161a").strip()
    if not text.startswith("#"):
        text = f"#{text}"
    if len(text) != 7:
        text = "#16161a"
    return int(text[1:3], 16), int(text[3:5], 16), int(text[5:7], 16)


def _mix(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    amount = min(max(amount, 0), 1)
    return tuple(int(round(a[i] + (b[i] - a[i]) * amount)) for i in range(3))  # type: ignore[return-value]


def _grid(path: Path, width: int, height: int, base, mark, step: int, opacity: float, dots: bool) -> None:
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            on = (x % step == 0 or y % step == 0) if not dots else (x % step == 0 and y % step == 0)
            color = _mix(base, mark, opacity if on else 0)
            row.extend([*color, 255])
        rows.append(bytes(row))
    write_png(path, rows)


def _isometric(path: Path, width: int, height: int, base, line, scale: float, opacity: float) -> None:
    spacing = max(int(36 / scale), 10)
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            diag = ((x + y) % spacing == 0) or ((x - y) % spacing == 0)
            color = _mix(base, line, opacity if diag else 0)
            row.extend([*color, 255])
        rows.append(bytes(row))
    write_png(path, rows)


def _gradient_grid(path: Path, width: int, height: int, c0, c1, accent) -> None:
    rows = []
    step = 40
    for y in range(height):
        row = bytearray()
        t = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            color = _mix(c0, c1, 0.35 * u + 0.65 * t)
            if x % step == 0 or y % step == 0:
                color = _mix(color, accent, 0.22)
            row.extend([*color, 255])
        rows.append(bytes(row))
    write_png(path, rows)


def _starfield(path: Path, width: int, height: int) -> None:
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            n = (x * 73856093) ^ (y * 19349663)
            star = (n & 2047) == 0
            warm = 18 + ((n >> 3) & 15)
            color = (warm + 40, warm + 24, warm) if star else (12, 10, 14)
            row.extend([*color, 255])
        rows.append(bytes(row))
    write_png(path, rows)


def _aurora(path: Path, width: int, height: int) -> None:
    rows = []
    for y in range(height):
        row = bytearray()
        ty = y / max(height - 1, 1)
        for x in range(width):
            tx = x / max(width - 1, 1)
            wave = 0.5 + 0.5 * math.sin((tx * 4.2 + ty * 2.1) * math.pi)
            color = (
                int(20 + 40 * wave + 30 * ty),
                int(40 + 90 * wave),
                int(70 + 120 * (1 - ty) + 40 * wave),
            )
            row.extend([*color, 255])
        rows.append(bytes(row))
    write_png(path, rows)
