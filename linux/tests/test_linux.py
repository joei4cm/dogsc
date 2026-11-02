from __future__ import annotations

from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dogsc.export_plan import build_export, canvas_size, estimate_export, preview_sample
from dogsc.media import probe
from dogsc.model import clamp_crop, migrate
from dogsc.platform import Toolchain, choose_backend, classify_audio, family_of, parse_os_release, parse_pactl_sources, session_of
from dogsc.portal import parse_node_id
from dogsc.project import import_media
from dogsc.recorder import Recorder
from dogsc.server import Handler, _ffmpeg_failure, create_demo
from dogsc.sources import hyprland_record_command, parse_hypr_clients, parse_hypr_monitors, parse_xrandr, portal_ffmpeg_command, x11_record_command
from dogsc.timeline import delete_clip, move_clip, split_clip, trim_clip
from dogsc.zoom import plan_auto_zooms, sample, viewport
from http.server import ThreadingHTTPServer


class PlatformTests(unittest.TestCase):
    def test_ubuntu_x11_uses_ffmpeg(self):
        tools = Toolchain(ffmpeg=True, x11grab=True, portal=True, ffmpeg_pipewire=True)
        self.assertEqual(choose_backend("x11", "gnome", tools), "x11")

    def test_ubuntu_wayland_uses_portal_when_pipewire_exists(self):
        tools = Toolchain(portal=True, gst_pipewire=True, wf_recorder=True, x11grab=True)
        self.assertEqual(choose_backend("wayland", "gnome", tools), "portal")

    def test_omarchy_hyprland_prefers_wf_recorder(self):
        tools = Toolchain(wf_recorder=True, portal=True, ffmpeg_pipewire=True, x11grab=True)
        self.assertEqual(choose_backend("wayland", "hyprland", tools), "hyprland")

    def test_wayland_without_consumer_does_not_silently_grab_x11(self):
        tools = Toolchain(x11grab=True, portal=True)
        self.assertIsNone(choose_backend("wayland", "gnome", tools))

    def test_family_detection(self):
        ubuntu = parse_os_release('NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\n')
        omarchy = parse_os_release('NAME="Omarchy"\nID=omarchy\nID_LIKE=arch\n')
        self.assertEqual(family_of(ubuntu, Path("/tmp/does-not-exist-dogsc")), "ubuntu")
        self.assertEqual(family_of(omarchy, Path("/tmp/does-not-exist-dogsc")), "omarchy")
        self.assertEqual(session_of({"DISPLAY": ":1"}), "x11")
        self.assertEqual(session_of({"WAYLAND_DISPLAY": "wayland-1", "XDG_SESSION_TYPE": "wayland"}), "wayland")

    def test_audio_classification(self):
        text = "0 alsa_output.monitor module-alsa\n1 alsa_input.mic module-alsa\n"
        sources = parse_pactl_sources(text)
        mic, system = classify_audio(sources, "alsa_input.mic", "alsa_output")
        self.assertEqual(mic, "alsa_input.mic")
        self.assertEqual(system, "alsa_output.monitor")


class CaptureCommandTests(unittest.TestCase):
    def test_xrandr_and_commands(self):
        displays = parse_xrandr("VNC-0 connected 1920x1200+0+0 0mm x 0mm\nHDMI-A-1 connected primary 1280x800+1920+0\n")
        self.assertEqual(displays[0]["width"], 1920)
        self.assertTrue(displays[1]["primary"])
        command = x11_record_command(":1", displays[0], 30, ["mic"], "/tmp/out.mp4")
        self.assertIn("x11grab", command)
        self.assertIn(":1.0+0,0", command)
        self.assertIn("0", command[command.index("-draw_mouse") + 1])
        hypr = hyprland_record_command(None, {"x": 1, "y": 2, "width": 640, "height": 480}, 60, "monitor", "/tmp/a.mp4")
        self.assertEqual(hypr[0], "wf-recorder")
        self.assertIn("1,2 640x480", hypr)
        self.assertIn("--audio=monitor", hypr)
        portal = portal_ffmpeg_command(42, 30, [], "/tmp/p.mp4")
        self.assertIn("pipewire", portal)
        self.assertIn("42", portal)

    def test_hypr_json(self):
        monitors = parse_hypr_monitors('[{"name":"DP-1","width":1920,"height":1080,"x":0,"y":0,"focused":true}]')
        self.assertEqual(monitors[0]["name"], "DP-1")
        windows = parse_hypr_clients('[{"address":"0x1","title":"Terminal","at":[10,20],"size":[800,600]}]')
        self.assertEqual(windows[0]["width"], 800)

    def test_portal_node_parser(self):
        self.assertEqual(parse_node_id([(7, {"size": (100, 100)})]), 7)
        self.assertEqual(parse_node_id([{"node_id": 9}]), 9)


