"""Pointer trajectory samplers for Soft Silver capture (G06).

Apple feeds CGEvent. On Linux we prefer libinput when `/dev/input` is
readable, then fall back to the X11 PointerSampler. Wayland portal
remote-desktop pointer injection remains a future compositor path — this
module closes the "X11 only" gap for local sessions.
"""

from __future__ import annotations

import glob
import os
import struct
import threading
import time
from typing import Callable

from dogsc.errors import DogSCError

# linux/input.h
EV_KEY = 0x01
EV_REL = 0x02
EV_ABS = 0x03
BTN_LEFT = 0x110
BTN_RIGHT = 0x111
REL_X = 0x00
REL_Y = 0x01
ABS_X = 0x00
ABS_Y = 0x01
ABS_MT_POSITION_X = 0x35
ABS_MT_POSITION_Y = 0x36

# input_event: long sec, long usec, uint16 type, uint16 code, int32 value
_EVENT_FMT = "llHHi"
_EVENT_SIZE = struct.calcsize(_EVENT_FMT)


def _normalize(x: float, y: float, geometry: dict) -> tuple[float, float] | None:
    width = max(int(geometry["width"]), 1)
    height = max(int(geometry["height"]), 1)
    local_x = (x - int(geometry["x"])) / width
    local_y = (y - int(geometry["y"])) / height
    if local_x < -0.05 or local_y < -0.05 or local_x > 1.05 or local_y > 1.05:
        return None
    return (min(max(local_x, 0.0), 1.0), min(max(local_y, 0.0), 1.0))


class LibinputPointerSampler:
    """Read EV_REL / EV_ABS mouse nodes under /dev/input.

    Does not require the libinput shared library — the kernel evdev ABI is
    enough for trajectory capture. Needs read access to event devices
    (input group or root).
    """

    def __init__(self, geometry: dict, interval: float = 0.01):
        self.geometry = geometry
        self.interval = interval
        self.events: list[dict] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._started = 0.0
        self.backend = "libinput-evdev"

    @staticmethod
    def available() -> bool:
        for path in sorted(glob.glob("/dev/input/event*")):
            if os.access(path, os.R_OK):
                return True
        return False

    def start(self) -> None:
        self._started = time.monotonic()
        self._thread = threading.Thread(target=self._run, name="dogsc-libinput", daemon=True)
        self._thread.start()

    def stop(self) -> list[dict]:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        return self.events

    def _open_devices(self) -> list[tuple[str, int]]:
        opened: list[tuple[str, int]] = []
        for path in sorted(glob.glob("/dev/input/event*")):
            try:
                fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
            except OSError:
                continue
            opened.append((path, fd))
        return opened

    def _run(self) -> None:
        devices = self._open_devices()
        if not devices:
            return
        # Seed position at geometry centre so REL streams have an origin.
        x = float(self.geometry["x"]) + float(self.geometry["width"]) / 2.0
        y = float(self.geometry["y"]) + float(self.geometry["height"]) / 2.0
        buttons = 0
        previous = None
        try:
            while not self._stop.is_set():
                moved = False
                pressed_edge = None
                for _path, fd in devices:
                    while True:
                        try:
                            raw = os.read(fd, _EVENT_SIZE)
                        except BlockingIOError:
                            break
                        except OSError:
                            break
                        if len(raw) < _EVENT_SIZE:
                            break
                        _sec, _usec, etype, code, value = struct.unpack(_EVENT_FMT, raw)
                        if etype == EV_REL:
                            if code == REL_X:
                                x += value
                                moved = True
                            elif code == REL_Y:
                                y += value
                                moved = True
                        elif etype == EV_ABS:
                            if code in (ABS_X, ABS_MT_POSITION_X):
                                x = float(self.geometry["x"]) + value
                                moved = True
                            elif code in (ABS_Y, ABS_MT_POSITION_Y):
                                y = float(self.geometry["y"]) + value
                                moved = True
                        elif etype == EV_KEY and code in (BTN_LEFT, BTN_RIGHT):
                            bit = 1 if code == BTN_LEFT else 2
                            if value and not (buttons & bit):
                                pressed_edge = "left" if code == BTN_LEFT else "right"
                            if value:
                                buttons |= bit
                            else:
                                buttons &= ~bit
                now = time.monotonic() - self._started
                point = _normalize(x, y, self.geometry)
                kind = None
                if pressed_edge and point is not None:
                    kind = pressed_edge
                elif moved and point is not None and (
                    previous is None
                    or abs(point[0] - previous[0]) > 0.002
                    or abs(point[1] - previous[1]) > 0.002
                ):
                    kind = "move"
                if kind and point is not None:
                    self.events.append(
                        {
                            "t": round(now, 4),
                            "x": round(point[0], 5),
                            "y": round(point[1], 5),
                            "kind": kind,
                        }
                    )
                    previous = point
                self._stop.wait(self.interval)
        finally:
            for _path, fd in devices:
                try:
                    os.close(fd)
                except OSError:
                    pass


def make_pointer_sampler(display_name: str | None, geometry: dict, backend: str | None = None):
    """Pick the best available sampler for this session.

    Order: explicit backend → portal RemoteDesktop (Wayland) → libinput-evdev
    → X11 PointerSampler.
    """
    wanted = (backend or os.environ.get("DOGSC_POINTER_BACKEND") or "").strip().lower()

    if wanted in {"portal", "portal-rd", "remotedesktop"}:
        from dogsc.portal_pointer import PortalRemoteDesktopSampler

        if not PortalRemoteDesktopSampler.available():
            raise DogSCError("当前会话没有 xdg-desktop-portal RemoteDesktop。")
        return PortalRemoteDesktopSampler(geometry)

    if wanted in {"libinput", "libinput-evdev", "evdev"}:
        if LibinputPointerSampler.available():
            return LibinputPointerSampler(geometry)
        raise DogSCError("没有可读的 /dev/input/event*（需要 input 组权限）。")

    if wanted in {"x11", "xorg"}:
        from dogsc.x11 import PointerSampler

        return PointerSampler(display_name or os.environ.get("DISPLAY"), geometry)

    # Auto: prefer local libinput, then X11, then portal RD on Wayland.
    if LibinputPointerSampler.available():
        return LibinputPointerSampler(geometry)

    if display_name or os.environ.get("DISPLAY"):
        from dogsc.x11 import PointerSampler

        return PointerSampler(display_name or os.environ.get("DISPLAY"), geometry)

    try:
        from dogsc.portal_pointer import PortalRemoteDesktopSampler

        if PortalRemoteDesktopSampler.available():
            return PortalRemoteDesktopSampler(geometry)
    except Exception:
        pass

    raise DogSCError(
        "没有可用的指针采样后端（需要 libinput 设备权限、X11 DISPLAY，或 portal RemoteDesktop）。"
    )
