from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
import os
import re
import shutil
import subprocess


@dataclass
class Toolchain:
    ffmpeg: bool = False
    ffprobe: bool = False
    x11grab: bool = False
    ffmpeg_pipewire: bool = False
    pactl: bool = False
    wf_recorder: bool = False
    slurp: bool = False
    hyprctl: bool = False
    gst_pipewire: bool = False
    portal: bool = False

    def as_dict(self) -> dict[str, bool]:
        return asdict(self)


@dataclass
class Desktop:
    family: str
    os_name: str
    os_version: str
    session: str
    compositor: str
    backend: str | None
    tools: Toolchain
    microphone: str | None = None
    system_audio: str | None = None
    hints: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["tools"] = self.tools.as_dict()
        payload["backend_label"] = backend_label(self.backend, self.family, self.compositor)
        return payload


def parse_os_release(text: str) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key] = value.strip().strip('"').strip("'")
    return data


def family_of(os_release: dict[str, str], home: Path, extra_paths: list[Path] | None = None) -> str:
    identity = " ".join(
        os_release.get(key, "")
        for key in ("ID", "NAME", "ID_LIKE", "PRETTY_NAME")
    ).lower()
    markers = [home / ".local" / "share" / "omarchy", Path("/usr/share/omarchy")]
    if extra_paths:
        markers.extend(extra_paths)
    if "omarchy" in identity or any(path.exists() for path in markers):
        return "omarchy"
    if os_release.get("ID") == "ubuntu" or "ubuntu" in os_release.get("ID_LIKE", "").lower() or "ubuntu" in identity:
        return "ubuntu"
    return "linux"


def session_of(env: dict[str, str]) -> str:
    declared = env.get("XDG_SESSION_TYPE", "").lower()
    if declared in {"wayland", "x11", "tty"}:
        if declared == "tty" and env.get("DISPLAY"):
            return "x11"
        return declared
    if env.get("WAYLAND_DISPLAY"):
        return "wayland"
    if env.get("DISPLAY"):
        return "x11"
    return "unknown"


def compositor_of(env: dict[str, str]) -> str:
    blob = " ".join(
        env.get(key, "")
        for key in (
            "XDG_CURRENT_DESKTOP",
            "XDG_SESSION_DESKTOP",
            "DESKTOP_SESSION",
            "HYPRLAND_INSTANCE_SIGNATURE",
        )
    ).lower()
    if "hyprland" in blob or env.get("HYPRLAND_INSTANCE_SIGNATURE"):
        return "hyprland"
    if "kde" in blob or "plasma" in blob:
        return "kde"
    if "gnome" in blob or "ubuntu" in blob or "unity" in blob:
        return "gnome"
    if "sway" in blob:
        return "sway"
    return "other"


def choose_backend(session: str, compositor: str, tools: Toolchain) -> str | None:
    """Pick the capture path that actually sees this desktop.

    Hyprland (Omarchy) prefers wf-recorder. GNOME Wayland needs the
    screen-cast portal plus a PipeWire consumer. X11, including Ubuntu on
    Xorg, is captured directly by ffmpeg.
    """
    portal_ready = tools.portal and (tools.ffmpeg_pipewire or tools.gst_pipewire)
    if session == "wayland" and compositor == "hyprland" and tools.wf_recorder:
        return "hyprland"
    if session == "wayland" and portal_ready:
        return "portal"
    if session == "x11" and tools.x11grab:
        return "x11"
    if session == "wayland" and tools.wf_recorder and compositor in {"hyprland", "sway", "other"}:
        return "hyprland"
    if portal_ready:
        return "portal"
    if session != "wayland" and tools.x11grab:
        return "x11"
    return None


def backend_label(backend: str | None, family: str, compositor: str) -> str:
    if backend == "x11":
        return "X11 · ffmpeg"
    if backend == "hyprland":
        if family == "omarchy" or compositor == "hyprland":
            return "Hyprland · wf-recorder"
        return "Wayland · wf-recorder"
    if backend == "portal":
        return "xdg-desktop-portal · PipeWire"
    return "不可用"