class CropModelTests(unittest.TestCase):
    def test_clamp_crop_and_migrate(self):
        crop = clamp_crop({"x": -1, "y": 0.95, "width": 3, "height": 0.01})
        self.assertGreaterEqual(crop["x"], 0)
        self.assertGreaterEqual(crop["width"], 0.02)
        self.assertLessEqual(crop["x"] + crop["width"], 1.000001)
        project = migrate({
            "id": "crop-test",
            "clips": [{"id": "c", "src_in": 0, "src_out": 1, "speed": 1}],
            "canvas": {"crop": {"x": 0.1, "y": 0.2, "width": 0.5, "height": 0.4}},
            "export": {"resolution": "1080p", "fps": 30},
            "media": {"width": 1280, "height": 720},
        })
        self.assertEqual(project["canvas"]["crop"]["x"], 0.1)
        estimate = estimate_export(project)
        self.assertEqual(estimate["fps"], 30)
        self.assertGreater(estimate["bytes"], 0)


class ZoomTests(unittest.TestCase):
    def test_centered_hold_and_edge_clamp(self):
        zooms = [{
            "start": 0, "end": 2, "scale": 2, "focus_x": 0.5, "focus_y": 0.5,
            "enter": 1, "exit": 0, "easing": "cubic",
        }]
        mid = sample(zooms, 0.5)
        self.assertAlmostEqual(mid["scale"], 1.5, places=5)
        frame = viewport(mid["scale"], mid["focus_x"], mid["focus_y"], mid["framing"])
        self.assertAlmostEqual(frame["left"], 0.5 - 0.5 / 1.5, places=5)
        held = viewport(2, 0.5, 0.5, 1)
        self.assertAlmostEqual(held["left"], 0.25)
        self.assertAlmostEqual(held["size"], 0.5)
        edge = viewport(2, 0, 0.5, 1)
        self.assertAlmostEqual(edge["left"], 0)
        self.assertAlmostEqual(edge["size"], 0.5)

    def test_auto_zoom_groups_nearby_clicks_and_separates_distant_ones(self):
        clips = [{"id": "c", "src_in": 0, "src_out": 8, "speed": 1}]
        events = [
            {"t": 1.0, "x": 0.30, "y": 0.40, "kind": "left"},
            {"t": 1.3, "x": 0.33, "y": 0.42, "kind": "left"},
            {"t": 5.0, "x": 0.80, "y": 0.70, "kind": "left"},
        ]
        zooms = plan_auto_zooms(clips, events)
        self.assertGreaterEqual(len(zooms), 2)
        self.assertTrue(all(zoom["origin"] == "automatic" for zoom in zooms))
        self.assertLess(zooms[0]["focus_x"], 0.5)
        self.assertGreater(zooms[-1]["focus_x"], 0.6)

    def test_browser_math_matches(self):
        node = subprocess.run(["node", "-e", "process.stdout.write('ok')"], capture_output=True, text=True)
        if node.returncode != 0:
            self.skipTest("node is not available")
        script = r"""
          const z = require(process.argv[1]);
          const zooms = [{start:0,end:2,scale:2,focus_x:0.5,focus_y:0.5,enter:1,exit:0,easing:"cubic"}];
          const mid = z.sample(zooms, 0.5);
          const frame = z.viewport(mid.scale, mid.focus_x, mid.focus_y, mid.framing);
          const edge = z.viewport(2, 0, 0.5, 1);
          process.stdout.write(JSON.stringify({scale: mid.scale, left: frame.left, edge: edge.left, size: edge.size}));
        """
        completed = subprocess.run(
            ["node", "-e", script, str(Path(__file__).resolve().parents[1] / "dogsc" / "web" / "zoom.js")],
            check=True, capture_output=True, text=True,
        )
        payload = json.loads(completed.stdout)
        self.assertAlmostEqual(payload["scale"], 1.5, places=5)
        self.assertAlmostEqual(payload["left"], 0.5 - 0.5 / 1.5, places=5)
        self.assertAlmostEqual(payload["edge"], 0)
        self.assertAlmostEqual(payload["size"], 0.5)


class TimelineTests(unittest.TestCase):
    def test_split_trim_move_and_delete(self):
        clips = [{"id": "a", "src_in": 0, "src_out": 4, "speed": 1}]
        zooms = [{"id": "z", "clip_id": "a", "start": 1.2, "end": 2.4, "exit": 0.2, "enter": 0.2, "scale": 1.6, "focus_x": 0.5, "focus_y": 0.5, "easing": "cubic", "origin": "manual"}]
        markers = [{"id": "m", "clip_id": "a", "local": 3.2, "label": "标记"}]
        clips, zooms, markers = split_clip(clips, zooms, markers, 2)
        self.assertEqual(len(clips), 2)
        self.assertEqual(zooms[0]["clip_id"], clips[0]["id"])
        self.assertEqual(markers[0]["clip_id"], clips[1]["id"])
        clips = move_clip(clips, clips[1]["id"], -1)
        self.assertEqual(clips[0]["src_in"], 2)
        clips, zooms, markers = trim_clip(clips, zooms, markers, clips[1]["id"], "end", 3)
        self.assertLess(clips[1]["src_out"], 4)
        clips, zooms, markers = delete_clip(clips, zooms, markers, clips[0]["id"])
        self.assertEqual(len(clips), 1)


