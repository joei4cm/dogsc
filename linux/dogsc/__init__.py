"""DogSC for Linux.

The macOS app is built on AppKit, SwiftUI, ScreenCaptureKit and AVFoundation.
Those frameworks are not available on Linux, so Ubuntu and Omarchy run this
edition instead. It records through the desktop's own capture path and edits
with the same basic timeline, zoom and export flow.
"""

__version__ = "0.1.0"
