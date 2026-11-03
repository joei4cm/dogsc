import QtQuick
import DogSC 1.0

/**
 * Soft Silver stage content plane.
 *
 * Backed by C++ PreviewSurfaceItem (QSG texture composited by the active RHI
 * backend). presentFrame / presentRgba / presentMediaFrame feed the native
 * decode→texture path (G01 / G02).
 */
PreviewSurface {
    id: previewSurface
    emptyColor: "#111111"
    Component.onCompleted: refreshBackend()

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
            text: previewSurface.status + " · " + previewSurface.backend
            color: "#fdfdfe"
            font.pixelSize: 10
            font.weight: Font.Medium
        }
    }
}
