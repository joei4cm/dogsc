from __future__ import annotations

from pathlib import Path
import subprocess

from dogsc.errors import DogSCError
from dogsc.media import cursor_png, rounded_mask
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


def content_layout(src_w: int, src_h: int, canvas_w: int, canvas_h: int, padding: float) -> dict[str, int]:
    padding = min(max(padding, 0.0), 0.3)
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
    content_w = even(content_w)
    content_h = even(content_h)
    return {
        "content_w": content_w,
        "content_h": content_h,
        "x": int((canvas_w - content_w) / 2),
        "y": int((canvas_h - content_h) / 2),
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


def audio_segments(clips: list[dict]) -> str:
    parts = []
    labels = []
    for index, clip in enumerate(clips):
        speed = min(max(float(clip.get("speed") or 1), 0.25), 4)
        label = f"a{index}"
        chain = (
            f"[0:a]atrim=start={float(clip['src_in']):.4f}:end={float(clip['src_out']):.4f},"
            f"asetpts=PTS-STARTPTS"
        )
        if abs(speed - 1) > 0.001:
            chain += f",{atempo_chain(speed)}"
        parts.append(f"{chain}[{label}]")
        labels.append(f"[{label}]")
    parts.append(f"{''.join(labels)}concat=n={len(clips)}:v=0:a=1[aout]")
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
    export = project.get("export") or {}
    fps = int(export.get("fps") or 30)
    canvas_w, canvas_h = canvas_size(src_w, src_h, str(canvas.get("aspect") or "source"), str(export.get("resolution") or "source"))
    box = content_layout(src_w, src_h, canvas_w, canvas_h, float(canvas.get("padding") or 0))
    zooms = absolute_zooms(project.get("clips") or [], project.get("zooms") or [])
    radius = float(canvas.get("radius") or 0)
    shadow = float(canvas.get("shadow") or 0)
    draw_cursor = bool(project.get("draw_cursor", True)) and not bool((project.get("capture") or {}).get("cursor_baked")) and bool(pointer)
    work.mkdir(parents=True, exist_ok=True)

    inputs = ["-i", str(media)]
    next_input = 1
    cursor_index = None
    mask_index = None
    shadow_index = None
    if draw_cursor:
        cursor_path = work / "cursor.png"
        cursor_png(cursor_path)
        inputs.extend(["-loop", "1", "-framerate", str(fps), "-i", str(cursor_path)])
        cursor_index = next_input
        next_input += 1
    use_mask = radius > 0 or shadow > 0
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

    graph = [video_segments(project["clips"])]
    current = "cat"
    if cursor_index is not None:
        x_expr = ffexpr(cursor_step(pointer, project["clips"], "x", src_w, 2))
        y_expr = ffexpr(cursor_step(pointer, project["clips"], "y", src_h, 1))
        graph.append(
            f"[{current}][{cursor_index}:v]overlay=x='{x_expr}':y='{y_expr}':shortest=1:format=auto[withcursor]"
        )
        current = "withcursor"
    graph.append(f"[{current}]fps={fps},{crop_filter(zooms, box['content_w'], box['content_h'])},format=rgba[framed]")
    color = hex_color(str(canvas.get("background") or "#1c1c1f"))
    duration = max(sum(clip_duration(clip) for clip in project["clips"]), 0.1)
    if use_mask and mask_index is not None:
        graph.append(f"color=c={color}:s={canvas_w}x{canvas_h}:r={fps}:d={duration + 1:.3f},format=rgba[bg]")
        base = "bg"
        graph.append(
            f"[{mask_index}:v]scale={box['content_w']}:{box['content_h']},format=rgba[maska]"
        )
        if shadow_index is not None:
            graph.append(f"[{shadow_index}:v]format=rgba[shadowimg]")
            graph.append(
                f"[{base}][shadowimg]overlay=x={box['x'] + 10}:y={box['y'] + 16}:shortest=1[bgsh]"
            )
            base = "bgsh"
        graph.append("[framed][maska]alphamerge[fg]")
        graph.append(
            f"[{base}][fg]overlay=x={box['x']}:y={box['y']}:shortest=1,"
            f"trim=duration={duration:.3f},setpts=PTS-STARTPTS,format=yuv420p[vout]"
        )
    else:
        graph.append(
            f"[framed]pad={canvas_w}:{canvas_h}:{box['x']}:{box['y']}:color={color},"
            f"trim=duration={duration:.3f},setpts=PTS-STARTPTS,format=yuv420p[vout]"
        )
    maps = ["-map", "[vout]"]
    if info.get("has_audio"):
        graph.append(audio_segments(project["clips"]))
        maps.extend(["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"])
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


def preview_sample(project: dict, time: float) -> dict[str, float]:
    zooms = absolute_zooms(project.get("clips") or [], project.get("zooms") or [])
    sampled = sample(zooms, time)
    frame = viewport(sampled["scale"], sampled["focus_x"], sampled["focus_y"], sampled["framing"])
    return {**sampled, **frame}
