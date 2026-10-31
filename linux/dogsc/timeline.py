from __future__ import annotations

from dogsc.zoom import clip_duration, make_zoom, new_id, overlaps


def layout(clips: list[dict]) -> list[dict]:
    cursor = 0.0
    rows = []
    for clip in clips:
        duration = clip_duration(clip)
        rows.append({
            "id": clip["id"],
            "start": cursor,
            "end": cursor + duration,
            "duration": duration,
            "clip": clip,
        })
        cursor += duration
    return rows


def clip_at(clips: list[dict], time: float) -> tuple[dict, float, float] | None:
    if time < 0:
        return None
    for row in layout(clips):
        if row["start"] - 1e-6 <= time <= row["end"] + 1e-6:
            local = min(max(time - row["start"], 0), row["duration"])
            return row["clip"], local, row["start"]
    return None


def split_clip(clips: list[dict], zooms: list[dict], markers: list[dict], time: float) -> tuple[list[dict], list[dict], list[dict]]:
    found = clip_at(clips, time)
    if found is None:
        raise ValueError("播放头不在任何片段上。")
    clip, local, _offset = found
    duration = clip_duration(clip)
    if local <= 0.05 or duration - local <= 0.05:
        raise ValueError("离片段边缘太近，无法分割。")
    speed = max(float(clip.get("speed") or 1), 0.05)
    src_split = float(clip["src_in"]) + local * speed
    left = dict(clip)
    right = dict(clip)
    right["id"] = new_id()
    left["src_out"] = src_split
    right["src_in"] = src_split
    clips = [right if item["id"] == clip["id"] else item for item in clips]
    # Reinsert left immediately before right.
    rebuilt: list[dict] = []
    for item in clips:
        if item["id"] == right["id"]:
            rebuilt.append(left)
        rebuilt.append(item)

    next_zooms: list[dict] = []
    for zoom in zooms:
        if zoom.get("clip_id") != clip["id"]:
            next_zooms.append(zoom)
            continue
        start = float(zoom["start"])
        end = float(zoom["end"])
        exit_ = float(zoom.get("exit") or 0)
        if end + exit_ <= local + 1e-4:
            next_zooms.append(zoom)
            continue
        if start >= local - 1e-4:
            moved = dict(zoom)
            moved["clip_id"] = right["id"]
            moved["start"] = max(0.0, start - local)
            moved["end"] = max(moved["start"], end - local)
            moved["exit"] = min(float(moved.get("exit") or 0), max(0.0, clip_duration(right) - moved["end"]))
            next_zooms.append(moved)
            continue
        kept = dict(zoom)
        kept["end"] = local
        kept["exit"] = 0
        if kept["end"] - kept["start"] > 0.05:
            next_zooms.append(kept)
    next_markers: list[dict] = []
    for marker in markers:
        if marker.get("clip_id") != clip["id"]:
            next_markers.append(marker)
            continue
        if float(marker["local"]) >= local:
            moved = dict(marker)
            moved["clip_id"] = right["id"]
            moved["local"] = float(marker["local"]) - local
            next_markers.append(moved)
        else:
            next_markers.append(marker)
    return rebuilt, next_zooms, next_markers


def delete_clip(clips: list[dict], zooms: list[dict], markers: list[dict], clip_id: str) -> tuple[list[dict], list[dict], list[dict]]:
    if len(clips) <= 1:
        raise ValueError("至少保留一段画面。")
    if not any(clip["id"] == clip_id for clip in clips):
        raise ValueError("找不到要删除的片段。")
    return (
        [clip for clip in clips if clip["id"] != clip_id],
        [zoom for zoom in zooms if zoom.get("clip_id") != clip_id],
        [marker for marker in markers if marker.get("clip_id") != clip_id],
    )


