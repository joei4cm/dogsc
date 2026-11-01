from __future__ import annotations

from pathlib import Path
import subprocess

from dogsc.backgrounds import dynamic_png, pattern_png, solid_color
from dogsc.errors import DogSCError
from dogsc.frames import frame_metrics, render_frame
from dogsc.media import cursor_png, rounded_mask, probe
from dogsc.model import clamp_crop
from dogsc.zoom import absolute_zooms, clip_duration, sample, viewport


def even(value: float) -> int:
    number = int(round(value))
    number -= number % 2
    return max(number, 2)


def canvas_size(src_w: int, src_h: int, aspect: str, resolution: str) -> tuple[int, int]:
    ratios = {
        "source": None,
        "16:9": (16, 9),
        "4:3": (4, 3),
        "1:1": (1, 1),
        "9:16": (9, 16),
        "3:4": (3, 4),
        "2.39:1": (239, 100),
        "1:2.39": (100, 239),
    }
    presets = {"1080p": (1080, 1920), "1440p": (1440, 2560), "4k": (2160, 3840)}
    ratio = ratios.get(aspect, None)
    if resolution == "source":
        long_edge = max(src_w, src_h)
        short_edge = min(src_w, src_h)
    else:
        short_edge, long_edge = presets.get(resolution, (1080, 1920))
    if ratio is None:
        return even(src_w), even(src_h)
    rw, rh = ratio
    if rw >= rh:
        width = long_edge if resolution != "source" else max(src_w, src_h)
        height = even(width * rh / rw)
        return even(width), height
    height = long_edge if resolution != "source" else max(src_w, src_h)
    width = even(height * rw / rh)
    return width, even(height)


def content_layout(
    src_w: int,
    src_h: int,
    canvas_w: int,
    canvas_h: int,
    padding: float,
    content_scale: float = 1.0,
    content_x: float = 0.5,
    content_y: float = 0.5,
    frame_style: str = "none",
    frame_scale: float = 1.0,
    toolbar_scale: float = 1.0,
) -> dict[str, int]:
    padding = min(max(padding, 0.0), 0.3)
    content_scale = min(max(content_scale, 0.25), 4.0)
    inner_w = canvas_w * (1 - 2 * padding)
    inner_h = canvas_h * (1 - 2 * padding)
    src_aspect = src_w / max(src_h, 1)
    inner_aspect = inner_w / max(inner_h, 1)
    if src_aspect > inner_aspect:
        content_w = inner_w
        content_h = inner_w / src_aspect
    else:
        content_h = inner_h
        content_w = inner_h * src_aspect
    content_w = even(content_w * content_scale)
    content_h = even(content_h * content_scale)
    metrics = frame_metrics(frame_style, content_w, content_h, frame_scale, toolbar_scale)
    outer_w = metrics["outer_w"]
    outer_h = metrics["outer_h"]
    # Keep the framed package inside the padded canvas.
    if outer_w > inner_w or outer_h > inner_h:
        fit = min(inner_w / max(outer_w, 1), inner_h / max(outer_h, 1))
        content_w = even(content_w * fit)
        content_h = even(content_h * fit)
        metrics = frame_metrics(frame_style, content_w, content_h, frame_scale, toolbar_scale)
        outer_w = metrics["outer_w"]
        outer_h = metrics["outer_h"]
    origin_x = (canvas_w - outer_w) * min(max(content_x, 0), 1)
    origin_y = (canvas_h - outer_h) * min(max(content_y, 0), 1)
    return {
        "content_w": content_w,
        "content_h": content_h,
        "outer_w": outer_w,
        "outer_h": outer_h,
        "frame_x": metrics["x"],
        "frame_y": metrics["y"],
        "x": int(origin_x + metrics["x"]),
        "y": int(origin_y + metrics["y"]),
        "package_x": int(origin_x),
        "package_y": int(origin_y),
    }


def ffexpr(expression: str) -> str:
    return (
        expression.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace(",", "\\,")
        .replace("'", "\\'")
        .replace(";", "\\;")
    )


def time_token() -> str:
    return "if(isnan(t),0,t)"


