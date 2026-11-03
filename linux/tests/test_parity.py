from __future__ import annotations

import unittest

from dogsc.parity import CHOICES, matrix
from dogsc.platform import detect


class ParityTests(unittest.TestCase):
    def test_recommended_is_qt6(self):
        payload = matrix()
        self.assertEqual(payload["recommended"], "qt6-qml-vulkan")
        self.assertEqual(payload["active"], "web-soft-silver")
        self.assertEqual(payload["bridge"]["next"], "qt6-qml-vulkan")

    def test_choices_cover_apple_contract(self):
        payload = matrix()
        for key in ("chrome", "motion", "preview", "capture"):
            self.assertIn(key, payload["apple"])
        ids = {choice.id for choice in CHOICES}
        self.assertTrue(ids >= {"qt6-qml-vulkan", "tauri-wgpu", "web-soft-silver", "gtk4-gstreamer"})
        self.assertGreaterEqual(CHOICES[0].score, CHOICES[-1].score)

    def test_environment_exposes_parity(self):
        env = detect().as_dict()
        self.assertEqual(env["parity"]["recommended"], "qt6-qml-vulkan")


if __name__ == "__main__":
    unittest.main()
