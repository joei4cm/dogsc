from __future__ import annotations

from math import cos, exp, pi
from typing import Iterable
import uuid


EASINGS = ("linear", "quadratic", "cubic", "quintic", "spring")


def clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)


def ease(preset: str, progress: float) -> float:
    """Closed-form motion shared by the editor preview and ffmpeg export.

    The names match DogSC's presets. The curves are explicit polynomials so
    the browser and the encoder evaluate the same numbers.
    """
    progress = clamp(progress, 0.0, 1.0)
    if progress in (0.0, 1.0) or preset == "linear":
        return progress
    if preset == "quadratic":
        if progress < 0.5:
            return 2 * progress * progress
        return 1 - ((-2 * progress + 2) ** 2) / 2
    if preset == "quintic":
        if progress < 0.5:
            return 16 * progress ** 5
        return 1 - ((-2 * progress + 2) ** 5) / 2
    if preset == "spring":
        return 1 - exp(-6 * progress) * cos(progress * pi * 1.5)
    if progress < 0.5:
        return 4 * progress * progress * progress
    return 1 - ((-2 * progress + 2) ** 3) / 2


def new_id() -> str:
    return uuid.uuid4().hex


def effect_end(zoom: dict) -> float:
    return float(zoom["end"]) + float(zoom.get("exit") or 0)


def progress_at(zoom: dict, time: float) -> float:
    start = float(zoom["start"])
    end = float(zoom["end"])
    enter = max(float(zoom.get("enter") or 0), 0)
    exit_ = max(float(zoom.get("exit") or 0), 0)
    preset = str(zoom.get("easing") or "cubic")
    if time < start or time > end + exit_:
        return 0.0
    if enter > 0.001 and time < start + enter:
        return ease(preset, (time - start) / enter)
    if time <= end:
        return 1.0
    if exit_ > 0.001:
        return 1 - ease(preset, (time - end) / exit_)
    return 0.0


def active_zoom(zooms: Iterable[dict], time: float) -> dict | None:
    chosen = None
    for zoom in zooms:
        if float(zoom["start"]) <= time <= effect_end(zoom):
            if chosen is None or float(zoom["start"]) >= float(chosen["start"]):
                chosen = zoom
    return chosen


def sample(zooms: Iterable[dict], time: float) -> dict[str, float]:
    zoom = active_zoom(list(zooms), time)
    if zoom is None:
        return {"scale": 1.0, "focus_x": 0.5, "focus_y": 0.5, "framing": 0.0}
    framing = progress_at(zoom, time)
    scale = 1 + (max(float(zoom.get("scale") or 1), 1) - 1) * framing
    return {
        "scale": scale,
        "focus_x": clamp(float(zoom.get("focus_x", 0.5)), 0.0, 1.0),
        "focus_y": clamp(float(zoom.get("focus_y", 0.5)), 0.0, 1.0),
        "framing": framing,
    }


def viewport(scale: float, focus_x: float, focus_y: float, framing: float) -> dict[str, float]:
    """Visible source rectangle after the macOS-style safe framing clamp.

    `left` and `top` are normalized to the unzoomed frame. `size` is the
    visible width and height, also normalized. A scale of 2 centered on the
    frame yields left=0.25 and size=0.5.
    """
    scale = clamp(scale, 1.0, 6.0)
    framing = clamp(framing, 0.0, 1.0)

    def axis(focus: float) -> float:
        destination = clamp(focus, 0.30, 0.70)
        desired = focus + (destination - focus) * framing
        scaled_point = 0.5 + scale * (focus - 0.5)
        translation = desired - scaled_point
        low = 0.5 - scale / 2
        high = scale / 2 - 0.5
        translation = clamp(translation, low, high)
        return 0.5 - (0.5 + translation) / scale

    return {"left": axis(focus_x), "top": axis(focus_y), "size": 1 / scale}


def absolute_zooms(clips: list[dict], zooms: list[dict]) -> list[dict]:
    offsets: dict[str, float] = {}
    cursor = 0.0
    for clip in clips:
        offsets[clip["id"]] = cursor
        cursor += clip_duration(clip)
    absolute: list[dict] = []
    for zoom in zooms:
        offset = offsets.get(str(zoom.get("clip_id")))
        if offset is None:
            continue
        copied = dict(zoom)
        copied["start"] = float(zoom["start"]) + offset
        copied["end"] = float(zoom["end"]) + offset
        absolute.append(copied)
    absolute.sort(key=lambda item: (float(item["start"]), str(item.get("id"))))
    return absolute


def clip_duration(clip: dict) -> float:
    speed = max(float(clip.get("speed") or 1), 0.05)
    return max(float(clip["src_out"]) - float(clip["src_in"]), 0) / speed


def timeline_duration(clips: list[dict]) -> float:
    return sum(clip_duration(clip) for clip in clips)