def scale_expr(zooms: list[dict]) -> str:
    if not zooms:
        return "1"
    expression = "1"
    for zoom in reversed(zooms):
        start = float(zoom["start"])
        end = float(zoom["end"]) + float(zoom.get("exit") or 0)
        expression = f"if(between({time_token()},{start:.4f},{end:.4f}),{_progress_scale(zoom)},{expression})"
    return expression


def _ease_expr(preset: str, progress: str) -> str:
    if preset == "linear":
        return f"clip({progress},0,1)"
    if preset == "quadratic":
        return f"if(lt(clip({progress},0,1),0.5),2*pow(clip({progress},0,1),2),1-pow(-2*clip({progress},0,1)+2,2)/2)"
    if preset == "quintic":
        return f"if(lt(clip({progress},0,1),0.5),16*pow(clip({progress},0,1),5),1-pow(-2*clip({progress},0,1)+2,5)/2)"
    if preset == "spring":
        return f"(1-exp(-6*clip({progress},0,1))*cos(clip({progress},0,1)*PI*1.5))"
    return f"if(lt(clip({progress},0,1),0.5),4*pow(clip({progress},0,1),3),1-pow(-2*clip({progress},0,1)+2,3)/2)"


def _progress_expr(zoom: dict) -> str:
    start = float(zoom["start"])
    end = float(zoom["end"])
    enter = max(float(zoom.get("enter") or 0), 0)
    exit_ = max(float(zoom.get("exit") or 0), 0)
    preset = str(zoom.get("easing") or "cubic")
    clock = time_token()
    if enter > 0.001:
        entering = _ease_expr(preset, f"({clock}-{start:.4f})/{enter:.4f}")
    else:
        entering = "1"
    if exit_ > 0.001:
        leaving = f"(1-{_ease_expr(preset, f'({clock}-{end:.4f})/{exit_:.4f}')})"
    else:
        leaving = "0"
    hold_end = end
    enter_end = start + enter
    return (
        f"if(lt({clock},{enter_end:.4f}),{entering},"
        f"if(lte({clock},{hold_end:.4f}),1,{leaving}))"
    )


def _progress_scale(zoom: dict) -> str:
    amount = max(float(zoom.get("scale") or 1), 1) - 1
    return f"(1+({amount:.5f})*({_progress_expr(zoom)}))"


def focus_expr(zooms: list[dict], axis: str) -> str:
    key = "focus_x" if axis == "x" else "focus_y"
    expression = "0.5"
    for zoom in reversed(zooms):
        start = float(zoom["start"])
        end = float(zoom["end"]) + float(zoom.get("exit") or 0)
        focus = min(max(float(zoom.get(key, 0.5)), 0), 1)
        expression = f"if(between({time_token()},{start:.4f},{end:.4f}),{focus:.5f},{expression})"
    return expression


def framing_expr(zooms: list[dict]) -> str:
    expression = "0"
    for zoom in reversed(zooms):
        start = float(zoom["start"])
        end = float(zoom["end"]) + float(zoom.get("exit") or 0)
        expression = f"if(between({time_token()},{start:.4f},{end:.4f}),{_progress_expr(zoom)},{expression})"
    return expression


def axis_left_expr(scale: str, focus: str, framing: str) -> str:
    destination = f"clip({focus},0.3,0.7)"
    desired = f"({focus}+({destination}-{focus})*{framing})"
    scaled_point = f"(0.5+{scale}*({focus}-0.5))"
    translation = f"({desired}-{scaled_point})"
    low = f"(0.5-{scale}/2)"
    high = f"({scale}/2-0.5)"
    clamped = f"clip({translation},{low},{high})"
    return f"(0.5-(0.5+{clamped})/{scale})"


def crop_filter(zooms: list[dict], content_w: int, content_h: int) -> str:
    scale = scale_expr(zooms)
    framing = framing_expr(zooms)
    left = axis_left_expr(scale, focus_expr(zooms, "x"), framing)
    top = axis_left_expr(scale, focus_expr(zooms, "y"), framing)
    crop = (
        f"crop=w='{ffexpr(f'max(2,trunc(iw/({scale})/2)*2)')}':"
        f"h='{ffexpr(f'max(2,trunc(ih/({scale})/2)*2)')}':"
        f"x='{ffexpr(f'min(max(0,({left})*iw),iw-ow)')}':"
        f"y='{ffexpr(f'min(max(0,({top})*ih),ih-oh)')}'"
    )
    return f"{crop},scale={content_w}:{content_h}:flags=lanczos,setsar=1"


