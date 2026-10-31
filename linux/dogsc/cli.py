from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from dogsc import __version__
from dogsc.errors import DogSCError
from dogsc.export_plan import build_export
from dogsc.platform import detect
from dogsc.project import import_media, load, load_pointer, media_path, project_dir
from dogsc.recorder import Recorder, send_mark
from dogsc.server import create_demo, serve


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="dogsc",
        description="DogSC Linux：在 Ubuntu 与 Omarchy 上录屏、剪辑并导出。",
    )
    parser.add_argument("--version", action="version", version=f"DogSC Linux {__version__}")
    sub = parser.add_subparsers(dest="command")

    edit = sub.add_parser("edit", help="打开本地剪辑界面")
    edit.add_argument("--port", type=int, default=47321)
    edit.add_argument("--no-browser", action="store_true")

    doctor = sub.add_parser("doctor", help="检查当前桌面能不能录")
    doctor.add_argument("--json", action="store_true")

    record = sub.add_parser("record", help="开始录制，Ctrl+C 结束")
    record.add_argument("--source", choices=["display", "window", "region"], default="display")
    record.add_argument("--display", type=int, default=0)
    record.add_argument("--window")
    record.add_argument("--geometry", help="x,y,width,height")
    record.add_argument("--fps", type=int, choices=[30, 60], default=30)
    record.add_argument("--mic", action="store_true")
    record.add_argument("--system", action="store_true")
    record.add_argument("--backend", choices=["x11", "hyprland", "portal", "fixture"])
    record.add_argument("--duration", type=float, default=1, help="仅 fixture 后端使用")

    sub.add_parser("mark", help="给正在进行的录制打一个标记")
    demo = sub.add_parser("demo", help="生成一段示例项目并打开剪辑器")
    demo.add_argument("--port", type=int, default=47321)

    export = sub.add_parser("export", help="把项目导出成 MP4")
    export.add_argument("project")
    export.add_argument("output")

    incoming = sub.add_parser("import", help="导入一个视频文件")
    incoming.add_argument("path")

    sub.add_parser("install", help="安装当前用户的应用菜单项")

    args = parser.parse_args(argv)
    command = args.command or "edit"
    try:
        if command == "doctor":
            _doctor(args.json)
        elif command == "edit":
            serve(args.port, open_browser=not args.no_browser)
        elif command == "record":
            _record(args)
        elif command == "mark":
            print(json.dumps(send_mark(), ensure_ascii=False))
        elif command == "demo":
            project = create_demo()
            print(project["id"])
            serve(args.port, open_browser=True)
        elif command == "export":
            _export(args.project, Path(args.output))
        elif command == "import":
            project = import_media(Path(args.path).expanduser())
            print(project["id"])
        elif command == "install":
            print(install_launcher())
        else:
            parser.error(command)
    except DogSCError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        raise SystemExit(130)


def _doctor(as_json: bool) -> None:
    desktop = detect()
    if as_json:
        print(json.dumps(desktop.as_dict(), ensure_ascii=False, indent=2))
        return
    family = {"ubuntu": "Ubuntu", "omarchy": "Omarchy", "linux": "Linux"}[desktop.family]
    print(f"DogSC Linux {__version__}")
    print(f"系统：{desktop.os_name}（{family}）")
    print(f"会话：{desktop.session} / {desktop.compositor}")
    print(f"录制方式：{desktop.as_dict()['backend_label']}")
    print(f"麦克风：{desktop.microphone or '不可用'}")
    print(f"系统声音：{desktop.system_audio or '不可用'}")
    for hint in desktop.hints:
        print(f"- {hint}")


def _record(args: argparse.Namespace) -> None:
    geometry = None
    if args.geometry:
        parts = [int(float(piece)) for piece in args.geometry.split(",")]
        if len(parts) != 4:
            raise DogSCError("区域格式是 x,y,width,height。")
        geometry = {"x": parts[0], "y": parts[1], "width": parts[2], "height": parts[3]}
    recorder = Recorder()
    recorder.start({
        "source": args.source,
        "display_index": args.display,
        "window_id": args.window,
        "geometry": geometry,
        "fps": args.fps,
        "microphone": args.mic,
        "system_audio": args.system,
        "backend": args.backend,
        "duration": args.duration,
    })
    print("正在录制。Ctrl+C 结束。另开一个终端执行 dogsc mark 可以打标记。", flush=True)
    try:
        while recorder.active():
            time.sleep(0.2)
    except KeyboardInterrupt:
        pass
    if recorder._spec:
        print(recorder.stop()["id"])


def _export(project_id: str, output: Path) -> None:
    project = load(project_id)
    command = build_export(project, media_path(project_id), load_pointer(project_id), output, project_dir(project_id) / "export-work")
    import subprocess
    completed = subprocess.run(command, check=False)
    if completed.returncode != 0:
        raise DogSCError("导出失败。")
    print(output)


def install_launcher() -> str:
    root = Path(__file__).resolve().parents[2]
    binary = Path(__file__).resolve().parents[1] / "bin" / "dogsc"
    icon = root / "Resources" / "AppIconMaster.png"
    desktop = Path.home() / ".local" / "share" / "applications" / "dogsc.desktop"
    desktop.parent.mkdir(parents=True, exist_ok=True)
    desktop.write_text(
        "\n".join([
            "[Desktop Entry]",
            "Type=Application",
            "Name=DogSC",
            "GenericName=Screen recorder",
            "Comment=录屏与轻量剪辑",
            f"Exec={binary} edit",
            f"Icon={icon}" if icon.exists() else "Icon=video-display",
            "Terminal=false",
            "Categories=AudioVideo;Video;",
            "StartupNotify=true",
            "",
        ]),
        encoding="utf-8",
    )
    return str(desktop)
