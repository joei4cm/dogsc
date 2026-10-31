import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

/**
 * Soft Silver shell skeleton for the recommended Linux host.
 * Springs mirror SpringMotion.settle (response 0.38, damping 1) and
 * RecorderMotion.morph (0.5 / 0.82). Preview should be a custom
 * QQuickItem backed by Vulkan/RHI — not an HTML <video>.
 */
ApplicationWindow {
    id: root
    width: 1280
    height: 800
    visible: true
    title: "DogSC"
    color: "#ecedef"

    readonly property real settleMs: 380
    readonly property real morphMs: 500

    Rectangle {
        anchors.fill: parent
        color: "#ecedef"

        // Stage dots
        Canvas {
            anchors.fill: parent
            onPaint: {
                const ctx = getContext("2d")
                ctx.clearRect(0, 0, width, height)
                ctx.fillStyle = "rgba(0,0,0,0.13)"
                for (let x = 9; x < width; x += 18)
                    for (let y = 9; y < height; y += 18) {
                        ctx.beginPath()
                        ctx.arc(x, y, 0.8, 0, Math.PI * 2)
                        ctx.fill()
                    }
            }
            Component.onCompleted: requestPaint()
            onWidthChanged: requestPaint()
            onHeightChanged: requestPaint()
        }

        // Floating Soft Silver recorder capsule
        Rectangle {
            id: capsule
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 28
            height: 56
            width: modeLabel.implicitWidth + 220
            radius: 28
            color: "#fdfdfe"
            border.color: Qt.rgba(0.1, 0.12, 0.18, 0.075)
            border.width: 0.5

            Behavior on width {
                NumberAnimation {
                    duration: root.morphMs
                    easing.type: Easing.OutCubic
                }
            }

            RowLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 0

                Rectangle {
                    id: modeWheel
                    Layout.preferredHeight: 40
                    Layout.preferredWidth: modeLabel.implicitWidth + 36
                    radius: 20
                    color: Qt.rgba(0, 0, 0, 0.045)
                    Row {
                        anchors.centerIn: parent
                        spacing: 8
                        Text {
                            id: modeLabel
                            text: qsTr("显示器")
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                        }
                        Text { text: "⇅"; color: "#858585"; font.pixelSize: 10 }
                    }
                }

                Item { Layout.fillWidth: true }

                Rectangle {
                    width: 36; height: 36; radius: 18
                    color: "#ff453b"
                    Rectangle {
                        width: 12; height: 12; radius: 6
                        anchors.centerIn: parent
                        color: "white"
                    }
                }
            }
        }

        // Inspector rail thumb — matchedGeometry analogue
        Rectangle {
            id: inspector
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: capsule.top
            anchors.margins: 18
            width: 300
            radius: 20
            color: "#fdfdfe"
            border.color: Qt.rgba(0.1, 0.12, 0.18, 0.075)
            border.width: 0.5

            property int tab: 0

            Row {
                id: rail
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.margins: 8
                height: 44
                spacing: 2

                Repeater {
                    model: [qsTr("画面"), qsTr("开场"), qsTr("运镜"), qsTr("光标"), qsTr("摄像头"), qsTr("声音")]
                    delegate: Item {
                        width: inspector.tab === index ? label.implicitWidth + 36 : 44
                        height: 44
                        Behavior on width {
                            NumberAnimation {
                                duration: root.settleMs
                                easing.type: Easing.OutCubic
                            }
                        }
                        Rectangle {
                            anchors.fill: parent
                            radius: 22
                            color: inspector.tab === index ? "#1f1f1f" : "transparent"
                            Behavior on color {
                                ColorAnimation { duration: 150 }
                            }
                        }
                        Text {
                            id: label
                            anchors.centerIn: parent
                            text: modelData
                            color: inspector.tab === index ? "white" : "#5c5c5c"
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                            opacity: inspector.tab === index ? 1 : 0
                            Behavior on opacity {
                                NumberAnimation { duration: 160; easing.type: Easing.OutQuad }
                            }
                        }
                        MouseArea {
                            anchors.fill: parent
                            onClicked: inspector.tab = index
                        }
                    }
                }
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - 28
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
                color: "#5c5c5c"
                font.pixelSize: 12
                text: qsTr("Qt 6 Soft Silver host — preview QQuickItem + Vulkan next.\nPython ffmpeg backends stay as the capture/export sidecar.")
            }
        }
    }
}