def atempo_chain(speed: float) -> str:
    factors: list[float] = []
    remaining = speed
    while remaining > 2.0 + 1e-6:
        factors.append(2.0)
        remaining /= 2
    while remaining < 0.5 - 1e-6:
        factors.append(0.5)
        remaining /= 0.5
    factors.append(remaining)
    return ",".join(f"atempo={factor:.5f}" for factor in factors)


def video_segments(clips: list[dict]) -> str:
    parts = []
    labels = []
    for index, clip in enumerate(clips):
        speed = min(max(float(clip.get("speed") or 1), 0.25), 4)
        label = f"v{index}"
        parts.append(
            f"[0:v]trim=start={float(clip['src_in']):.4f}:end={float(clip['src_out']):.4f},"
            f"setpts=(PTS-STARTPTS)/{speed:.5f}[{label}]"
        )
        labels.append(f"[{label}]")
    parts.append(f"{''.join(labels)}concat=n={len(clips)}:v=1:a=0[cat]")
    return ";".join(parts)


def cursor_step(events: list[dict], clips: list[dict], axis: str, size: int, hotspot: int) -> str:
    """Step function from timeline time to a source-pixel cursor coordinate."""
    samples = _timeline_pointer(events, clips)
    expression = str(-size)
    key = "x" if axis == "x" else "y"
    for sample_time, event in reversed(samples[-800:]):
        pixel = int(round(float(event[key]) * size - hotspot))
        expression = f"if(gte({time_token()},{sample_time:.3f}),{pixel},{expression})"
    return expression


def _timeline_pointer(events: list[dict], clips: list[dict]) -> list[tuple[float, dict]]:
    mapped = []
    cursor = 0.0
    for clip in clips:
        speed = max(float(clip.get("speed") or 1), 0.05)
        src_in = float(clip["src_in"])
        src_out = float(clip["src_out"])
        for event in events:
            moment = float(event.get("t", -1))
            if src_in - 1e-4 <= moment <= src_out + 1e-4:
                local = cursor + (moment - src_in) / speed
                mapped.append((local, event))
        cursor += clip_duration(clip)
    mapped.sort(key=lambda item: item[0])
    return mapped


def render_shadow(mask: Path, shadow: Path, alpha: float) -> None:
    """Blur the rounded mask once. A per-frame boxblur makes long exports slower than realtime."""
    amount = min(max(alpha, 0.05), 0.8)
    completed = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(mask),
            "-vf", f"format=rgba,colorchannelmixer=aa={amount:.3f},boxblur=18:2,format=rgba",
            "-frames:v", "1", "-pix_fmt", "rgba",
            str(shadow),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0 or not shadow.is_file():
        detail = [line.strip() for line in (completed.stderr or "").splitlines() if line.strip()]
        raise DogSCError(detail[-1] if detail else "无法生成画面阴影。")


def hex_color(value: str) -> str:
    text = (value or "#1c1c1f").strip()
    if not text.startswith("#"):
        text = f"#{text}"
    if len(text) != 7:
        text = "#1c1c1f"
    return "0x" + text[1:]


