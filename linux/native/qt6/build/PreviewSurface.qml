import QtQuick
import DogSC 1.0

/**
 * Soft Silver stage content plane.
 *
 * Backed by C++ PreviewSurfaceItem (QSGSimpleTextureNode). Empty stage paints a
 * Soft Silver placeholder; presentFrame() uploads CPU frames today and is the
 * seam for later QRhiTexture / Vulkan zero-copy imports (G01).
 *
 * Capture / export remain the Python ffmpeg sidecar — this item is display only.
 */
PreviewSurface {
    id: previewSurface
    emptyColor: "#111111"

    // Status chip for host debugging (hidden once a real frame is present)
    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.margins: 8
        width: statusLabel.implicitWidth + 14
        height: 22
        radius: 7
        color: Qt.rgba(0, 0, 0, 0.45)
        visible: !previewSurface.hasFrame
        Text {
            id: statusLabel
            anchors.centerIn: parent
            text: previewSurface.status
            color: "#fdfdfe"
            font.pixelSize: 10
            font.weight: Font.Medium
        }
    }
}
