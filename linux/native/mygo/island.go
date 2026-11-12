package main

import (
	"fmt"

	"github.com/egoist/mygo/ui"
)

// islandMode is the Soft Silver recorder island phase.
type islandMode int

const (
	islandIdle islandMode = iota
	islandArmed
	islandLive
	islandPaused
)

func (m islandMode) label() string {
	switch m {
	case islandArmed:
		return "准备录制"
	case islandLive:
		return "录制中"
	case islandPaused:
		return "已暂停"
	default:
		return "DogSC"
	}
}

// recorderIsland is the floating Soft Silver slab (Apple NSPanel analogue).
// Built every frame from app state — MyGo's view rebuild model.
func (a *app) recorderIsland(c *ui.Context) {
	online, errMsg, status, _ := a.sidecar.Snapshot()
	mode := islandIdle
	if online {
		switch {
		case status.Active && status.Paused:
			mode = islandPaused
		case status.Active:
			mode = islandLive
		default:
			mode = islandIdle
		}
	}
	if a.armed && mode == islandIdle {
		mode = islandArmed
	}

	// Morph width/height with Apple Soft Silver spring (0.5 / ~0.82).
	targetW, targetH := float32(280), float32(56)
	if mode == islandLive || mode == islandPaused {
		targetW, targetH = 360, 72
	} else if mode == islandArmed {
		targetW, targetH = 320, 64
	}

	root := ui.Column(c).Fill().Center().Background(ui.Transparent)
	w := root.AnimateTo("island.w", targetW, morphSpring)
	h := root.AnimateTo("island.h", targetH, morphSpring)

	ui.Column(c).Fill().Center().Children(func() {
		slab := ui.Column(c.Key("island")).
			Width(w).Height(h).
			Radius(ssRadiusIsland).
			Background(ssPanel).
			Border(1, ssOutline).
			Padding(10, 14).
			Gap(8).
			Shadow(0, 1.5, 4, 0, ui.RGBA(0, 0, 0, 0.06)).
			Shadow(0, 8, 18, 0, ui.RGBA(0, 0, 0, 0.08)).
			Shadow(0, 18, 44, 0, ui.RGBA(0, 0, 0, 0.06))

		// Press scale 0.96 — Soft Silver control feedback.
		pressTarget := float32(1)
		if slab.Pressed() {
			pressTarget = 0.96
		}
		press := slab.AnimateTo("press", pressTarget, settleSpring)
		slab.Scale(press, press)

		slab.Children(func() {
			ui.Row(c).Fill().AlignItems(ui.Center).Gap(10).Children(func() {
				dot := ui.Box(c.Key("dot")).Width(10).Height(10).Radius(5)
				switch mode {
				case islandLive:
					dot.Background(ssLive)
				case islandPaused:
					dot.Background(ssPlatinum.Alpha(0.45))
				default:
					dot.Background(ssPlatinum.Alpha(0.2))
				}

				title := mode.label()
				if mode == islandLive || mode == islandPaused {
					title = fmt.Sprintf("%s  %s", mode.label(), formatElapsed(status.Elapsed))
				}
				ui.Text(c, title).FontSize(13).Bold().TextColor(ssPlatinum).Grow(1)

				if !online {
					ui.Text(c, "sidecar 离线").FontSize(11).TextColor(ssMuted)
				} else if errMsg != "" {
					ui.Text(c, "桥接错误").FontSize(11).TextColor(ssLive)
				}

				a.islandButtons(c, mode, online)
			})
		})
	})
}

func (a *app) islandButtons(c *ui.Context, mode islandMode, online bool) {
	run := func(fn func() error, after func()) {
		go func() {
			_ = fn()
			a.sidecar.Refresh()
			if a.islandWin != nil {
				a.islandWin.Update(func() {
					if after != nil {
						after()
					}
				})
			} else {
				a.invalidate()
			}
		}()
	}

	switch mode {
	case islandIdle, islandArmed:
		if ui.PrimaryButton(c.Key("rec"), "录制").
			Background(ssPlatinum).TextColor(ssPanel).
			Radius(ssRadiusControl).Disabled(!online).Clicked() {
			a.armed = true
			run(a.sidecar.StartRecord, nil)
		}
	case islandLive:
		if ui.Button(c.Key("pause"), "暂停").Radius(ssRadiusControl).Clicked() {
			run(a.sidecar.PauseRecord, nil)
		}
		if ui.PrimaryButton(c.Key("stop"), "停止").
			Background(ssLive).TextColor(ssPanel).
			Radius(ssRadiusControl).Clicked() {
			run(a.sidecar.StopRecord, func() { a.armed = false })
		}
	case islandPaused:
		if ui.Button(c.Key("resume"), "继续").Radius(ssRadiusControl).Clicked() {
			run(a.sidecar.ResumeRecord, nil)
		}
		if ui.PrimaryButton(c.Key("stop2"), "停止").
			Background(ssLive).TextColor(ssPanel).
			Radius(ssRadiusControl).Clicked() {
			run(a.sidecar.StopRecord, func() { a.armed = false })
		}
	}
}

func formatElapsed(sec float64) string {
	if sec < 0 {
		sec = 0
	}
	s := int(sec + 0.5)
	return fmt.Sprintf("%d:%02d", s/60, s%60)
}