class ExportTests(unittest.TestCase):
    def test_canvas_and_rendered_file(self):
        self.assertEqual(canvas_size(1280, 720, "16:9", "1080p"), (1920, 1080))
        self.assertEqual(canvas_size(1280, 720, "9:16", "1080p"), (1080, 1920))
        self.assertEqual(canvas_size(1280, 720, "2.39:1", "1080p")[0], 1920)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "in.mp4"
            subprocess.run([
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=1",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(source),
            ], check=True)
            os.environ["DOGSC_HOME"] = str(root / "home")
            project = import_media(source, "导出测试")
            project["canvas"].update({
                "aspect": "16:9", "padding": 0.08, "radius": 18, "shadow": 0.4,
                "background": "#203040", "background_kind": "pattern", "pattern": "obsidianGrid",
                "screen_frame": "windowDark",
            })
            project["export"] = {"resolution": "source", "fps": 30}
            project["zooms"] = [{
                "id": "z", "clip_id": project["clips"][0]["id"], "start": 0.1, "end": 0.7,
                "scale": 2, "focus_x": 0.2, "focus_y": 0.5, "enter": 0.15, "exit": 0.15,
                "easing": "cubic", "origin": "manual",
            }]
            project["screen_motions"] = [{
                "id": "m", "clip_id": project["clips"][0]["id"], "start": 0.2, "end": 0.6,
                "enter": 0.1, "exit": 0.1, "rotation_z": 4, "rotation_x": 8, "rotation_y": -6,
                "scale": 1, "perspective": 0.7, "position_x": 0.5, "position_y": 0.5, "easing": "cubic",
            }]
            project["draw_cursor"] = True
            project["capture"] = {"cursor_baked": False}
            pointer = [{"t": 0.2, "x": 0.2, "y": 0.4, "kind": "move"}, {"t": 0.5, "x": 0.25, "y": 0.45, "kind": "left"}]
            output = root / "out.mp4"
            command = build_export(project, source, pointer, output, root / "work")
            graph = command[command.index("-filter_complex") + 1]
            self.assertNotIn("boxblur=18:2,format=rgba[shadow]", graph)
            self.assertTrue((root / "work" / "shadow.png").is_file())
            self.assertTrue((root / "work" / "frame.png").is_file())
            completed = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            info = probe(output)
            self.assertGreater(info["width"], 100)
            self.assertTrue(info["has_audio"])
            self.assertAlmostEqual(info["duration"], 1, delta=0.35)
            viewed = preview_sample(project, 0.4)
            self.assertGreater(viewed["scale"], 1.2)

    def test_linker_warning_is_not_the_export_error(self):
        warning = "/lib/libcaca.so.0: /lib/libncursesw.so.6: no version information available"
        interrupted = subprocess.CompletedProcess(args=["ffmpeg"], returncode=-9, stdout="", stderr=warning)
        self.assertIn("中断", _ffmpeg_failure(interrupted))
        failed = subprocess.CompletedProcess(
            args=["ffmpeg"], returncode=1, stdout="", stderr=warning + "\nError when evaluating the expression",
        )
        self.assertIn("expression", _ffmpeg_failure(failed))


class ServerTests(unittest.TestCase):
    def test_demo_split_and_ui(self):
        with tempfile.TemporaryDirectory() as temporary:
            os.environ["DOGSC_HOME"] = str(Path(temporary) / "home")
            project = create_demo()
            self.assertTrue(project["zooms"])
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            port = server.server_address[1]
            try:
                base = f"http://127.0.0.1:{port}"
                page = urllib.request.urlopen(base + "/", timeout=5)
                html = page.read().decode()
                self.assertIn("DogSC", html)
                self.assertIn("zoom.js", html)
                environment = json.load(urllib.request.urlopen(base + "/api/environment", timeout=5))
                self.assertIn(environment["family"], {"ubuntu", "omarchy", "linux"})
                body = json.dumps({"time": 1.2}).encode()
                request = urllib.request.Request(
                    base + f"/api/projects/{project['id']}/split",
                    data=body,
                    headers={"Content-Type": "application/json"},
                )
                split = json.load(urllib.request.urlopen(request, timeout=5))
                self.assertEqual(len(split["clips"]), 2)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


class RecorderTests(unittest.TestCase):
    def test_fixture_recording_writes_a_project(self):
        with tempfile.TemporaryDirectory() as temporary:
            os.environ["DOGSC_HOME"] = str(Path(temporary) / "home")
            recorder = Recorder()
            recorder.start({"backend": "fixture", "duration": 0.6, "fps": 30})
            time.sleep(1.0)
            project = recorder.stop()
            self.assertGreater(project["media"]["duration"], 0.3)
            self.assertTrue((Path(temporary) / "home" / "projects" / project["id"] / "media.mp4").exists())


if __name__ == "__main__":
    unittest.main()
