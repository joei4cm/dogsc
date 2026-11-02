import QtQuick

/**
 * Preview surface stub — Soft Silver stage content plane.
 *
 * Graduation target (G01): replace this Rectangle with a C++ QQuickItem that
 * presents frames via Qt RHI / Vulkan (QRhiTexture → QSGTextureNode, or a
 * custom QSGRenderNode). Do not embed an HTML <video> or Qt Multimedia
 * VideoOutput as the long-term path; those cannot match Apple's
 * CIImage → CAMetalLayer zero-copy preview.
 *
 * Plug-in sketch:
 *   1. class PreviewSurfaceItem : public QQuickItem
 *   2. override updatePaintNode() to upload decoded / GPU frames
 *   3. qmlRegisterType<PreviewSurfaceItem>("DogSC", 1, 0, "PreviewSurface")
 *   4. swap this file's root for the registered type (same id / anchors API)
 *
 * Capture / export remain the Python ffmpeg sidecar — this item is display only.
 */
Rectangle {
    id: previewSurface
    color: "#111111"
    radius: 14
    clip: true

    // Soft Silver empty-stage placeholder until Vulkan QQuickItem lands.
    Column {
        anchors.centerIn: parent
        spacing: 8
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: qsTr("PreviewSurface")
            color: "#fdfdfe"
            font.pixelSize: 14
            font.weight: Font.DemiBold
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: qsTr("Vulkan QQuickItem · G01")
            color: Qt.rgba(1, 1, 1, 0.45)
            font.pixelSize: 11
        }
    }
}
