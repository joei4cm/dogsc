import QtQuick
import DogSC 1.0

/**
 * Floating Soft Silver recorder island (G03).
 *
 * Frameless, always-on-top Tool window — Linux stand-in for Apple's NSPanel.
 * Morph spring mirrors RecorderMotion.morph (≈500ms OutCubic / damping 0.82).
 * Continuous corners via ContinuousPanel (G04) instead of CSS circular radius.
 *
 * Wayland layer-shell anchoring is a later compositor step; this lands the
 * window chrome + morph contract first.
 */
Window {
    id: island
    title: qsTr("DogSC Recorder")
    flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool
    color: "transparent"
    visible: islandVisible
    width: canvasWidth
    height: canvasHeight

    // Soft Silver tokens
    readonly property real settleMs: 380
    readonly property real morphMs: 500
    readonly property color panel: "#fdfdfe"
    readonly property color platinum: "#1f1f1f"
    readonly property color line: Qt.rgba(0.1, 0.12, 0.18, 0.06)
    readonly property color faint: "#5c5c5c"
    readonly property color well: Qt.rgba(0, 0, 0, 0.045)

    property bool islandVisible: true
    property bool recording: false
    property string modeLabel: qsTr("显示器")
    property string timecode: "00:00.00"

    // RecorderIslandLayout: window supplies drawing room; capsule morphs inside.
    readonly property real capsuleHeight: 56
    readonly property real idleWidth: Math.max(220, modeMetrics.width + 220)
    readonly property real liveWidth: 168
    readonly property real capsuleWidth: recording ? liveWidth : idleWidth
    readonly property real canvasPad: 18
    readonly property real canvasWidth: Math.max(idleWidth, liveWidth) + canvasPad * 2
    readonly property real canvasHeight: capsuleHeight + canvasPad * 2

    signal recordToggled()
    signal dragMoved(real dx, real dy)

    TextMetrics {
        id: modeMetrics
        font.pixelSize: 13
        font.weight: Font.DemiBold
        text: island.modeLabel
    }

    // Soft island shadow plate
    Rectangle {
        anchors.centerIn: parent
        width: capsule.width + 24
        height: capsule.height + 24
        radius: (capsule.height + 24) / 2
        color: Qt.rgba(0.08, 0.09, 0.12, 0.14)
        opacity: 0.55
        z: 0
    }

    ContinuousPanel {
        id: capsule
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter: parent.verticalCenter
        width: island.capsuleWidth
        height: island.capsuleHeight
        radius: height / 2
        smoothness: 0.6
        color: island.panel
        borderColor: island.line
        borderWidth: 0.5
        z: 1

        Behavior on width {
            NumberAnimation {
                duration: island.morphMs
                easing.type: Easing.OutCubic
            }
        }

        Row {
            id: row
            anchors.fill: parent
            anchors.leftMargin: 8
            anchors.rightMargin: 8
            anchors.topMargin: 8
            anchors.bottomMargin: 8
            spacing: 8

            // Mode wheel (idle)
            ContinuousPanel {
                id: modeWheel
                visible: !island.recording
                width: modeMetrics.width + 36
                height: 40
                radius: 20
                smoothness: 0.6
                color: island.well
                borderWidth: 0
                anchors.verticalCenter: parent.verticalCenter

                Row {
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: island.modeLabel
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        color: island.platinum
                    }
                    Text {
                        text: "⇅"
                        color: island.faint
                        font.pixelSize: 10
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }

            // Live timecode
            Text {
                visible: island.recording
                text: island.timecode
                color: island.platinum
                font.pixelSize: 14
                font.weight: Font.DemiBold
                font.family: "ui-monospace, monospace"
                anchors.verticalCenter: parent.verticalCenter
                leftPadding: 4
            }

            Item {
                width: Math.max(8, parent.width
                                - (island.recording ? timecodeWidth : modeWheel.width)
                                - 36 - 16)
                height: 1
                anchors.verticalCenter: parent.verticalCenter
                readonly property real timecodeWidth: island.recording ? 88 : 0
            }

            // Record / stop
            Rectangle {
                width: 36
                height: 36
                radius: 18
                anchors.verticalCenter: parent.verticalCenter
                gradient: Gradient {
                    GradientStop { position: 0.0; color: "#ff6b63" }
                    GradientStop { position: 1.0; color: "#ff453b" }
                }
                Rectangle {
                    width: island.recording ? 12 : 14
                    height: width
                    radius: island.recording ? 3 : width / 2
                    anchors.centerIn: parent
                    color: "white"
                    Behavior on width {
                        NumberAnimation {
                            duration: island.morphMs
                            easing.type: Easing.OutCubic
                        }
                    }
                    Behavior on radius {
                        NumberAnimation {
                            duration: island.morphMs
                            easing.type: Easing.OutCubic
                        }
                    }
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        island.recording = !island.recording
                        island.recordToggled()
                    }
                }
            }
        }

        // Drag anywhere on the chrome (not just the record button)
        MouseArea {
            anchors.fill: parent
            z: -1
            property real pressX: 0
            property real pressY: 0
            onPressed: function (mouse) {
                pressX = mouse.x
                pressY = mouse.y
            }
            onPositionChanged: function (mouse) {
                if (pressed) {
                    island.x += mouse.x - pressX
                    island.y += mouse.y - pressY
                    island.dragMoved(mouse.x - pressX, mouse.y - pressY)
                }
            }
        }
    }
}