def trim_clip(
    clips: list[dict],
    zooms: list[dict],
    markers: list[dict],
    clip_id: str,
    edge: str,
    timeline_time: float,
) -> tuple[list[dict], list[dict], list[dict]]:
    rows = layout(clips)
    row = next((item for item in rows if item["id"] == clip_id), None)
    if row is None:
        raise ValueError("找不到要裁剪的片段。")
    local = min(max(timeline_time - row["start"], 0), row["duration"])
    clip = dict(row["clip"])
    speed = max(float(clip.get("speed") or 1), 0.05)
    if edge == "start":
        removed = local
        if row["duration"] - removed <= 0.05:
            raise ValueError("裁剪后的片段太短。")
        clip["src_in"] = float(clip["src_in"]) + removed * speed
        next_zooms = []
        for zoom in zooms:
            if zoom.get("clip_id") != clip_id:
                next_zooms.append(zoom)
                continue
            moved = dict(zoom)
            moved["start"] = float(zoom["start"]) - removed
            moved["end"] = float(zoom["end"]) - removed
            if moved["end"] <= 0.05:
                continue
            moved["start"] = max(0.0, moved["start"])
            if moved["end"] <= moved["start"]:
                continue
            next_zooms.append(moved)
        next_markers = []
        for marker in markers:
            if marker.get("clip_id") != clip_id:
                next_markers.append(marker)
                continue
            local_marker = float(marker["local"]) - removed
            if local_marker < -1e-4:
                continue
            moved = dict(marker)
            moved["local"] = max(0.0, local_marker)
            next_markers.append(moved)
    elif edge == "end":
        kept = local
        if kept <= 0.05:
            raise ValueError("裁剪后的片段太短。")
        clip["src_out"] = float(clip["src_in"]) + kept * speed
        next_zooms = []
        for zoom in zooms:
            if zoom.get("clip_id") != clip_id:
                next_zooms.append(zoom)
                continue
            if float(zoom["start"]) >= kept - 1e-4:
                continue
            moved = dict(zoom)
            if float(moved["end"]) > kept:
                moved["end"] = kept
                moved["exit"] = 0
            elif float(moved["end"]) + float(moved.get("exit") or 0) > kept:
                moved["exit"] = max(0.0, kept - float(moved["end"]))
            if float(moved["end"]) - float(moved["start"]) > 0.02:
                next_zooms.append(moved)
        next_markers = []
        for marker in markers:
            if marker.get("clip_id") != clip_id and float(marker.get("local", 0)) >= 0:
                next_markers.append(marker)
                continue
            if marker.get("clip_id") != clip_id:
                next_markers.append(marker)
                continue
            if float(marker["local"]) <= kept + 1e-4:
                next_markers.append(marker)
    else:
        raise ValueError("裁剪边缘只能是 start 或 end。")
    clips = [clip if item["id"] == clip_id else item for item in clips]
    return clips, next_zooms, next_markers


def move_clip(clips: list[dict], clip_id: str, direction: int) -> list[dict]:
    index = next((position for position, clip in enumerate(clips) if clip["id"] == clip_id), None)
    if index is None:
        raise ValueError("找不到要移动的片段。")
    target = index + (1 if direction > 0 else -1)
    if target < 0 or target >= len(clips):
        return clips
    updated = list(clips)
    updated[index], updated[target] = updated[target], updated[index]
    return updated


def set_speed(clips: list[dict], zooms: list[dict], clip_id: str, speed: float) -> tuple[list[dict], list[dict]]:
    speed = min(max(speed, 0.25), 4.0)
    clip = next((item for item in clips if item["id"] == clip_id), None)
    if clip is None:
        raise ValueError("找不到片段。")
    old_speed = max(float(clip.get("speed") or 1), 0.05)
    ratio = old_speed / speed
    updated = []
    for item in clips:
        if item["id"] != clip_id:
            updated.append(item)
            continue
        changed = dict(item)
        changed["speed"] = speed
        updated.append(changed)
    duration = clip_duration(next(item for item in updated if item["id"] == clip_id))
    next_zooms = []
    for zoom in zooms:
        if zoom.get("clip_id") != clip_id:
            next_zooms.append(zoom)
            continue
        moved = dict(zoom)
        moved["start"] = float(zoom["start"]) * ratio
        moved["end"] = float(zoom["end"]) * ratio
        moved["enter"] = float(zoom.get("enter") or 0) * ratio
        moved["exit"] = float(zoom.get("exit") or 0) * ratio
        if moved["end"] > duration:
            moved["end"] = duration
            moved["exit"] = 0
        if moved["end"] - moved["start"] > 0.02 and not overlaps(moved, next_zooms):
            next_zooms.append(moved)
    return updated, next_zooms


def add_manual_zoom(clips: list[dict], zooms: list[dict], time: float, focus_x: float, focus_y: float, scale: float, easing: str) -> dict:
    found = clip_at(clips, time)
    if found is None:
        raise ValueError("播放头不在片段上。")
    clip, local, _offset = found
    duration = clip_duration(clip)
    start = max(0.0, local - 0.2)
    end = min(duration, start + 1.4)
    if end - start < 0.2:
        start = max(0.0, duration - 0.4)
        end = duration
    zoom = make_zoom(clip["id"], start, end, scale=scale, focus_x=focus_x, focus_y=focus_y, easing=easing, origin="manual")
    if overlaps(zoom, zooms):
        raise ValueError("这里已经有一段运镜。先删掉它，或把播放头移开。")
    if zoom["end"] + zoom["exit"] > duration:
        zoom["exit"] = max(0.0, duration - zoom["end"])
    return zoom
