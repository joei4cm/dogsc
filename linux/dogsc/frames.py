"""Device / window chrome overlays drawn around the recorded content."""

from __future__ import annotations

from pathlib import Path

from dogsc.media import write_png


def frame_metrics(style: str, content_w: int, content_h: int, frame_scale: float = 1.0, toolbar_scale: float = 1.0) -> dict:
    style = style or "none"
    if style == "none":
        return {"outer_w": content_w, "outer_h": content_h, "x": 0, "y": 0, "chrome_h": 0}
    scale = min(max(frame_scale, 0.6), 1.6)
    toolbar = min(max(toolbar_scale, 0.65), 1.6)
    if style == "devicePhone":
        bezel = max(int(18 * scale), 10)
        top = max(int(42 * scale), 24)
        bottom = max(int(42 * scale), 24)
        return {
            "outer_w": content_w + bezel * 2,
            "outer_h": content_h + top + bottom,
            "x": bezel,
            "y": top,
            "chrome_h": top,
            "bezel": bezel,
            "bottom": bottom,
        }
    chrome_h = max(int(36 * toolbar), 28)
    pad = max(int(10 * scale), 6)
    return {
        "outer_w": content_w + pad * 2,
        "outer_h": content_h + chrome_h + pad,
        "x": pad,
        "y": chrome_h,
        "chrome_h": chrome_h,
        "pad": pad,
    }


def render_frame(
    path: Path,
    style: str,
    outer_w: int,
    outer_h: int,
    content_w: int,
    content_h: int,
    title: str = "DogSC",
    address: str = "dogsc.app",
    frame_scale: float = 1.0,
    toolbar_scale: float = 1.0,
) -> dict:
    metrics = frame_metrics(style, content_w, content_h, frame_scale, toolbar_scale)
    if style == "none":
        return metrics
    light = style in {"windowLight", "browserLight"}
    phone = style == "devicePhone"
    browser = style.startswith("browser")
    chrome = (246, 246, 248) if light else (36, 38, 42)
    body = (228, 228, 232) if light else (22, 24, 28)
    ink = (40, 40, 44) if light else (230, 230, 235)
    rows = []
    for y in range(outer_h):
        row = bytearray(outer_w * 4)
        for x in range(outer_w):
            inside = (
                metrics["x"] <= x < metrics["x"] + content_w
                and metrics["y"] <= y < metrics["y"] + content_h
            )
            if inside:
                row[x * 4:x * 4 + 4] = b"\x00\x00\x00\x00"
                continue
            color = body if phone else chrome
            if not phone and y < metrics["chrome_h"]:
                color = chrome
            if phone and (y < metrics["y"] or y >= metrics["y"] + content_h):
                color = (18, 18, 20)
            row[x * 4] = color[0]
            row[x * 4 + 1] = color[1]
            row[x * 4 + 2] = color[2]
            row[x * 4 + 3] = 255
        rows.append(bytes(row))
    # Traffic lights / browser address / notch drawn as simple blocks.
    if not phone:
        cy = max(metrics["chrome_h"] // 2 - 4, 4)
        for index, rgb in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
            _disk(rows, 14 + index * 14, cy + 4, 4, rgb)
        if browser:
            bar_y = max(metrics["chrome_h"] // 2 - 8, 4)
            bar_x = 64
            bar_w = min(outer_w - 80, max(content_w - 40, 120))
            _rect(rows, bar_x, bar_y, bar_w, 16, (255, 255, 255) if light else (18, 18, 20), 180)
            _text_dots(rows, bar_x + 10, bar_y + 6, min(len(address), 24), ink)
        else:
            _text_dots(rows, outer_w // 2 - 20, cy + 2, min(len(title), 18), ink)
    else:
        # Notch
        notch_w = min(content_w // 3, 120)
        notch_x = metrics["x"] + (content_w - notch_w) // 2
        _rect(rows, notch_x, metrics["y"] - 18, notch_w, 10, (8, 8, 10), 255)
        # Home indicator
        home_w = min(content_w // 3, 110)
        home_x = metrics["x"] + (content_w - home_w) // 2
        home_y = metrics["y"] + content_h + metrics.get("bottom", 24) // 2
        _rect(rows, home_x, home_y, home_w, 4, (80, 80, 86), 255)
    write_png(path, rows)
    return metrics


def _disk(rows: list[bytes], cx: int, cy: int, radius: int, rgb: tuple[int, int, int]) -> None:
    height = len(rows)
    width = len(rows[0]) // 4
    for y in range(cy - radius, cy + radius + 1):
        if y < 0 or y >= height:
            continue
        row = bytearray(rows[y])
        for x in range(cx - radius, cx + radius + 1):
            if x < 0 or x >= width:
                continue
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius:
                i = x * 4
                row[i:i + 4] = bytes([rgb[0], rgb[1], rgb[2], 255])
        rows[y] = bytes(row)


def _rect(rows: list[bytes], x0: int, y0: int, w: int, h: int, rgb: tuple[int, int, int], alpha: int) -> None:
    height = len(rows)
    width = len(rows[0]) // 4
    for y in range(y0, y0 + h):
        if y < 0 or y >= height:
            continue
        row = bytearray(rows[y])
        for x in range(x0, x0 + w):
            if 0 <= x < width:
                i = x * 4
                row[i:i + 4] = bytes([rgb[0], rgb[1], rgb[2], alpha])
        rows[y] = bytes(row)


def _text_dots(rows: list[bytes], x0: int, y0: int, count: int, rgb: tuple[int, int, int]) -> None:
    for index in range(count):
        _rect(rows, x0 + index * 4, y0, 2, 2, rgb, 220)