def build_export(project: dict, media: Path, pointer: list[dict], output: Path, work: Path) -> list[str]:
    info = project["media"]
    src_w = int(info["width"])
    src_h = int(info["height"])
    canvas = project.get("canvas") or {}
    cursor = project.get("cursor") or {}
    export = project.get("export") or {}
    fps = int(export.get("fps") or 30)
    crop = clamp_crop(canvas.get("crop"))
    cropped_w = max(even(src_w * float(crop["width"])), 2)
    cropped_h = max(even(src_h * float(crop["height"])), 2)
    crop_x = max(int(round(src_w * float(crop["x"]))), 0)
    crop_y = max(int(round(src_h * float(crop["y"]))), 0)
    crop_x = min(crop_x, max(src_w - cropped_w, 0))
    crop_y = min(crop_y, max(src_h - cropped_h, 0))
    canvas_w, canvas_h = canvas_size(cropped_w, cropped_h, str(canvas.get("aspect") or "source"), str(export.get("resolution") or "source"))
    frame_style = str(canvas.get("screen_frame") or "none")
    box = content_layout(
        cropped_w, cropped_h, canvas_w, canvas_h,
        float(canvas.get("padding") or 0),
        float(canvas.get("content_scale") or 1),
        float(canvas.get("content_x") if canvas.get("content_x") is not None else 0.5),
        float(canvas.get("content_y") if canvas.get("content_y") is not None else 0.5),
        frame_style,
        float(canvas.get("frame_scale") or 1),
        float(canvas.get("toolbar_scale") or 1),
    )
    zooms = absolute_zooms(project.get("clips") or [], project.get("zooms") or [])
    motions = absolute_timed(project.get("clips") or [], project.get("screen_motions") or [])
    mosaics = absolute_timed(project.get("clips") or [], project.get("mosaics") or [])
    stickers = absolute_timed(project.get("clips") or [], project.get("stickers") or [])
    radius = float(canvas.get("radius") or 0)
    shadow = float(canvas.get("shadow") or 0)
    border = float(canvas.get("border") or 0)
    asset = str(cursor.get("asset") or "system.arrow")
    draw_cursor = (
        bool(project.get("draw_cursor", True))
        and asset != "system.hidden"
        and not bool((project.get("capture") or {}).get("cursor_baked"))
        and bool(pointer)
    )
    work.mkdir(parents=True, exist_ok=True)

    inputs = ["-i", str(media)]
    next_input = 1
    cursor_index = mask_index = shadow_index = bg_index = frame_index = None
    sticker_inputs: list[tuple[int, dict]] = []

    if draw_cursor:
        cursor_path = work / "cursor.png"
        cursor_png(cursor_path, asset, float(cursor.get("size") or 1))
        inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(cursor_path)])
        cursor_index = next_input
        next_input += 1

    bg_path = work / "background.png"
    _render_background(bg_path, canvas, canvas_w, canvas_h)
    inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(bg_path)])
    bg_index = next_input
    next_input += 1

    use_mask = radius > 0 or shadow > 0 or border > 0 or frame_style != "none"
    if use_mask:
        mask_path = work / "mask.png"
        rounded_mask(mask_path, box["content_w"], box["content_h"], radius if radius > 0 else 0)
        inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(mask_path)])
        mask_index = next_input
        next_input += 1
        if shadow > 0:
            shadow_path = work / "shadow.png"
            render_shadow(mask_path, shadow_path, shadow)
            inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(shadow_path)])
            shadow_index = next_input
            next_input += 1

    if frame_style != "none":
        frame_path = work / "frame.png"
        render_frame(
            frame_path, frame_style, box["outer_w"], box["outer_h"], box["content_w"], box["content_h"],
            str(canvas.get("frame_title") or "DogSC"),
            str(canvas.get("frame_address") or "dogsc.app"),
            float(canvas.get("frame_scale") or 1),
            float(canvas.get("toolbar_scale") or 1),
        )
        inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(frame_path)])
        frame_index = next_input
        next_input += 1

    for sticker in stickers:
        source = media.parent / str(sticker.get("path") or "")
        if not source.is_file():
            continue
        inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(source)])
        sticker_inputs.append((next_input, sticker))
        next_input += 1

    graph = [video_segments(project["clips"])]
    current = "cat"
    if cursor_index is not None:
        hotspot_x = 2 if asset.startswith("system.arrow") or asset.endswith("hand") else 8
        hotspot_y = 1 if asset.startswith("system.arrow") else 8
        x_expr = ffexpr(cursor_step(pointer, project["clips"], "x", src_w, hotspot_x))
        y_expr = ffexpr(cursor_step(pointer, project["clips"], "y", src_h, hotspot_y))
        graph.append(
            f"[{current}][{cursor_index}:v]overlay=x='{x_expr}':y='{y_expr}':shortest=1:format=auto[withcursor]"
        )
        current = "withcursor"

    # Mosaics are applied in source space before zoom crop.
    for index, mosaic in enumerate(mosaics):
        label = f"mos{index}"
        next_label = f"mosout{index}"
        x = int(float(mosaic.get("x", 0.35)) * src_w)
        y = int(float(mosaic.get("y", 0.35)) * src_h)
        w = max(even(float(mosaic.get("width", 0.3)) * src_w), 2)
        h = max(even(float(mosaic.get("height", 0.25)) * src_h), 2)
        start = float(mosaic["start"])
        end = float(mosaic["end"])
        intensity = min(max(float(mosaic.get("intensity") or 0.55), 0.1), 1)
        blur = max(int(8 + 24 * intensity), 2)
        if mosaic.get("style") == "spotlight":
            dim = min(max(float(mosaic.get("dimming") or 0.22), 0), 0.8)
            graph.append(
                f"[{current}]split[msrc{index}][mdark{index}];"
                f"[mdark{index}]eq=brightness=-{dim:.3f}[mdim{index}];"
                f"[msrc{index}]crop={w}:{h}:{x}:{y},boxblur={blur}:2[mpatch{index}];"
                f"[mdim{index}][mpatch{index}]overlay=x={x}:y={y}:enable='between({time_token()},{start:.3f},{end:.3f})'[{next_label}]"
            )
        else:
            graph.append(
                f"[{current}]split[msrc{index}][mkeep{index}];"
                f"[msrc{index}]crop={w}:{h}:{x}:{y},boxblur={blur}:2[{label}];"
                f"[mkeep{index}][{label}]overlay=x={x}:y={y}:enable='between({time_token()},{start:.3f},{end:.3f})'[{next_label}]"
            )
        current = next_label

    # Source crop (canvas.crop) sits after mosaics and before zoom framing.
    if abs(float(crop["width"]) - 1.0) > 1e-4 or abs(float(crop["height"]) - 1.0) > 1e-4 or crop_x or crop_y:
        graph.append(
            f"[{current}]crop={cropped_w}:{cropped_h}:{crop_x}:{crop_y}[srccrop]"
        )
        current = "srccrop"

    motion_filter = screen_motion_filter(motions, box["content_w"], box["content_h"])
    graph.append(
        f"[{current}]fps={fps},{crop_filter(zooms, box['content_w'], box['content_h'])}"
        f"{motion_filter},format=rgba[framed]"
    )

    duration = max(sum(clip_duration(clip) for clip in project["clips"]), 0.1)
    opening = project.get("opening") or {}
    if opening.get("enabled"):
        graph.append(_opening_filter("framed", "opened", opening, duration, box["content_w"], box["content_h"]))
        current = "opened"
    else:
        current = "framed"

    graph.append(f"[{bg_index}:v]scale={canvas_w}:{canvas_h},format=rgba[bg]")
    base = "bg"
    if shadow_index is not None:
        graph.append(f"[{shadow_index}:v]format=rgba[shadowimg]")
        graph.append(
            f"[{base}][shadowimg]overlay=x={box['x'] + 10}:y={box['y'] + 16}:shortest=1[bgsh]"
        )
        base = "bgsh"

    if mask_index is not None:
        graph.append(f"[{mask_index}:v]scale={box['content_w']}:{box['content_h']},format=rgba[maska]")
        graph.append(f"[{current}][maska]alphamerge[fg]")
        current = "fg"
    graph.append(
        f"[{base}][{current}]overlay=x={box['x']}:y={box['y']}:shortest=1[placed]"
    )
    current = "placed"

    if border > 0 and mask_index is not None:
        border_color = hex_color(str(canvas.get("border_color") or "#ffffff"))
        bw = max(int(border), 1)
        graph.append(
            f"color=c={border_color}:s={box['content_w'] + bw * 2}x{box['content_h'] + bw * 2}:r={fps}:d={duration + 1:.3f},"
            f"format=rgba[borderfill];"
            f"[{mask_index}:v]scale={box['content_w'] + bw * 2}:{box['content_h'] + bw * 2},format=rgba[bordermask];"
            f"[borderfill][bordermask]alphamerge[border];"
            f"[{current}][border]overlay=x={box['x'] - bw}:y={box['y'] - bw}:shortest=1[bordered]"
        )
        current = "bordered"

    if frame_index is not None:
        graph.append(
            f"[{current}][{frame_index}:v]overlay=x={box['package_x']}:y={box['package_y']}:shortest=1:format=auto[framedui]"
        )
        current = "framedui"

    for index, (input_index, sticker) in enumerate(sticker_inputs):
        width = max(even(float(sticker.get("width") or 0.22) * box["content_w"]), 2)
        x = int(box["x"] + float(sticker.get("x") or 0.72) * box["content_w"])
        y = int(box["y"] + float(sticker.get("y") or 0.18) * box["content_h"])
        start = float(sticker["start"])
        end = float(sticker["end"])
        opacity = min(max(float(sticker.get("opacity") or 1), 0.05), 1)
        label = f"stk{index}"
        graph.append(
            f"[{input_index}:v]scale={width}:-1,format=rgba,colorchannelmixer=aa={opacity:.3f}[{label}];"
            f"[{current}][{label}]overlay=x={x}:y={y}:enable='between({time_token()},{start:.3f},{end:.3f})'[stout{index}]"
        )
        current = f"stout{index}"

    graph.append(
        f"[{current}]trim=duration={duration:.3f},setpts=PTS-STARTPTS,format=yuv420p[vout]"
    )
    maps = ["-map", "[vout]"]
    if info.get("has_audio"):
        graph.append(audio_segments(project["clips"], project.get("audio") or {}))
        maps.extend(["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"])
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        *inputs,
        "-filter_complex", ";".join(graph),
        *maps,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-r", str(fps),
        "-movflags", "+faststart",
        str(output),
    ]
    return command


