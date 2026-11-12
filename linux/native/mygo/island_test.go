package main

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

// Headless Soft Silver island: MyGo rebuilds the view without a window.
func TestRecorderIslandBuilds(t *testing.T) {
	a := &app{sidecar: NewSidecar("http://127.0.0.1:9")}
	tt := ui.NewTester(a.recorderIsland, 420, 140)
	tt.Frame()
	if tt.FramePending() {
		tt.Frame()
	}
}

func TestEditorShellBuilds(t *testing.T) {
	a := &app{sidecar: NewSidecar("http://127.0.0.1:9")}
	tt := ui.NewTester(a.editorShell, 960, 640)
	tt.Frame()
}
