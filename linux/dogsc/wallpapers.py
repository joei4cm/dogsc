"""Discover system wallpaper files for Soft Silver background picker (G17)."""

from __future__ import annotations

from pathlib import Path
import hashlib
import os

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}


def wallpaper_roots() -> list[Path]:
    home = Path.home()
    candidates = [
        home / ".local/share/backgrounds",
        home / ".local/share/wallpapers",
        Path("/usr/share/backgrounds"),
        Path("/usr/share/wallpapers"),
        Path("/usr/share/pixmaps/backgrounds"),
    ]
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        candidates.insert(0, Path(xdg) / "backgrounds")
        candidates.insert(1, Path(xdg) / "wallpapers")
    seen: set[Path] = set()
    roots: list[Path] = []
    for path in candidates:
        resolved = path.expanduser()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_dir():
            roots.append(resolved)
    return roots


def wallpaper_id(path: Path) -> str:
    digest = hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:16]
    return digest


def list_wallpapers(limit: int = 48) -> list[dict]:
    items: list[dict] = []
    for root in wallpaper_roots():
        try:
            entries = sorted(root.rglob("*"))
        except OSError:
            continue
        for path in entries:
            if not path.is_file():
                continue
            if path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size < 8_000:
                continue
            items.append({
                "id": wallpaper_id(path),
                "name": path.stem,
                "path": str(path.resolve()),
                "url": f"/api/wallpapers/{wallpaper_id(path)}",
                "root": str(root),
            })
            if len(items) >= limit:
                return items
    return items


def resolve_wallpaper(wallpaper_key: str) -> Path | None:
    key = str(wallpaper_key or "").strip()
    if not key:
        return None
    for item in list_wallpapers(limit=200):
        if item["id"] == key or item["path"] == key or item["url"].endswith(key):
            path = Path(item["path"])
            return path if path.is_file() else None
    candidate = Path(key).expanduser()
    if candidate.is_file() and candidate.suffix.lower() in IMAGE_SUFFIXES:
        # Only allow files under known wallpaper roots for safety.
        try:
            resolved = candidate.resolve()
        except OSError:
            return None
        for root in wallpaper_roots():
            try:
                if root.resolve() in resolved.parents or resolved.parent == root.resolve():
                    return resolved
            except OSError:
                continue
    return None