def _render_background(path: Path, canvas: dict, width: int, height: int) -> None:
    kind = str(canvas.get("background_kind") or "solid")
    if kind == "pattern":
        pattern_png(
            path, width, height,
            str(canvas.get("pattern") or "obsidianGrid"),
            float(canvas.get("pattern_scale") or 1),
            float(canvas.get("pattern_opacity") or 1),
        )
        return
    if kind == "dynamic":
        dynamic_png(path, width, height, str(canvas.get("dynamic") or "auroraFluid"))
        return
    solid_color(path, width, height, str(canvas.get("background") or "#16161a"))


def absolute_timed(clips: list[dict], items: list[dict]) -> list[dict]:
    """Map clip-local timed items onto the absolute timeline, same as zooms."""
    offsets: dict[str, float] = {}
    cursor = 0.0
    for clip in clips:
        offsets[clip["id"]] = cursor
        cursor += clip_duration(clip)
    absolute: list[dict] = []
    for item in items:
        copied = dict(item)
        clip_id = item.get("clip_id")
        if clip_id:
            offset = offsets.get(str(clip_id))
            if offset is None:
                continue
            copied["start"] = float(item.get("start") or 0) + offset
            copied["end"] = float(item.get("end") or 0) + offset
        else:
            copied["start"] = float(item.get("start") or 0)
            copied["end"] = float(item.get("end") or 0)
        absolute.append(copied)
    absolute.sort(key=lambda row: (float(row["start"]), str(row.get("id"))))
    return absolute


