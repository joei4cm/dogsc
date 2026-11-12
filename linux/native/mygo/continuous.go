package main

import (
	"math"

	"github.com/egoist/mygo/ui"
)

// continuousSmoothness ≈ Apple cornerCurve=.continuous / Qt ContinuousCorner 0.6.
const continuousSmoothness float32 = 0.6

// continuousCornerPath builds a Figma/iOS smooth-corner cubic path, matching
// linux/native/qt6/ContinuousCorner.cpp so Linux Soft Silver islands are not
// stuck on circular CSS radii (mygo's Op.Continuous is darwin-only today).
func continuousCornerPath(r ui.Rect, radius float32) *ui.Path {
	path := &ui.Path{}
	if r.W <= 0 || r.H <= 0 {
		return path
	}
	maxR := float32(math.Min(float64(r.W), float64(r.H)) / 2)
	if radius < 0 {
		radius = 0
	}
	if radius > maxR {
		radius = maxR
	}
	smooth := continuousSmoothness
	if smooth < 0 {
		smooth = 0
	}
	if smooth > 1 {
		smooth = 1
	}

	left, top := r.X, r.Y
	right, bottom := r.X+r.W, r.Y+r.H

	if radius <= 0 {
		path.MoveTo(left, top).LineTo(right, top).LineTo(right, bottom).LineTo(left, bottom).Close()
		return path
	}

	// Capsule / circle — ellipse reads closer than a forced continuous corner.
	if radius >= maxR-0.25 && math.Abs(float64(r.W-r.H)) < 0.5 {
		cx, cy := left+r.W/2, top+r.H/2
		rx, ry := r.W/2, r.H/2
		// 4-cubic ellipse approximation (kappa).
		k := float32(0.5522847498)
		path.MoveTo(cx, top)
		path.CubeTo(cx+rx*k, top, right, cy-ry*k, right, cy)
		path.CubeTo(right, cy+ry*k, cx+rx*k, bottom, cx, bottom)
		path.CubeTo(cx-rx*k, bottom, left, cy+ry*k, left, cy)
		path.CubeTo(left, cy-ry*k, cx-rx*k, top, cx, top)
		path.Close()
		return path
	}

	p := radius * (1 + smooth*0.528665)
	edge := float32(math.Min(float64(p), math.Min(float64(r.W), float64(r.H))/2))
	kappa := float32(0.551915024494 + float64(smooth)*0.086)
	handle := radius * kappa * (1 - smooth*0.18)

	ex := float32(math.Min(float64(edge), float64(r.W)/2))
	ey := float32(math.Min(float64(edge), float64(r.H)/2))
	hx := float32(math.Min(float64(handle), float64(ex)))
	hy := float32(math.Min(float64(handle), float64(ey)))

	path.MoveTo(left+ex, top)
	path.LineTo(right-ex, top)
	path.CubeTo(right-ex+hx, top, right, top+ey-hy, right, top+ey)
	path.LineTo(right, bottom-ey)
	path.CubeTo(right, bottom-ey+hy, right-ex+hx, bottom, right-ex, bottom)
	path.LineTo(left+ex, bottom)
	path.CubeTo(left+ex-hx, bottom, left, bottom-ey+hy, left, bottom-ey)
	path.LineTo(left, top+ey)
	path.CubeTo(left, top+ey-hy, left+ex-hx, top, left+ex, top)
	path.Close()
	return path
}

func paintSoftSilverIsland(p *ui.Painter, r ui.Rect, radius float32) {
	// Layered Soft Silver shadows (G11: r1.5 / 18 / 44).
	for _, sh := range []struct {
		dx, dy, grow float32
		c            ui.Color
	}{
		{0, 1.5, 2, ui.RGBA(0, 0, 0, 0.06)},
		{0, 8, 6, ui.RGBA(0, 0, 0, 0.08)},
		{0, 18, 10, ui.RGBA(0, 0, 0, 0.06)},
	} {
		sr := ui.Rect{X: r.X + sh.dx - sh.grow, Y: r.Y + sh.dy - sh.grow, W: r.W + sh.grow*2, H: r.H + sh.grow*2}
		p.FillPath(continuousCornerPath(sr, radius+sh.grow), sh.c)
	}
	p.FillPath(continuousCornerPath(r, radius), ssPanel)
	// Quiet top highlight hairline inside the slab.
	hi := ui.Rect{X: r.X + 1, Y: r.Y + 1, W: r.W - 2, H: 1}
	p.Fill(hi, ui.RGBA(255, 255, 255, 0.55), 0)
}
