package main

import (
	"fmt"

	"github.com/egoist/mygo/ui"
)

// editorShell is the Soft Silver editor chrome: stage + projects strip.
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
					a.invalidate()
				}()
			}
		})

		a.previewStage(c)

		ui.Column(c).FillWidth().Gap(8).Children(func() {
			ui.Text(c, "项目").FontSize(13).Bold().TextColor(ssPlatinum)
			if len(projects) == 0 {
				ui.Text(c, "暂无项目 — 先用录制岛采一段，或打开 Web Soft Silver 导入。").
					FontSize(12).TextColor(ssMuted)
				return
			}
			ui.Row(c).Gap(8).Children(func() {
				cur, _, _, _, _, _, _, _, _ := a.preview.snapshot()
				for i, p := range projects {
					if i >= 8 {
						break
					}
					label := p.Name
					if label == "" {
						label = p.ID
					}
					card := ui.Column(c.Key(fmt.Sprintf("p-%s", p.ID))).
						Width(148).Padding(10, 12).Gap(4)
					card.Draw(func(pr *ui.Painter, r ui.Rect) {
						fill := ssPanel
						if p.ID == cur {
							fill = ui.Hex("#f7f7f8")
						}
						pr.FillPath(continuousCornerPath(r, ssRadiusControl), fill)
						if p.ID == cur {
							inner := ui.Rect{X: r.X + 0.5, Y: r.Y + 0.5, W: r.W - 1, H: r.H - 1}
							pr.StrokePath(continuousCornerPath(inner, ssRadiusControl), 1.5, ssPlatinum.Alpha(0.35))
						}
					})
					if card.Clicked() {
						a.openProject(p.ID)
					}
					card.Children(func() {
						ui.Text(c, label).FontSize(12).Bold().TextColor(ssPlatinum)
						ui.Text(c, fmt.Sprintf("%.1fs", p.Duration)).FontSize(11).TextColor(ssMuted)
					})
				}
			})
		})
	})
}
