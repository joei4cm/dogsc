"""xdg-desktop-portal ScreenCast session.

Ubuntu GNOME Wayland and Omarchy's xdg-desktop-portal-hyprland both speak
this API. The session stays open for the whole recording so the PipeWire
node does not disappear. Opening it shows the desktop's share dialog.
"""

from __future__ import annotations

import secrets
from typing import Any

from dogsc.errors import DogSCError


def parse_node_id(streams: Any) -> int:
    if not streams:
        raise DogSCError("屏幕共享没有返回 PipeWire 节点。")
    first = streams[0]
    if isinstance(first, dict):
        node = first.get("node_id", first.get("id"))
    elif isinstance(first, (list, tuple)) and first:
        node = first[0]
    else:
        node = first
    try:
        return int(node)
    except (TypeError, ValueError) as error:
        raise DogSCError("屏幕共享返回了无法识别的节点。") from error


class PortalCast:
    def __init__(self, source: str = "monitor"):
        self.source = source
        self.node_id: int | None = None
        self._bus = None
        self._session_path = None

    def start(self, timeout: float = 60) -> int:
        try:
            import dbus
            from dbus.mainloop.glib import DBusGMainLoop
            from gi.repository import GLib
        except ImportError as error:
            raise DogSCError("缺少 python3-dbus 或 PyGObject，无法打开屏幕共享。") from error

        DBusGMainLoop(set_as_default=True)
        bus = dbus.SessionBus()
        self._bus = bus
        desktop = bus.get_object("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop")
        screencast = dbus.Interface(desktop, "org.freedesktop.portal.ScreenCast")
        sender = bus.get_unique_name().lstrip(":").replace(".", "_")

        def request(method, *args):
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
            if "response" not in outcome:
                raise DogSCError("屏幕共享没有响应。")
            if outcome["response"] != 0:
                raise DogSCError("屏幕共享被取消了。")
            return outcome["results"]

        session_token = secrets.token_hex(8)
        created = request(
            screencast.CreateSession,
            {"session_handle_token": session_token},
        )
        session_path = str(created.get("session_handle") or f"/org/freedesktop/portal/desktop/session/{sender}/{session_token}")
        self._session_path = session_path
        kinds = {"monitor": 1, "window": 2, "any": 3}
        request(
            screencast.SelectSources,
            session_path,
            {
                "types": dbus.UInt32(kinds.get(self.source, 1)),
                "multiple": False,
                "cursor_mode": dbus.UInt32(2),
                "persist_mode": dbus.UInt32(2),
            },
        )
        started = request(screencast.Start, session_path, "", {})
        self.node_id = parse_node_id(started.get("streams"))
        return self.node_id

    def close(self) -> None:
        if not self._bus or not self._session_path:
            return
        try:
            import dbus
            session = self._bus.get_object("org.freedesktop.portal.Desktop", self._session_path)
            dbus.Interface(session, "org.freedesktop.portal.Session").Close()
        except Exception:
            pass
        self._session_path = None