def screen_motion_filter(motions: list[dict], content_w: int, content_h: int) -> str:
    if not motions:
        return ""
    # Keep a fixed canvas size so rounded masks and frames still align.
    expression = "0"
    for motion in reversed(motions):
        start = float(motion["start"])
        end = float(motion["end"]) + float(motion.get("exit") or 0)
        rot_z = float(motion.get("rotation_z") or 0) * 3.14159265 / 180
        rot_boost = (abs(float(motion.get("rotation_x") or 0)) + abs(float(motion.get("rotation_y") or 0))) * 0.004
        expression = f"if(between({time_token()},{start:.4f},{end:.4f}),{rot_z + rot_boost:.6f},{expression})"
    return f",rotate=a='{ffexpr(expression)}':ow={content_w}:oh={content_h}:c=none"


def _opening_filter(source: str, label: str, opening: dict, duration: float, content_w: int, content_h: int) -> str:
    length = min(max(float(opening.get("duration") or 1.4), 0.4), min(8.0, duration))
    preset = str(opening.get("preset") or "converge")
    # Keep export filters size-stable. Preview still does the richer CSS motion.
    if preset == "light3D":
        return (
            f"[{source}]rotate=a='(-0.12+0.12*min(1,{time_token()}/{length:.3f}))':"
            f"ow={content_w}:oh={content_h}:c=none,"
            f"fade=t=in:st=0:d={length:.3f}:alpha=1,format=rgba[{label}]"
        )
    return (
        f"[{source}]fade=t=in:st=0:d={length:.3f}:alpha=1,format=rgba[{label}]"
    )


