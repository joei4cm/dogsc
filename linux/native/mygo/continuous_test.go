package main

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestContinuousCornerPathClosed(t *testing.T) {
	p := continuousCornerPath(ui.Rect{X: 10, Y: 20, W: 200, H: 80}, 20)
	if p == nil {
		t.Fatal("nil path")
	}
	b := p.Bounds()
	if b.W < 199 || b.H < 79 {
		t.Fatalf("bounds=%+v", b)
	}
}

func TestContinuousCornerCapsule(t *testing.T) {
	p := continuousCornerPath(ui.Rect{W: 40, H: 40}, 20)
	if p.Bounds().W <= 0 {
		t.Fatal("empty capsule")
	}
}
