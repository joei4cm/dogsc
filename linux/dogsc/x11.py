from __future__ import annotations

import ctypes
import threading
import time

from dogsc.errors import DogSCError


Button1Mask = 1 << 8
Button3Mask = 1 << 10
ButtonPress = 4
ButtonRelease = 5
MotionNotify = 6
ButtonPressMask = 1 << 2
ButtonReleaseMask = 1 << 3
PointerMotionMask = 1 << 6
GrabModeAsync = 1
GXxor = 0x6
IncludeInferiors = 1


class XEvent(ctypes.Union):
    _fields_ = [("type", ctypes.c_int), ("pad", ctypes.c_long * 24)]


class XButtonEvent(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_int),
        ("serial", ctypes.c_ulong),
        ("send_event", ctypes.c_int),
        ("display", ctypes.c_void_p),
        ("window", ctypes.c_ulong),
        ("root", ctypes.c_ulong),
        ("subwindow", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("x", ctypes.c_int),
        ("y", ctypes.c_int),
        ("x_root", ctypes.c_int),
        ("y_root", ctypes.c_int),
        ("state", ctypes.c_uint),
        ("button", ctypes.c_uint),
        ("same_screen", ctypes.c_int),
    ]


class _X11:
    def __init__(self, display_name: str | None):
        self.lib = ctypes.cdll.LoadLibrary("libX11.so.6")
        self.lib.XOpenDisplay.argtypes = [ctypes.c_char_p]
        self.lib.XOpenDisplay.restype = ctypes.c_void_p
        self.lib.XCloseDisplay.argtypes = [ctypes.c_void_p]
        self.lib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
        self.lib.XDefaultRootWindow.restype = ctypes.c_ulong
        self.lib.XDisplayWidth.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.lib.XDisplayWidth.restype = ctypes.c_int
        self.lib.XDisplayHeight.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.lib.XDisplayHeight.restype = ctypes.c_int
        self.lib.XDefaultScreen.argtypes = [ctypes.c_void_p]
        self.lib.XDefaultScreen.restype = ctypes.c_int
        self.lib.XWhitePixel.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.lib.XWhitePixel.restype = ctypes.c_ulong
        self.lib.XCreateGC.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p]
        self.lib.XCreateGC.restype = ctypes.c_void_p
        self.lib.XFreeGC.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        self.lib.XSetFunction.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        self.lib.XSetForeground.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
        self.lib.XSetSubwindowMode.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        self.lib.XDrawRectangle.argtypes = [
            ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p,
            ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint,
        ]
        self.lib.XFlush.argtypes = [ctypes.c_void_p]
        self.lib.XPending.argtypes = [ctypes.c_void_p]
        self.lib.XPending.restype = ctypes.c_int
        self.lib.XNextEvent.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        self.lib.XGrabPointer.argtypes = [
            ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_uint,
            ctypes.c_int, ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong,
        ]
        self.lib.XGrabPointer.restype = ctypes.c_int
        self.lib.XUngrabPointer.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        self.lib.XQueryPointer.argtypes = [
            ctypes.c_void_p, ctypes.c_ulong,
            ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_ulong),
            ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_uint),
        ]
        self.lib.XQueryPointer.restype = ctypes.c_int
        name = None if not display_name else display_name.encode()
        self.display = self.lib.XOpenDisplay(name)
        if not self.display:
            raise DogSCError("打不开 X11 显示。确认当前会话有 DISPLAY。")
        self.root = self.lib.XDefaultRootWindow(self.display)
        self.screen = self.lib.XDefaultScreen(self.display)

    def close(self) -> None:
        if self.display:
            self.lib.XCloseDisplay(self.display)
            self.display = None

    def pointer(self) -> tuple[int, int, int]:
        root = ctypes.c_ulong()
        child = ctypes.c_ulong()
        root_x = ctypes.c_int()
        root_y = ctypes.c_int()
        win_x = ctypes.c_int()
        win_y = ctypes.c_int()
        mask = ctypes.c_uint()
        ok = self.lib.XQueryPointer(
            self.display, self.root,
            ctypes.byref(root), ctypes.byref(child),
            ctypes.byref(root_x), ctypes.byref(root_y),
            ctypes.byref(win_x), ctypes.byref(win_y),
            ctypes.byref(mask),
        )
        if not ok:
            raise DogSCError("读不到鼠标位置。")
        return int(root_x.value), int(root_y.value), int(mask.value)

    def size(self) -> tuple[int, int]:
        return (
            int(self.lib.XDisplayWidth(self.display, self.screen)),
            int(self.lib.XDisplayHeight(self.display, self.screen)),
        )


def query_pointer(display_name: str | None) -> tuple[int, int, int]:
    connection = _X11(display_name)
    try:
        return connection.pointer()
    finally:
        connection.close()


