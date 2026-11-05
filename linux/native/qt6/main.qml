import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import DogSC 1.0

/**
 * Soft Silver shell skeleton for the recommended Linux host.
 * Springs mirror SpringMotion.settle (response 0.38, damping 1) and
 * RecorderMotion.morph (0.5 / 0.82). Preview is C++ PreviewSurfaceItem
 * (QSG texture → later Vulkan RHI). Floating recorder lives in
 * RecorderIsland.qml (frameless Tool window). Continuous corners via
 * ContinuousPanel (G04).
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
    readonly property color line: Qt.rgba(0.1, 0.12, 0.18, 0.06)
    readonly property color muted: "#4a4a4a"
    readonly property color faint: "#5c5c5c"
    readonly property color well: Qt.rgba(0, 0, 0, 0.045)

    property real inspectorWidth: 384
    property bool cropping: false
    property bool exportOpen: false
    property bool recording: false
    property int inspectorTab: 0
    property int timelineLane: 0
    property real playhead: 0
    property real mediaDuration: Math.max(hostBridge.duration, frameCache.duration)

    // Sidecar bridge + resident frame cache (G02 scrub enhancement)
    HostBridge {
        id: hostBridge
        Component.onCompleted: refresh()
        onThumbReady: function (image, seconds) {
            if (previewLoader.item)
                previewLoader.item.presentFrame(image)
            if (Math.abs(seconds - root.playhead) < 0.05)
                root.playhead = seconds
        }
        onProjectChanged: {
            if (mediaPath)
                frameCache.mediaPath = mediaPath
        }
        onError: function (message) {
            console.log("HostBridge:", message)
        }
    }
    FrameCache {
        id: frameCache
        capacity: 64
        fps: 30
        onFrameReady: function (image, seconds) {
            if (previewLoader.item)
                previewLoader.item.presentFrame(image)
        }
    }

    // Soft Silver stage + docked chrome (hairline, not floating dashboard islands)
    Item {
        anchors.fill: parent

        // —— Top chrome bar ——
        Rectangle {
            id: topbar
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            height: 52
            color: Qt.rgba(0.992, 0.992, 0.996, 0.86)
            z: 4

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 0.5
                color: root.line
            }

            Row {
                anchors.verticalCenter: parent.verticalCenter
                anchors.left: parent.left
                anchors.leftMargin: 14
                spacing: 10
                Rectangle {
                    width: 22; height: 22; radius: 6
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: "#f7f7f8" }
                        GradientStop { position: 0.45; color: "#c8c8cc" }
                        GradientStop { position: 1.0; color: "#5c5c60" }
                    }
                }
                Column {
                    spacing: 1
                    Text {
                        text: "DogSC"
                        color: root.platinum
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: qsTr("Qt6 Soft Silver")
                        color: root.faint
                        font.pixelSize: 10
                        font.weight: Font.Medium
                    }
                }
            }

            Row {
                anchors.verticalCenter: parent.verticalCenter
                anchors.right: parent.right
                anchors.rightMargin: 14
                spacing: 8
                Rectangle {
                    width: exportLabel.implicitWidth + 22
                    height: 30
                    radius: 9
                    color: root.platinum
                    Text {
                        id: exportLabel
                        anchors.centerIn: parent
                        text: qsTr("导出")
                        color: "#ffffff"
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.exportOpen = true
                    }
                }
            }
        }

        // —— Stage ——
        Item {
            id: stage
            anchors.left: parent.left
            anchors.right: inspector.left
            anchors.top: topbar.bottom
            anchors.bottom: timeline.top

            // Stage dots — Apple EditorWorkspaceGrid: stride 24, r0.6, α0.11 + dissolve
            Canvas {
                id: stageDots
                anchors.fill: parent
                opacity: 1
                layer.enabled: true
                layer.smooth: true
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

            // Soft radial wash — monitor atmosphere, not card glow
            Rectangle {
                anchors.fill: parent
                gradient: Gradient {
                    GradientStop { position: 0.0; color: Qt.rgba(1, 1, 1, 0.62) }
                    GradientStop { position: 0.48; color: "transparent" }
                    GradientStop { position: 1.0; color: Qt.rgba(0.1, 0.12, 0.18, 0.05) }
                }
                opacity: 0.92
            }

            // Canvas frame / preview — ContinuousPanel ≈ monitor continuous 10
            ContinuousPanel {
                id: canvasFrame
                width: Math.min(900, parent.width * 0.9)
                height: width * 9 / 16
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                anchors.verticalCenterOffset: root.cropping ? -22 : -14
                radius: 10
                smoothness: 0.6
                color: "#111111"
                borderColor: Qt.rgba(1, 1, 1, 0.06)
                borderWidth: 0.5
                clip: true

                Behavior on anchors.verticalCenterOffset {
                    NumberAnimation {
                        duration: root.settleMs
                        easing.type: Easing.OutCubic
                    }
                }

                Loader {
                    id: previewLoader
                    anchors.fill: parent
                    anchors.margins: 1
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

            // Stage corner — crop only (export lives in top chrome)
            Rectangle {
                anchors.top: parent.top
                anchors.right: parent.right
                anchors.margins: 16
                width: cropHudLabel.implicitWidth + 28
                height: 32
                radius: 10
                color: root.cropping ? root.platinum : root.panel
                border.color: root.line
                border.width: 0.5
                z: 4
                visible: !root.exportOpen

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

        // —— Inspector rail (docked chromeBar, Apple default 384, clamp 340–480) ——
        Rectangle {
            id: inspector
            anchors.right: parent.right
            anchors.top: topbar.bottom
            anchors.bottom: timeline.top
            width: root.inspectorWidth
            radius: 0
            color: root.panel
            z: 3

            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 0.5
                color: root.line
            }

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
                    width: 2
                    height: 36
                    radius: 1
                    color: Qt.rgba(0.12, 0.12, 0.14, 0.16)
                    opacity: resizeHandleMa.containsMouse || resizeHandleMa.pressed ? 1 : 0
                    Behavior on opacity { NumberAnimation { duration: 120 } }
                }

                MouseArea {
                    id: resizeHandleMa
                    anchors.fill: parent
                    anchors.leftMargin: -4
                    anchors.rightMargin: -4
                    hoverEnabled: true
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
                anchors.leftMargin: 12
                height: 44
                spacing: 2

                Repeater {
                    model: [qsTr("画面"), qsTr("开场"), qsTr("运镜"), qsTr("光标"), qsTr("摄像头"), qsTr("声音")]
                    delegate: Item {
                        width: root.inspectorTab === index ? label.implicitWidth + 36 : 36
                        height: 36
                        Behavior on width {
                            NumberAnimation {
                                duration: root.settleMs
                                easing.type: Easing.OutCubic
                            }
                        }
                        Rectangle {
                            anchors.fill: parent
                            radius: 18
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
                            font.pixelSize: 12
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

            Rectangle {
                anchors.top: rail.bottom
                anchors.topMargin: 8
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.margins: 12
                height: 0.5
                color: root.line
            }

            // Quiet cardFill wells — Soft Silver inspector density
            Column {
                anchors.top: rail.bottom
                anchors.topMargin: 20
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.margins: 14
                spacing: 10

                Rectangle {
                    width: parent.width
                    height: 88
                    radius: 12
                    color: root.well
                    Column {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 6
                        Text {
                            text: qsTr("背景")
                            color: root.faint
                            font.pixelSize: 11
                            font.weight: Font.DemiBold
                        }
                        Text {
                            width: parent.width
                            wrapMode: Text.WordWrap
                            text: qsTr("cardFill wells · platinum captions · no marketing CTA")
                            color: root.muted
                            font.pixelSize: 12
                        }
                    }
                }

                Text {
                    width: parent.width
                    wrapMode: Text.WordWrap
                    horizontalAlignment: Text.AlignLeft
                    color: root.faint
                    font.pixelSize: 11
                    text: qsTr("PreviewSurface + Vulkan next · Inspector %1 px")
                        .arg(Math.round(root.inspectorWidth))
                }
            }
        }

        // —— Timeline strip (flush chrome, hairline only) ——
        Rectangle {
            id: timeline
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 176
            color: root.panel
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
                color: root.panel

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

                Row {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: 14
                    spacing: 8
                    Rectangle {
                        width: tracksLabel.implicitWidth + 16
                        height: 28
                        radius: 8
                        color: root.well
                        Text {
                            id: tracksLabel
                            anchors.centerIn: parent
                            text: qsTr("轨道")
                            color: root.muted
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: hostBridge.connected
                              ? (hostBridge.projectName || qsTr("已连接"))
                              : qsTr("sidecar · 未连接")
                        color: root.faint
                        font.pixelSize: 11
                    }
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

            // Playhead line + capsule knob (NativeTimelinePlayheadView)
            // Scrub surface — drives HostBridge thumb + FrameCache decode
            MouseArea {
                id: scrubArea
                anchors.top: timelineBar.bottom
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                function scrubAt(mx) {
                    const dur = Math.max(root.mediaDuration, 0.001)
                    const t = Math.max(0, Math.min(1, mx / Math.max(width, 1))) * dur
                    root.playhead = t
                    hostBridge.playhead = t
                    if (frameCache.mediaPath)
                        frameCache.playhead = t
                }
                onPressed: function (mouse) { scrubAt(mouse.x) }
                onPositionChanged: function (mouse) {
                    if (pressed)
                        scrubAt(mouse.x)
                }
            }

            Item {
                id: playheadItem
                anchors.top: timelineBar.bottom
                anchors.bottom: parent.bottom
                x: root.mediaDuration > 0
                   ? (root.playhead / root.mediaDuration) * parent.width
                   : parent.width * 0.08
                width: 2
                z: 5
                Rectangle {
                    anchors.fill: parent
                    color: "#ff453b"
                    opacity: 0.9
                }
                Rectangle {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.top: parent.top
                    anchors.topMargin: 1
                    width: 11
                    height: 17
                    radius: 5.5
                    color: "#ff453b"
                    border.color: "#fdfdfe"
                    border.width: 1.5
                }
            }
            Item {
                anchors.top: timelineBar.bottom
                anchors.bottom: parent.bottom
                x: playheadItem.x + 18
                width: 1
                z: 4
                visible: scrubArea.containsMouse || scrubArea.pressed
                Rectangle {
                    anchors.top: parent.top
                    anchors.topMargin: 18
                    anchors.bottom: parent.bottom
                    width: 1
                    color: Qt.rgba(0.1, 0.12, 0.18, 0.42)
                    opacity: 0.85
                }
                Rectangle {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.top: parent.top
                    width: 62
                    height: 18
                    radius: 9
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: "#3a3d46" }
                        GradientStop { position: 1.0; color: "#23262d" }
                    }
                    border.color: Qt.rgba(1, 1, 1, 0.14)
                    border.width: 0.75
                    Text {
                        anchors.centerIn: parent
                        text: {
                            const t = root.playhead
                            const m = Math.floor(t / 60)
                            const s = Math.floor(t % 60)
                            const cs = Math.floor((t % 1) * 100)
                            const ss = (s < 10 ? "0" : "") + s
                            const cc = (cs < 10 ? "0" : "") + cs
                            return m + ":" + ss + "." + cc
                        }
                        color: "#fdfdfe"
                        font.pixelSize: 9
                        font.weight: Font.Medium
                        font.family: "ui-monospace"
                    }
                }
            }
        }

        // Stage HUD — regularMaterial pill over media (web Soft Silver parity)
        Rectangle {
            id: stageHud
            anchors.horizontalCenter: stage.horizontalCenter
            anchors.bottom: stage.bottom
            anchors.bottomMargin: 14
            width: hudRow.implicitWidth + 14
            height: 40
            radius: 20
            color: Qt.rgba(0.992, 0.992, 0.996, 0.86)
            border.color: root.line
            border.width: 0.5
            z: 7
            visible: !root.cropping && !root.exportOpen && !root.recording

            Row {
                id: hudRow
                anchors.centerIn: parent
                spacing: 2
                Repeater {
                    model: ["16:9", "⊡", "＋", "－"]
                    delegate: Rectangle {
                        width: 34; height: 34; radius: 17
                        color: "transparent"
                        Text {
                            anchors.centerIn: parent
                            text: modelData
                            color: root.muted
                            font.pixelSize: 11
                            font.weight: Font.Medium
                        }
                    }
                }
                Rectangle {
                    width: 1; height: 18
                    anchors.verticalCenter: parent.verticalCenter
                    color: root.line
                }
                Rectangle {
                    width: 34; height: 34; radius: 17
                    color: root.platinum
                    Text {
                        anchors.centerIn: parent
                        text: "▶"
                        color: "#ffffff"
                        font.pixelSize: 11
                    }
                }
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "00:00.00 / 00:04.00"
                    color: root.platinum
                    font.pixelSize: 12
                    font.family: "ui-monospace"
                    leftPadding: 6
                    rightPadding: 6
                }
            }
        }

        // Floating Soft Silver recorder island — frameless Tool window (G03)
        // Docked capsule removed; see RecorderIsland.qml (NSPanel stand-in).

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

    // Frameless Soft Silver recorder island (G03) — separate Tool window
    Loader {
        id: recorderIslandLoader
        active: true
        source: Qt.resolvedUrl("RecorderIsland.qml")
        asynchronous: false

        function placeIsland() {
            if (!item || !root.visible)
                return
            item.x = Math.round(root.x + (root.width - item.width) / 2)
            item.y = Math.round(root.y + root.height - item.height - 36)
        }

        function syncIsland() {
            if (!item)
                return
            item.islandVisible = root.visible && !root.cropping && !root.exportOpen
            item.recording = root.recording
            placeIsland()
        }

        onLoaded: {
            syncIsland()
            item.recordToggled.connect(function () {
                root.recording = item.recording
                if (item.recording)
                    hostBridge.startRecord()
                else
                    hostBridge.stopRecord()
            })
        }
    }

    onVisibleChanged: recorderIslandLoader.syncIsland()
    onXChanged: recorderIslandLoader.placeIsland()
    onYChanged: recorderIslandLoader.placeIsland()
    onWidthChanged: recorderIslandLoader.placeIsland()
    onHeightChanged: recorderIslandLoader.placeIsland()
    onCroppingChanged: recorderIslandLoader.syncIsland()
    onExportOpenChanged: recorderIslandLoader.syncIsland()
    onRecordingChanged: {
        if (recorderIslandLoader.item
                && recorderIslandLoader.item.recording !== root.recording)
            recorderIslandLoader.item.recording = root.recording
        recorderIslandLoader.syncIsland()
    }
}
