import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

/**
 * Soft Silver shell skeleton for the recommended Linux host.
 * Springs mirror SpringMotion.settle (response 0.38, damping 1) and
 * RecorderMotion.morph (0.5 / 0.82). Preview should be a custom
 * QQuickItem backed by Vulkan/RHI — see PreviewSurface.qml.
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
    readonly property color bg: "#ecedef"
    readonly property color panel: "#fdfdfe"
    readonly property color platinum: "#1f1f1f"
    readonly property color line: Qt.rgba(0.1, 0.12, 0.18, 0.075)
    readonly property color muted: "#5c5c5c"
    readonly property color faint: "#858585"
    readonly property color well: Qt.rgba(0, 0, 0, 0.045)

    property real inspectorWidth: 384
    property bool cropping: false
    property bool exportOpen: false
    property int inspectorTab: 0
    property int timelineLane: 0

    // Soft Silver stage + chrome
    Item {
        anchors.fill: parent

        // —— Stage ——
        Item {
            id: stage
            anchors.left: parent.left
            anchors.right: inspector.left
            anchors.top: parent.top
            anchors.bottom: timeline.top

            // Stage dots — Apple EditorWorkspaceGrid: stride 24, α0.11
            Canvas {
                id: stageDots
                anchors.fill: parent
                onPaint: {
                    const ctx = getContext("2d")
                    ctx.clearRect(0, 0, width, height)
                    ctx.fillStyle = "rgba(0,0,0,0.11)"
                    for (let x = 12; x < width; x += 24)
                        for (let y = 12; y < height; y += 24) {
                            ctx.beginPath()
                            ctx.arc(x, y, 0.6, 0, Math.PI * 2)
                            ctx.fill()
                        }
                }
                Component.onCompleted: requestPaint()
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
            }

            // Soft radial wash
            Rectangle {
                anchors.fill: parent
                gradient: Gradient {
                    GradientStop { position: 0.0; color: Qt.rgba(1, 1, 1, 0.55) }
                    GradientStop { position: 0.55; color: "transparent" }
                    GradientStop { position: 1.0; color: Qt.rgba(0.1, 0.12, 0.18, 0.04) }
                }
                opacity: 0.9
            }

            // Canvas frame / preview placeholder
            Rectangle {
                id: canvasFrame
                width: Math.min(920, parent.width * 0.92)
                height: width * 9 / 16
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                anchors.verticalCenterOffset: root.cropping ? -18 : -8
                radius: 14
                color: "#111111"
                border.color: Qt.rgba(1, 1, 1, 0.06)
                border.width: 0.5
                clip: true

                Behavior on anchors.verticalCenterOffset {
                    NumberAnimation {
                        duration: root.settleMs
                        easing.type: Easing.OutCubic
                    }
                }

                Loader {
                    anchors.fill: parent
                    source: Qt.resolvedUrl("PreviewSurface.qml")
                }

                // Crop overlay — dim outside + 8 handles (corners + edges)
                Item {
                    id: cropOverlay
                    anchors.fill: parent
                    visible: root.cropping
                    opacity: root.cropping ? 1 : 0

                    Behavior on opacity {
                        NumberAnimation {
                            duration: root.settleMs
                            easing.type: Easing.OutCubic
                        }
                    }

                    readonly property real cx: width * 0.12
                    readonly property real cy: height * 0.1
                    readonly property real cw: width * 0.76
                    readonly property real ch: height * 0.8

                    // Four dim panels leave the crop interior clear
                    Rectangle { x: 0; y: 0; width: parent.width; height: cropOverlay.cy; color: Qt.rgba(0, 0, 0, 0.38) }
                    Rectangle { x: 0; y: cropOverlay.cy + cropOverlay.ch; width: parent.width; height: parent.height - cropOverlay.cy - cropOverlay.ch; color: Qt.rgba(0, 0, 0, 0.38) }
                    Rectangle { x: 0; y: cropOverlay.cy; width: cropOverlay.cx; height: cropOverlay.ch; color: Qt.rgba(0, 0, 0, 0.38) }
                    Rectangle { x: cropOverlay.cx + cropOverlay.cw; y: cropOverlay.cy; width: parent.width - cropOverlay.cx - cropOverlay.cw; height: cropOverlay.ch; color: Qt.rgba(0, 0, 0, 0.38) }

                    Rectangle {
                        id: cropRect
                        x: cropOverlay.cx
                        y: cropOverlay.cy
                        width: cropOverlay.cw
                        height: cropOverlay.ch
                        color: "transparent"
                        border.color: "#fdfdfe"
                        border.width: 1.5

                        Repeater {
                            model: [
                                { ax: 0, ay: 0 }, { ax: 0.5, ay: 0 }, { ax: 1, ay: 0 },
                                { ax: 0, ay: 0.5 },                     { ax: 1, ay: 0.5 },
                                { ax: 0, ay: 1 }, { ax: 0.5, ay: 1 }, { ax: 1, ay: 1 }
                            ]
                            delegate: Rectangle {
                                width: 10
                                height: 10
                                radius: 2
                                color: "#fdfdfe"
                                border.color: root.platinum
                                border.width: 1
                                x: cropRect.width * modelData.ax - width / 2
                                y: cropRect.height * modelData.ay - height / 2
                            }
                        }
                    }
                }
            }

            // Stage HUD — crop / export entry points
            Row {
                anchors.top: parent.top
                anchors.right: parent.right
                anchors.margins: 16
                spacing: 8
                z: 4

                Rectangle {
                    width: cropHudLabel.implicitWidth + 28
                    height: 32
                    radius: 10
                    color: root.cropping ? root.platinum : root.panel
                    border.color: root.line
                    border.width: 0.5

                    Text {
                        id: cropHudLabel
                        anchors.centerIn: parent
                        text: qsTr("裁切")
                        color: root.cropping ? "#fdfdfe" : root.platinum
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                    MouseArea {
                        anchors.fill: parent
                        onClicked: {
                            root.cropping = !root.cropping
                            if (root.cropping)
                                root.exportOpen = false
                        }
                    }
                }

                Rectangle {
                    width: exportHudLabel.implicitWidth + 28
                    height: 32
                    radius: 10
                    color: root.panel
                    border.color: root.line
                    border.width: 0.5

                    Text {
                        id: exportHudLabel
                        anchors.centerIn: parent
                        text: qsTr("导出")
                        color: root.platinum
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                    MouseArea {
                        anchors.fill: parent
                        onClicked: {
                            root.exportOpen = true
                            root.cropping = false
                        }
                    }
                }
            }

            // Crop mode toolbar stub
            Rectangle {
                id: cropToolbar
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottom: parent.bottom
                anchors.bottomMargin: 16
                height: 44
                width: cropToolbarRow.implicitWidth + 20
                radius: 14
                color: root.panel
                border.color: root.line
                border.width: 0.5
                visible: root.cropping
                opacity: root.cropping ? 1 : 0
                z: 5

                Behavior on opacity {
                    NumberAnimation {
                        duration: root.settleMs
                        easing.type: Easing.OutCubic
                    }
                }
                Behavior on width {
                    NumberAnimation {
                        duration: root.morphMs
                        easing.type: Easing.OutCubic
                    }
                }

                Row {
                    id: cropToolbarRow
                    anchors.centerIn: parent
                    spacing: 6

                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: qsTr("裁切模式")
                        color: root.platinum
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                        leftPadding: 8
                        rightPadding: 6
                    }

                    Repeater {
                        model: [
                            { label: qsTr("清除"), primary: false },
                            { label: qsTr("取消"), primary: false },
                            { label: qsTr("完成"), primary: true }
                        ]
                        delegate: Rectangle {
                            width: btnLabel.implicitWidth + 24
                            height: 32
                            radius: 10
                            color: modelData.primary ? root.platinum : root.well

                            Text {
                                id: btnLabel
                                anchors.centerIn: parent
                                text: modelData.label
                                color: modelData.primary ? "#fdfdfe" : root.muted
                                font.pixelSize: 12
                                font.weight: Font.DemiBold
                            }
                            MouseArea {
                                anchors.fill: parent
                                onClicked: root.cropping = false
                            }
                        }
                    }
                }
            }
        }

        // —— Inspector rail (Apple default 384, clamp 340–480) ——
        Rectangle {
            id: inspector
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: timeline.top
            anchors.margins: 0
            anchors.topMargin: 12
            anchors.rightMargin: 12
            anchors.bottomMargin: 8
            width: root.inspectorWidth
            radius: 20
            color: root.panel
            border.color: root.line
            border.width: 0.5
            z: 3

            // Drag resize handle between stage and inspector (340–480)
            Item {
                id: resizeHandle
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 8
                z: 6

                Rectangle {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.verticalCenter: parent.verticalCenter
                    width: 3
                    height: 36
                    radius: 1.5
                    color: Qt.rgba(0.12, 0.12, 0.14, 0.18)
                }

                MouseArea {
                    anchors.fill: parent
                    anchors.leftMargin: -4
                    anchors.rightMargin: -4
                    cursorShape: Qt.SizeHorCursor
                    property real startX: 0
                    property real startW: 0
                    onPressed: (mouse) => {
                        startX = mapToItem(root.contentItem, mouse.x, mouse.y).x
                        startW = root.inspectorWidth
                    }
                    onPositionChanged: (mouse) => {
                        if (!pressed)
                            return
                        const x = mapToItem(root.contentItem, mouse.x, mouse.y).x
                        const delta = startX - x
                        root.inspectorWidth = Math.min(480, Math.max(340, startW + delta))
                    }
                }
            }

            Row {
                id: rail
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.margins: 8
                anchors.leftMargin: 14
                height: 44
                spacing: 2

                Repeater {
                    model: [qsTr("画面"), qsTr("开场"), qsTr("运镜"), qsTr("光标"), qsTr("摄像头"), qsTr("声音")]
                    delegate: Item {
                        width: root.inspectorTab === index ? label.implicitWidth + 36 : 40
                        height: 40
                        Behavior on width {
                            NumberAnimation {
                                duration: root.settleMs
                                easing.type: Easing.OutCubic
                            }
                        }
                        Rectangle {
                            anchors.fill: parent
                            radius: 20
                            color: root.inspectorTab === index ? root.platinum : "transparent"
                            Behavior on color {
                                ColorAnimation { duration: 150 }
                            }
                        }
                        Text {
                            id: label
                            anchors.centerIn: parent
                            text: modelData
                            color: root.inspectorTab === index ? "white" : root.muted
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                            opacity: root.inspectorTab === index ? 1 : 0
                            Behavior on opacity {
                                NumberAnimation { duration: 160; easing.type: Easing.OutQuad }
                            }
                        }
                        MouseArea {
                            anchors.fill: parent
                            onClicked: root.inspectorTab = index
                        }
                    }
                }
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - 36
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
                color: root.muted
                font.pixelSize: 12
                text: qsTr("Qt 6 Soft Silver host — PreviewSurface + Vulkan next.\nPython ffmpeg backends stay as the capture/export sidecar.\nInspector %1 px (340–480).")
                    .arg(Math.round(root.inspectorWidth))
            }
        }

        // —— Timeline strip ——
        Rectangle {
            id: timeline
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 168
            color: "#f6f6f8"
            border.color: root.line
            border.width: 0
            z: 2

            Rectangle {
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                height: 0.5
                color: root.line
            }

            // Timeline bar
            Rectangle {
                id: timelineBar
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                height: 40
                color: Qt.rgba(0.992, 0.992, 0.996, 0.92)

                Row {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.leftMargin: 12
                    spacing: 4

                    Repeater {
                        model: [qsTr("画面"), qsTr("波形")]
                        delegate: Rectangle {
                            width: tlLabel.implicitWidth + 20
                            height: 28
                            radius: 8
                            color: index === 0 ? root.panel : "transparent"
                            border.color: index === 0 ? root.line : "transparent"
                            border.width: 0.5

                            Text {
                                id: tlLabel
                                anchors.centerIn: parent
                                text: modelData
                                color: index === 0 ? root.platinum : root.muted
                                font.pixelSize: 12
                                font.weight: Font.DemiBold
                            }
                        }
                    }
                }

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: 14
                    text: qsTr("时间线 · stub")
                    color: root.faint
                    font.pixelSize: 11
                }

                Rectangle {
                    anchors.bottom: parent.bottom
                    anchors.left: parent.left
                    anchors.right: parent.right
                    height: 0.5
                    color: root.line
                }
            }

            // Lane placeholders: 画面 / 运镜 / 马赛克
            Column {
                anchors.top: timelineBar.bottom
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.margins: 10
                anchors.topMargin: 8
                spacing: 8

                Repeater {
                    model: [
                        { name: qsTr("画面"), tint: "#2a2d33" },
                        { name: qsTr("运镜"), tint: Qt.rgba(0.52, 0.82, 0.26, 0.22) },
                        { name: qsTr("马赛克"), tint: Qt.rgba(0.47, 0.55, 1.0, 0.18) }
                    ]
                    delegate: Item {
                        width: parent.width
                        height: 32

                        Text {
                            id: laneLabel
                            width: 52
                            anchors.verticalCenter: parent.verticalCenter
                            text: modelData.name
                            color: root.faint
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }

                        Rectangle {
                            anchors.left: laneLabel.right
                            anchors.leftMargin: 8
                            anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            height: 28
                            radius: 8
                            color: Qt.rgba(0, 0, 0, 0.035)

                            Rectangle {
                                width: index === 0 ? parent.width * 0.42 : (index === 1 ? parent.width * 0.18 : parent.width * 0.12)
                                height: parent.height - 8
                                anchors.verticalCenter: parent.verticalCenter
                                x: index === 0 ? 8 : (index === 1 ? parent.width * 0.28 : parent.width * 0.55)
                                radius: 6
                                color: modelData.tint
                                border.color: index === 0
                                    ? Qt.rgba(1, 1, 1, 0.08)
                                    : (index === 1
                                        ? Qt.rgba(0.52, 0.82, 0.26, 0.35)
                                        : Qt.rgba(0.47, 0.55, 1.0, 0.4))
                                border.width: 1
                                opacity: 0.95
                            }
                        }
                    }
                }
            }

            // Playhead stub
            Rectangle {
                anchors.top: timelineBar.bottom
                anchors.bottom: parent.bottom
                x: parent.width * 0.28
                width: 2
                color: "#ff453b"
                opacity: 0.9
            }
        }

        // Floating Soft Silver recorder capsule
        Rectangle {
            id: capsule
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: timeline.top
            anchors.bottomMargin: 14
            height: 56
            width: modeLabel.implicitWidth + 220
            radius: 28
            color: root.panel
            border.color: root.line
            border.width: 0.5
            z: 8
            visible: !root.cropping && !root.exportOpen

            Behavior on width {
                NumberAnimation {
                    duration: root.morphMs
                    easing.type: Easing.OutCubic
                }
            }
            Behavior on opacity {
                NumberAnimation {
                    duration: root.settleMs
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
                    color: root.well
                    Row {
                        anchors.centerIn: parent
                        spacing: 8
                        Text {
                            id: modeLabel
                            text: qsTr("显示器")
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                            color: root.platinum
                        }
                        Text { text: "⇅"; color: root.faint; font.pixelSize: 10 }
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

        // —— Export sheet stub (modal island) ——
        Rectangle {
            id: exportScrim
            anchors.fill: parent
            color: Qt.rgba(0.1, 0.12, 0.18, 0.28)
            visible: root.exportOpen
            opacity: root.exportOpen ? 1 : 0
            z: 20

            Behavior on opacity {
                NumberAnimation {
                    duration: root.settleMs
                    easing.type: Easing.OutCubic
                }
            }

            MouseArea {
                anchors.fill: parent
                onClicked: root.exportOpen = false
            }

            Rectangle {
                id: exportSheet
                anchors.centerIn: parent
                width: 360
                height: 280
                radius: 22
                color: root.panel
                border.color: root.line
                border.width: 0.5
                scale: root.exportOpen ? 1 : 0.94

                Behavior on scale {
                    NumberAnimation {
                        duration: root.morphMs
                        easing.type: Easing.OutCubic
                    }
                }

                // Block scrim clicks
                MouseArea {
                    anchors.fill: parent
                    onClicked: { /* absorb */ }
                }

                Column {
                    anchors.fill: parent
                    anchors.margins: 22
                    spacing: 16

                    Text {
                        text: qsTr("导出")
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                        color: root.platinum
                    }

                    Column {
                        spacing: 6
                        width: parent.width
                        Text {
                            text: qsTr("分辨率")
                            color: root.muted
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }
                        Rectangle {
                            width: parent.width
                            height: 36
                            radius: 10
                            color: root.well
                            Text {
                                anchors.verticalCenter: parent.verticalCenter
                                anchors.left: parent.left
                                anchors.leftMargin: 12
                                text: "1080p"
                                color: root.platinum
                                font.pixelSize: 13
                                font.weight: Font.DemiBold
                            }
                        }
                    }

                    Column {
                        spacing: 6
                        width: parent.width
                        Text {
                            text: qsTr("帧率")
                            color: root.muted
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }
                        Rectangle {
                            width: parent.width
                            height: 36
                            radius: 10
                            color: root.well
                            Text {
                                anchors.verticalCenter: parent.verticalCenter
                                anchors.left: parent.left
                                anchors.leftMargin: 12
                                text: "60 fps"
                                color: root.platinum
                                font.pixelSize: 13
                                font.weight: Font.DemiBold
                            }
                        }
                    }

                    // Progress bar placeholder
                    Column {
                        spacing: 6
                        width: parent.width
                        Text {
                            text: qsTr("进度")
                            color: root.muted
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }
                        Rectangle {
                            width: parent.width
                            height: 8
                            radius: 4
                            color: root.well
                            Rectangle {
                                width: parent.width * 0.28
                                height: parent.height
                                radius: 4
                                color: root.platinum
                            }
                        }
                    }

                    Item {
                        width: parent.width
                        height: 34
                        Row {
                            anchors.right: parent.right
                            spacing: 8

                            Rectangle {
                                width: cancelLabel.implicitWidth + 28
                                height: 34
                                radius: 12
                                color: root.well
                                Text {
                                    id: cancelLabel
                                    anchors.centerIn: parent
                                    text: qsTr("取消")
                                    color: root.muted
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                }
                                MouseArea {
                                    anchors.fill: parent
                                    onClicked: root.exportOpen = false
                                }
                            }

                            Rectangle {
                                width: doneLabel.implicitWidth + 28
                                height: 34
                                radius: 12
                                color: root.platinum
                                Text {
                                    id: doneLabel
                                    anchors.centerIn: parent
                                    text: qsTr("开始导出")
                                    color: "#fdfdfe"
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                }
                                MouseArea {
                                    anchors.fill: parent
                                    onClicked: root.exportOpen = false
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