class PointerSampler:
    """Sample the X11 pointer on a background thread while a recording runs."""

    def __init__(self, display_name: str | None, geometry: dict, interval: float = 0.02):
        self.display_name = display_name
        self.geometry = geometry
        self.interval = interval
        self.events: list[dict] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._started = 0.0

    def start(self) -> None:
        self._started = time.monotonic()
        self._thread = threading.Thread(target=self._run, name="dogsc-pointer", daemon=True)
        self._thread.start()

    def stop(self) -> list[dict]:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        return self.events

    def _run(self) -> None:
        try:
            connection = _X11(self.display_name)
        except DogSCError:
            return
        previous = None
        buttons = 0
        try:
            while not self._stop.is_set():
                try:
                    x, y, mask = connection.pointer()
                except DogSCError:
                    break
                now = time.monotonic() - self._started
                point = _normalize(x, y, self.geometry)
                pressed = mask & (Button1Mask | Button3Mask)
                kind = None
                if point is not None and pressed & Button1Mask and not buttons & Button1Mask:
                    kind = "left"
                elif point is not None and pressed & Button3Mask and not buttons & Button3Mask:
                    kind = "right"
                elif point is not None and (
                    previous is None
                    or abs(point[0] - previous[0]) > 0.002
                    or abs(point[1] - previous[1]) > 0.002
                ):
                    kind = "move"
                if kind and point is not None:
                    self.events.append({"t": round(now, 4), "x": round(point[0], 5), "y": round(point[1], 5), "kind": kind})
                    previous = point
                buttons = pressed
                self._stop.wait(self.interval)
        finally:
            connection.close()


def _normalize(x: int, y: int, geometry: dict) -> tuple[float, float] | None:
    width = max(int(geometry["width"]), 1)
    height = max(int(geometry["height"]), 1)
    local_x = (x - int(geometry["x"])) / width
    local_y = (y - int(geometry["y"])) / height
    if local_x < -0.05 or local_y < -0.05 or local_x > 1.05 or local_y > 1.05:
        return None
    return (min(max(local_x, 0.0), 1.0), min(max(local_y, 0.0), 1.0))


def pick_region(display_name: str | None, timeout: float = 30) -> dict:
    """Drag on the root window. The rectangle is returned in screen pixels."""
    connection = _X11(display_name)
    try:
        grabbed = connection.lib.XGrabPointer(
            connection.display,
            connection.root,
            0,
            ButtonPressMask | ButtonReleaseMask | PointerMotionMask,
            GrabModeAsync,
            GrabModeAsync,
            connection.root,
            0,
            0,
        )
        if grabbed != 0:
            raise DogSCError("没法独占鼠标来框选区域。")
        gc = connection.lib.XCreateGC(connection.display, connection.root, 0, None)
        connection.lib.XSetFunction(connection.display, gc, GXxor)
        connection.lib.XSetSubwindowMode(connection.display, gc, IncludeInferiors)
        connection.lib.XSetForeground(
            connection.display,
            gc,
            connection.lib.XWhitePixel(connection.display, connection.screen),
        )
        deadline = time.monotonic() + timeout
        origin = None
        drawn = None
        event = XEvent()
        try:
            while time.monotonic() < deadline:
                while connection.lib.XPending(connection.display):
                    connection.lib.XNextEvent(connection.display, ctypes.byref(event))
                    button = ctypes.cast(ctypes.byref(event), ctypes.POINTER(XButtonEvent)).contents
                    if event.type == ButtonPress and button.button == 1:
                        origin = (int(button.x_root), int(button.y_root))
                    elif event.type == MotionNotify and origin is not None:
                        _redraw(connection, gc, drawn)
                        drawn = _rect(origin, (int(button.x_root), int(button.y_root)))
                        _redraw(connection, gc, drawn)
                    elif event.type == ButtonRelease and button.button == 1 and origin is not None:
                        _redraw(connection, gc, drawn)
                        drawn = None
                        rect = _rect(origin, (int(button.x_root), int(button.y_root)))
                        if rect["width"] < 16 or rect["height"] < 16:
                            raise DogSCError("选区太小。")
                        return rect
                time.sleep(0.01)
            raise DogSCError("等待框选超时。")
        finally:
            if drawn:
                _redraw(connection, gc, drawn)
            connection.lib.XUngrabPointer(connection.display, 0)
            connection.lib.XFreeGC(connection.display, gc)
            connection.lib.XFlush(connection.display)
    finally:
        connection.close()


def _rect(origin: tuple[int, int], current: tuple[int, int]) -> dict:
    x1, y1 = origin
    x2, y2 = current
    width = max(abs(x2 - x1), 2)
    height = max(abs(y2 - y1), 2)
    return {
        "x": min(x1, x2),
        "y": min(y1, y2),
        "width": width - width % 2,
        "height": height - height % 2,
    }


def _redraw(connection: _X11, gc, rect: dict | None) -> None:
    if not rect:
        return
    connection.lib.XDrawRectangle(
        connection.display,
        connection.root,
        gc,
        int(rect["x"]),
        int(rect["y"]),
        int(max(rect["width"], 1)),
        int(max(rect["height"], 1)),
    )
    connection.lib.XFlush(connection.display)