def explain(desktop: Desktop) -> list[str]:
    hints: list[str] = []
    if not desktop.tools.ffmpeg or not desktop.tools.ffprobe:
        hints.append("需要安装 ffmpeg（包含 ffprobe）才能录制和导出。")
    if desktop.backend == "x11":
        hints.append("当前是 X11 会话，屏幕由 ffmpeg 的 x11grab 直接抓取。Ubuntu on Xorg 走这条路径。")
    elif desktop.backend == "hyprland":
        hints.append("Hyprland 使用 wf-recorder。Omarchy 与其他 wlroots 桌面共用这条路径。")
        if not desktop.tools.slurp:
            hints.append("区域录制需要 slurp。Omarchy 上可安装 slurp 后再选区域。")
        hints.append("标记快捷键可绑成：bind = CTRL ALT, M, exec, dogsc mark")
    elif desktop.backend == "portal":
        consumer = "ffmpeg" if desktop.tools.ffmpeg_pipewire else "GStreamer"
        hints.append(f"Wayland 通过 xdg-desktop-portal 共享屏幕，并由 {consumer} 写入文件。开始录制时系统会询问要共享的画面。")
    elif desktop.session == "wayland":
        if desktop.compositor == "hyprland":
            hints.append("Omarchy / Hyprland 需要 wf-recorder。Arch 上执行：sudo pacman -S wf-recorder slurp")
        else:
            hints.append("Ubuntu Wayland 需要能读取 PipeWire 的采集器。安装 gstreamer1.0-pipewire，或在登录界面改用 Ubuntu on Xorg。")
    elif desktop.session == "x11" and not desktop.tools.x11grab:
        hints.append("ffmpeg 没有编入 x11grab，无法在这份 X11 会话里抓屏。")
    if desktop.backend and not desktop.system_audio:
        hints.append("没有找到系统声音的监听源。PipeWire 或 PulseAudio 就绪后可以同时录系统声音和麦克风。")
    if desktop.family == "omarchy" and desktop.backend != "hyprland" and desktop.session != "wayland":
        hints.append("Omarchy 通常运行在 Hyprland 上。当前会话不是 Wayland，录制会退回到能用的捕获方式。")
    return hints


def parse_pactl_sources(text: str) -> list[str]:
    names: list[str] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].isdigit():
            names.append(parts[1])
    return names


def classify_audio(sources: list[str], default_source: str | None, default_sink: str | None) -> tuple[str | None, str | None]:
    system = f"{default_sink}.monitor" if default_sink else None
    if system not in sources:
        system = next((name for name in sources if name.endswith(".monitor")), None)
    microphone = default_source if default_source and not default_source.endswith(".monitor") else None
    if microphone not in sources:
        microphone = next((name for name in sources if not name.endswith(".monitor")), None)
    return microphone, system


def load_os_release(path: Path = Path("/etc/os-release")) -> dict[str, str]:
    try:
        return parse_os_release(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def ffmpeg_devices() -> str:
    if not command_exists("ffmpeg"):
        return ""
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-devices"],
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def portal_is_running() -> bool:
    if not command_exists("busctl"):
        return False
    completed = subprocess.run(
        ["busctl", "--user", "status", "org.freedesktop.portal.Desktop"],
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.returncode == 0


def gstreamer_has_pipewire() -> bool:
    if not command_exists("gst-inspect-1.0"):
        return False
    completed = subprocess.run(
        ["gst-inspect-1.0", "pipewiresrc"],
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.returncode == 0


def detect_toolchain(device_text: str | None = None) -> Toolchain:
    devices = ffmpeg_devices() if device_text is None else device_text
    return Toolchain(
        ffmpeg=command_exists("ffmpeg"),
        ffprobe=command_exists("ffprobe"),
        x11grab=bool(re.search(r"\bx11grab\b", devices)),
        ffmpeg_pipewire=bool(re.search(r"\bpipewire\b", devices)),
        pactl=command_exists("pactl"),
        wf_recorder=command_exists("wf-recorder"),
        slurp=command_exists("slurp"),
        hyprctl=command_exists("hyprctl"),
        gst_pipewire=gstreamer_has_pipewire(),
        portal=portal_is_running(),
    )


def detect_audio(tools: Toolchain) -> tuple[str | None, str | None]:
    if not tools.pactl:
        return None, None
    sources = subprocess.run(["pactl", "list", "short", "sources"], check=False, capture_output=True, text=True)
    default_source = subprocess.run(["pactl", "get-default-source"], check=False, capture_output=True, text=True)
    default_sink = subprocess.run(["pactl", "get-default-sink"], check=False, capture_output=True, text=True)
    return classify_audio(
        parse_pactl_sources(sources.stdout),
        default_source.stdout.strip() or None,
        default_sink.stdout.strip() or None,
    )


def detect(env: dict[str, str] | None = None, home: Path | None = None) -> Desktop:
    environment = os.environ if env is None else env
    home_path = home or Path(environment.get("HOME", str(Path.home())))
    os_release = load_os_release()
    tools = detect_toolchain()
    desktop = Desktop(
        family=family_of(os_release, home_path),
        os_name=os_release.get("PRETTY_NAME") or os_release.get("NAME") or "Linux",
        os_version=os_release.get("VERSION_ID", ""),
        session=session_of(environment),
        compositor=compositor_of(environment),
        backend=None,
        tools=tools,
    )
    desktop.backend = choose_backend(desktop.session, desktop.compositor, tools)
    desktop.microphone, desktop.system_audio = detect_audio(tools)
    desktop.hints = explain(desktop)
    return desktop