def audio_segments(clips: list[dict], master: dict | None = None) -> str:
    master = master or {}
    system_volume = 0.0 if master.get("system_muted") else float(master.get("system_volume") or 1)
    parts = []
    labels = []
    for index, clip in enumerate(clips):
        speed = min(max(float(clip.get("speed") or 1), 0.25), 4)
        label = f"a{index}"
        local = clip.get("audio") or {}
        volume = system_volume
        if local.get("system_muted"):
            volume = 0.0
        elif "system_volume" in local:
            volume = float(local.get("system_volume") or volume)
        chain = (
            f"[0:a]atrim=start={float(clip['src_in']):.4f}:end={float(clip['src_out']):.4f},"
            f"asetpts=PTS-STARTPTS,volume={volume:.3f}"
        )
        if abs(speed - 1) > 0.001:
            chain += f",{atempo_chain(speed)}"
        parts.append(f"{chain}[{label}]")
        labels.append(f"[{label}]")
    parts.append(f"{''.join(labels)}concat=n={len(clips)}:v=0:a=1[aout]")
    return ";".join(parts)


def preview_sample(project: dict, time: float) -> dict[str, float]:
    zooms = absolute_zooms(project.get("clips") or [], project.get("zooms") or [])
    sampled = sample(zooms, time)
    frame = viewport(sampled["scale"], sampled["focus_x"], sampled["focus_y"], sampled["framing"])
    motion = {"rotation_x": 0.0, "rotation_y": 0.0, "rotation_z": 0.0, "perspective": 0.65, "scale": 1.0}
    for item in absolute_timed(project.get("clips") or [], project.get("screen_motions") or []):
        start = float(item["start"])
        end = float(item["end"]) + float(item.get("exit") or 0)
        if start <= time <= end:
            motion = {
                "rotation_x": float(item.get("rotation_x") or 0),
                "rotation_y": float(item.get("rotation_y") or 0),
                "rotation_z": float(item.get("rotation_z") or 0),
                "perspective": float(item.get("perspective") or 0.65),
                "scale": float(item.get("scale") or 1),
            }
            break
    return {**sampled, **frame, "motion": motion}


def estimate_export(project: dict, media: Path | None = None) -> dict:
    """Rough byte/size estimate for the Soft Silver export sheet."""
    canvas = project.get("canvas") or {}
    export = project.get("export") or {}
    clips = project.get("clips") or []
    duration = max(sum(clip_duration(clip) for clip in clips), 0.1)
    fps = int(export.get("fps") or 30)
    src_w = src_h = 1920
    if media and Path(media).is_file():
        try:
            info = probe(Path(media))
            src_w = int(info["width"] or src_w)
            src_h = int(info["height"] or src_h)
        except Exception:
            pass
    else:
        media_info = project.get("media") or {}
        src_w = int(media_info.get("width") or src_w)
        src_h = int(media_info.get("height") or src_h)
    crop = clamp_crop(canvas.get("crop"))
    cropped_w = max(even(src_w * float(crop["width"])), 2)
    cropped_h = max(even(src_h * float(crop["height"])), 2)
    width, height = canvas_size(
        cropped_w,
        cropped_h,
        str(canvas.get("aspect") or "source"),
        str(export.get("resolution") or "1080p"),
    )
    megapixels = (width * height) / 1_000_000
    # Soft H.264-ish bitrate curve used only for UI sizing, not encoding.
    mbps = max(2.5, min(28.0, 3.2 + megapixels * 2.4)) * (fps / 30)
    audio_mbps = 0.16
    bytes_est = int((mbps + audio_mbps) * 1_000_000 / 8 * duration)
    return {
        "width": width,
        "height": height,
        "fps": fps,
        "duration": duration,
        "megabits_per_second": round(mbps + audio_mbps, 2),
        "bytes": bytes_est,
    }
