package main

import (
	"fmt"

	"github.com/egoist/mygo/ui"
)

// editorShell is the Soft Silver editor chrome: stage + projects strip.
// Preview frames stay with the sidecar / future VideoPlayer (G01).
func (a *app) editorShell(c *ui.Context) {
	online, errMsg, _, projects := a.sidecar.Snapshot()

	ui.Column(c).Fill().Background(ssBg).Padding(20).Gap(16).Children(func() {
		ui.Row(c).FillWidth().AlignItems(ui.Center).Gap(12).Children(func() {
			ui.Text(c, "DogSC").FontSize(22).Bold().TextColor(ssPlatinum)
			ui.Text(c, "Soft Silver · MyGo").FontSize(13).TextColor(ssMuted).Grow(1)
			status := "sidecar 离线"
			color := ssMuted
			if online {
				status = "sidecar 已连接"
				color = ssPlatinum.Alpha(0.7)
			}
			if errMsg != "" {
				status = errMsg
				color = ssLive
			}
			ui.Text(c, status).FontSize(12).TextColor(color)
			if ui.Button(c.Key("refresh"), "刷新").Radius(ssRadiusControl).Clicked() {
				go func() {
					a.sidecar.Refresh()
					if a.shellWin != nil {
						a.shellWin.Invalidate()
					}
				}()
			}
		})

		// Stage — opaque Soft Silver panel (hero plane for preview later).
		ui.Column(c.Key("stage")).
			FillWidth().Grow(1).
			Radius(ssRadiusIsland).
			Background(ssPanel).
			Border(1, ssOutline).
			Padding(24).
			Center().
			Children(func() {
				ui.Column(c).Gap(8).Center().Children(func() {
					ui.Text(c, "预览舞台").FontSize(16).Bold().TextColor(ssPlatinum)
					ui.Text(c, "GPU 预览走 MyGo ui/video（GStreamer）或沿用 Qt6 PreviewSurface").
						FontSize(12).TextColor(ssMuted)
				})
			})

		ui.Column(c).FillWidth().Gap(8).Children(func() {
			ui.Text(c, "项目").FontSize(13).Bold().TextColor(ssPlatinum)
			if len(projects) == 0 {
				ui.Text(c, "暂无项目 — 先用录制岛采一段，或打开 Web Soft Silver 导入。").
					FontSize(12).TextColor(ssMuted)
				return
			}
			ui.Row(c).Gap(8).Children(func() {
				for i, p := range projects {
					if i >= 6 {
						break
					}
					label := p.Name
					if label == "" {
						label = p.ID
					}
					ui.Column(c.Key(fmt.Sprintf("p-%s", p.ID))).
						Width(140).Padding(10, 12).Gap(4).
						Radius(ssRadiusControl).
						Background(ssPanel).
						Border(1, ssOutline).
						Children(func() {
							ui.Text(c, label).FontSize(12).Bold().TextColor(ssPlatinum)
							ui.Text(c, fmt.Sprintf("%.1fs", p.Duration)).FontSize(11).TextColor(ssMuted)
						})
				}
			})
		})
	})
}
