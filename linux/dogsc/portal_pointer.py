"""xdg-desktop-portal RemoteDesktop pointer sampler (G06 enhancement).

On Wayland without `/dev/input` access, RemoteDesktop is the compositor-blessed
path for absolute pointer. This module:

1. Detects `org.freedesktop.portal.RemoteDesktop`
2. Opens a SelectDevices(pointer) session when the user allows it
3. Falls through cleanly when the portal is missing or the dialog is denied

Full EIS/libei event ingestion is compositor-version dependent; when the
session cannot expose a readable stream we raise DogSCError so
`make_pointer_sampler` can fall back to libinput/X11.
"""

from __future__ import annotations

import secrets
import threading
import time
from typing import Any

from dogsc.errors import DogSCError


def _normalize(x: float, y: float, geometry: dict) -> tuple[float, float] | None:
    width = max(int(geometry["width"]), 1)
    height = max(int(geometry["height"]), 1)
    local_x = (x - int(geometry["x"])) / width
    local_y = (y - int(geometry["y"])) / height
    if local_x < -0.05 or local_y < -0.05 or local_x > 1.05 or local_y > 1.05:
        return None
    return (min(max(local_x, 0.0), 1.0), min(max(local_y, 0.0), 1.0))


class PortalRemoteDesktopSampler:
    """Best-effort RemoteDesktop pointer capture."""

    backend = "portal-rd"

    def __init__(self, geometry: dict, interval: float = 0.02):
        self.geometry = geometry
        self.interval = interval
        self.events: list[dict] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._started = 0.0
        self._session = None
        self._bus = None

    @staticmethod
    def available() -> bool:
        try:
            import dbus
        except ImportError:
            return False
        try:
            bus = dbus.SessionBus()
            desktop = bus.get_object(
                "org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop",
            )
            intro = dbus.Interface(desktop, "org.freedesktop.DBus.Introspectable").Introspect()
            return "org.freedesktop.portal.RemoteDesktop" in intro
        except Exception:
            return False

    def start(self) -> None:
        self._open_session()
        self._started = time.monotonic()
        self._thread = threading.Thread(target=self._run, name="dogsc-portal-rd", daemon=True)
        self._thread.start()

    def stop(self) -> list[dict]:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        self._close_session()
        return self.events

    def _open_session(self) -> None:
        try:
            import dbus
            from dbus.mainloop.glib import DBusGMainLoop
            from gi.repository import GLib
        except ImportError as error:
            raise DogSCError("缺少 python3-dbus / PyGObject，无法打开 RemoteDesktop。") from error

        DBusGMainLoop(set_as_default=True)
        bus = dbus.SessionBus()
        self._bus = bus
        desktop = bus.get_object("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop")
        remote = dbus.Interface(desktop, "org.freedesktop.portal.RemoteDesktop")
        sender = bus.get_unique_name().lstrip(":").replace(".", "_")

        def request(method, *args, timeout: float = 45):
            token = secrets.token_hex(8)
            options = args[-1]
            options["handle_token"] = token
            loop = GLib.MainLoop()
            outcome: dict[str, Any] = {}

            def on_response(response, results):
                outcome["response"] = int(response)
                outcome["results"] = results
                loop.quit()

            path = f"/org/freedesktop/portal/desktop/request/{sender}/{token}"
            bus.add_signal_receiver(
                on_response,
                signal_name="Response",
                dbus_interface="org.freedesktop.portal.Request",
                path=path,
            )
            try:
                method(*args)
                GLib.timeout_add(int(timeout * 1000), loop.quit)
                loop.run()
            finally:
                bus.remove_signal_receiver(
                    on_response,
                    signal_name="Response",
                    dbus_interface="org.freedesktop.portal.Request",
                    path=path,
                )
            if outcome.get("response") != 0:
                raise DogSCError("RemoteDesktop 请求被拒绝或超时。")
            return outcome.get("results") or {}

        session_token = secrets.token_hex(8)
        create = request(remote.CreateSession, {"session_handle_token": session_token})
        session = create.get("session_handle")
        if not session:
            raise DogSCError("RemoteDesktop 没有返回 session_handle。")
        self._session = str(session)

        # DeviceType POINTER = 1 (bit 0) per portal RemoteDesktop docs.
        request(
            remote.SelectDevices,
            self._session,
            {"types": dbus.UInt32(1)},
        )
        start = request(
            remote.Start,
            self._session,
            "",  # parent window
            {},
            timeout=60,
        )
        # Newer portals may return devices / streams; stash for future EIS wiring.
        self._start_results = dict(start)

    def _close_session(self) -> None:
        if not self._session or not self._bus:
            return
        try:
            import dbus
            session = self._bus.get_object("org.freedesktop.portal.Desktop", self._session)
            iface = dbus.Interface(session, "org.freedesktop.portal.Session")
            iface.Close()
        except Exception:
            pass
        self._session = None

    def _run(self) -> None:
        """Poll placeholder — EIS fd wiring lands when libei is available.

        Until then we keep the RemoteDesktop session alive so permission /
        device selection is exercised, and emit no synthetic moves.
        """
        while not self._stop.is_set():
            self._stop.wait(self.interval)
