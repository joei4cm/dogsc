package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/video"
)

// previewState holds the open project's scrub preview.
type previewState struct {
	mu sync.Mutex

	projectID string
	name      string
	duration  float64
	mediaPath string
	playhead  float64

	thumb   *ui.Bitmap
	thumbAt float64
	thumbErr string

	player *ui.VideoPlayer
	playerErr string
}

func (p *previewState) snapshot() (id, name string, dur, head float64, media string, thumb *ui.Bitmap, terr, perr string, player *ui.VideoPlayer) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.projectID, p.name, p.duration, p.playhead, p.mediaPath, p.thumb, p.thumbErr, p.playerErr, p.player
}

func (p *previewState) clearPlayer() {
	if p.player != nil {
		p.player.Close()
		p.player = nil
	}
	p.playerErr = ""
}

func (a *app) openProject(id string) {
	go func() {
		detail, err := a.sidecar.Project(id)
		a.preview.mu.Lock()
		a.preview.clearPlayer()
		if err != nil {
			a.preview.thumbErr = err.Error()
			a.preview.mu.Unlock()
			a.invalidate()
			return
		}
		a.preview.projectID = detail.ID
		a.preview.name = detail.Name
		a.preview.duration = detail.Duration
		a.preview.mediaPath = detail.MediaPath
		a.preview.playhead = 0
		a.preview.thumb = nil
		a.preview.thumbAt = -1
		a.preview.thumbErr = ""
		mediaPath := detail.MediaPath
		a.preview.mu.Unlock()

		if mediaPath != "" {
			if player, err := video.Open(mediaPath); err != nil {
				a.preview.mu.Lock()
				a.preview.playerErr = err.Error()
				a.preview.mu.Unlock()
			} else {
				player.Pause()
				player.SetMuted(true)
				a.preview.mu.Lock()
				a.preview.player = player
				a.preview.playerErr = ""
				a.preview.mu.Unlock()
			}
		}
		a.requestThumb(0)
		a.invalidate()
	}()
}

func (a *app) setPlayhead(t float64) {
	a.preview.mu.Lock()
	if a.preview.duration > 0 {
		if t < 0 {
			t = 0
		}
		if t > a.preview.duration {
			t = a.preview.duration
		}
	}
	a.preview.playhead = t
	player := a.preview.player
	a.preview.mu.Unlock()
	if player != nil {
		player.Seek(time.Duration(t * float64(time.Second)))
	}
	a.requestThumb(t)
}

func (a *app) requestThumb(at float64) {
	id, _, _, _, _, _, _, _, _ := a.preview.snapshot()
	if id == "" {
		return
	}
	go func(projectID string, sec float64) {
		img, err := a.sidecar.Thumb(projectID, sec)
		a.preview.mu.Lock()
		defer a.preview.mu.Unlock()
		if a.preview.projectID != projectID {
			return
		}
		if err != nil {
			a.preview.thumbErr = err.Error()
			a.invalidate()
			return
		}
		a.preview.thumb = ui.NewBitmap(img)
		a.preview.thumbAt = sec
		a.preview.thumbErr = ""
		a.invalidate()
	}(id, at)
}

func (a *app) previewStage(c *ui.Context) {
	id, name, dur, head, media, thumb, terr, perr, player := a.preview.snapshot()

	stage := ui.Column(c.Key("stage")).
		FillWidth().Grow(1).
		Padding(16).Gap(12)
	stage.Draw(func(p *ui.Painter, r ui.Rect) {
		paintSoftSilverIsland(p, r, ssRadiusIsland)
	})
	stage.Children(func() {
		if id == "" {
			ui.Column(c).Fill().Center().Gap(8).Children(func() {
				ui.Text(c, "预览舞台").FontSize(16).Bold().TextColor(ssPlatinum)
				ui.Text(c, "点选下方项目，或先用录制岛采一段。").FontSize(12).TextColor(ssMuted)
			})
			return
		}

		ui.Row(c).FillWidth().AlignItems(ui.Center).Gap(8).Children(func() {
			title := name
			if title == "" {
				title = id
			}
			ui.Text(c, title).FontSize(14).Bold().TextColor(ssPlatinum).Grow(1)
			ui.Text(c, formatElapsed(head)+" / "+formatElapsed(dur)).FontSize(12).TextColor(ssMuted)
		})

		frame := ui.Box(c.Key("frame")).FillWidth().Grow(1).Radius(12).Background(ssBg)
		frame.Children(func() {
			switch {
			case player != nil && player.Ready():
				ui.Video(c, player).Fill().Fit(ui.Contain)
			case thumb != nil:
				ui.Image(c, thumb).Fill().Fit(ui.Contain)
			default:
				msg := "加载预览…"
				if terr != "" {
					msg = terr
				} else if perr != "" {
					msg = "video: " + perr + " · 回退缩略图"
				}
				ui.Column(c).Fill().Center().Children(func() {
					ui.Text(c, msg).FontSize(12).TextColor(ssMuted)
				})
			}
		})

		if media != "" {
			ui.Text(c, media).FontSize(10).TextColor(ssMuted)
		}

		ph := head
		lo, hi := 0.0, dur
		if hi <= 0 {
			hi = 1
		}
		if ui.Slider(c.Key("scrub"), &ph, lo, hi).FillWidth().Changed() {
			a.setPlayhead(ph)
			if a.shellWin != nil {
				a.shellWin.Invalidate()
			}
		}
		ui.Text(c, fmt.Sprintf("playhead %.2fs", head)).FontSize(11).TextColor(ssMuted)
	})
}