def overlaps(candidate: dict, existing: Iterable[dict]) -> bool:
    start = float(candidate["start"])
    end = effect_end(candidate)
    for zoom in existing:
        if str(zoom.get("id")) == str(candidate.get("id")):
            continue
        if str(zoom.get("clip_id")) != str(candidate.get("clip_id")):
            continue
        other_start = float(zoom["start"])
        other_end = effect_end(zoom)
        if start < other_end - 1e-4 and other_start < end - 1e-4:
            return True
    return False


def make_zoom(
    clip_id: str,
    start: float,
    end: float,
    scale: float = 1.6,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
    enter: float = 0.45,
    exit_: float = 0.45,
    easing: str = "cubic",
    origin: str = "manual",
) -> dict:
    if easing not in EASINGS:
        easing = "cubic"
    return {
        "id": new_id(),
        "clip_id": clip_id,
        "start": max(start, 0),
        "end": max(end, start),
        "scale": clamp(scale, 1.0, 6.0),
        "focus_x": clamp(focus_x, 0.0, 1.0),
        "focus_y": clamp(focus_y, 0.0, 1.0),
        "enter": clamp(enter, 0.0, 5.0),
        "exit": clamp(exit_, 0.0, 5.0),
        "easing": easing,
        "origin": origin if origin in {"manual", "automatic"} else "manual",
    }


def plan_auto_zooms(
    clips: list[dict],
    events: list[dict],
    scale: float = 1.6,
    enter: float = 0.7,
    hold: float = 0.9,
    exit_: float = 0.7,
    gap: float = 1.4,
    easing: str = "spring",
) -> list[dict]:
    """Group nearby clicks into stable camera holds, then attach them to clips.

    Pointer times are source-media times. Each zoom is stored relative to the
    clip that contains its click so later trims and reorders keep the move.
    """
    clicks = [event for event in events if event.get("kind") in {"left", "right"} and float(event.get("t", -1)) >= 0]
    clicks.sort(key=lambda event: float(event["t"]))
    temporal: list[list[dict]] = []
    for click in clicks:
        if temporal and float(click["t"]) - float(temporal[-1][-1]["t"]) <= gap:
            temporal[-1].append(click)
        else:
            temporal.append([click])

    limit_x = 0.50 / max(scale, 1)
    limit_y = 0.70 / max(scale, 1)
    zooms: list[dict] = []
    for group in temporal:
        clusters: list[list[dict]] = []
        for click in group:
            if not clusters:
                clusters.append([click])
                continue
            xs = [float(item["x"]) for item in clusters[-1]] + [float(click["x"])]
            ys = [float(item["y"]) for item in clusters[-1]] + [float(click["y"])]
            if max(xs) - min(xs) <= limit_x and max(ys) - min(ys) <= limit_y:
                clusters[-1].append(click)
            else:
                clusters.append([click])
        if not clusters:
            continue
        anchor = locate_source(clips, float(group[0]["t"]))
        if anchor is None:
            continue
        clip, local_anchor = anchor
        earliest = 0.0
        starts = [max(local_anchor - enter * 0.18, earliest, 0)]
        located = [(clusters[0], local_anchor)]
        for cluster in clusters[1:]:
            found = locate_source(clips, float(cluster[0]["t"]))
            if found is None or found[0]["id"] != clip["id"]:
                break
            located.append((cluster, found[1]))
            starts.append(max(found[1] - enter, starts[-1] + 0.16))
        duration = clip_duration(clip)
        last_click = float(located[-1][0][-1]["t"])
        last_found = locate_source(clips, last_click)
        last_local = last_found[1] if last_found and last_found[0]["id"] == clip["id"] else located[-1][1]
        for index, (cluster, _local) in enumerate(located):
            start = starts[index]
            last = index == len(located) - 1
            end = max(last_local + hold, start + enter) if last else starts[index + 1]
            end = min(end, duration)
            start = min(max(start, 0), duration)
            if end - start <= 0.05:
                continue
            focus_x = sum(float(item["x"]) for item in cluster) / len(cluster)
            focus_y = sum(float(item["y"]) for item in cluster) / len(cluster)
            exit_value = exit_ if last else 0
            if end + exit_value > duration:
                exit_value = max(0.0, duration - end)
            zoom = make_zoom(
                clip["id"],
                start,
                end,
                scale=scale,
                focus_x=clamp(focus_x, 0.12, 0.88),
                focus_y=clamp(focus_y, 0.12, 0.88),
                enter=enter,
                exit_=exit_value,
                easing=easing,
                origin="automatic",
            )
            if not overlaps(zoom, zooms):
                zooms.append(zoom)
    return zooms


def locate_source(clips: list[dict], source_time: float) -> tuple[dict, float] | None:
    for clip in clips:
        src_in = float(clip["src_in"])
        src_out = float(clip["src_out"])
        if src_in - 1e-6 <= source_time <= src_out + 1e-6:
            speed = max(float(clip.get("speed") or 1), 0.05)
            local = (min(source_time, src_out) - src_in) / speed
            return clip, max(local, 0)
    return None
