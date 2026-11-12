package main

import (
	"fmt"

	"github.com/egoist/mygo"
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

func (m islandMode) size() (w, h float32) {
	switch m {
	case islandLive, islandPaused:
		return 360, 72
	case islandArmed:
		return 320, 64
	default:
		return 280, 56
	}
}

// recorderIsland is the floating Soft Silver slab (Apple NSPanel analogue).
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

	targetW, targetH := mode.size()
	root := ui.Column(c).Fill().Center().Background(ui.Transparent)
	w := root.AnimateTo("island.w", targetW, morphSpring)
	h := root.AnimateTo("island.h", targetH, morphSpring)

	// Keep the frameless window sized/anchored to the morphing island (G03).
	a.syncIslandWindow(int(w+40), int(h+40))

	ui.Column(c).Fill().Center().Children(func() {
		slab := ui.Column(c.Key("island")).
			Width(w).Height(h).
			Padding(10, 14).Gap(8)
		slab.Draw(func(p *ui.Painter, r ui.Rect) {
			paintSoftSilverIsland(p, r, ssRadiusIsland)
		})

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

func (a *app) syncIslandWindow(w, h int) {
	if a.islandWin == nil || w < 120 || h < 80 {
		return
	}
	if a.islandW == w && a.islandH == h {
		return
	}
	a.islandW, a.islandH = w, h
	ww, hh := w, h
	win := a.islandWin
	// Geometry from a goroutine via Update — never nest Screen calls inside
	// the view build (avoids main-thread re-entrancy).
	go win.Update(func() {
		d := mygo.Screen.PrimaryDisplay()
		work := d.WorkArea
		if work.Width <= 0 || work.Height <= 0 {
			work = d.Bounds
		}
		if work.Width <= 0 {
			return
		}
		x := work.X + (work.Width-ww)/2
		y := work.Y + work.Height - hh - 28
		if y < work.Y {
			y = work.Y
		}
		win.SetBounds(mygo.Rectangle{X: x, Y: y, Width: ww, Height: hh})
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
