import QtQuick

/**
 * GPU continuous-corner panel (G04) — Soft Silver chrome via SDF fragment.
 * smoothness 0.6 ≈ Apple cornerCurve.continuous. Falls back visually to the
 * CPU ContinuousPanel when shaders fail to load.
 */
Item {
    id: root
    property color color: "#fdfdfe"
    property color borderColor: Qt.rgba(0.1, 0.12, 0.18, 0.06)
    property real borderWidth: 0.5
    property real radius: 22
    property real smoothness: 0.6

    ShaderEffect {
        id: sdf
        anchors.fill: parent
        supportsAtlasTextures: false
        fragmentShader: "qrc:/dogsc/shaders/continuous_corner.frag.qsb"
        vertexShader: "qrc:/dogsc/shaders/continuous_corner.vert.qsb"
        property real radius: root.radius
        property real smoothness: root.smoothness
        property real borderWidth: root.borderWidth
        property size size: Qt.size(width, height)
        property color fillColor: root.color
        property color borderColor: root.borderColor
    }
}
