// Soft Silver host rebuilt on MyGo native UI.
//
//	view(Go) → ui build/layout/paint → scene → gpu (GL on Linux)
//
// Capture stays in the Python sidecar (`dogsc edit --port 47321`).
//
//	go run .                  # needs a display session
//	./smoke_build.sh          # compile-only
package main

import (
	"flag"
	"log"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

type app struct {
	sidecar   *Sidecar
	islandWin *mygo.Window
	shellWin  *mygo.Window
	armed     bool
	preview   previewState
	islandW   int
	islandH   int
}

func (a *app) invalidate() {
	if a.islandWin != nil {
		a.islandWin.Invalidate()
	}
	if a.shellWin != nil {
		a.shellWin.Invalidate()
	}
}

func (a *app) poll() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for range ticker.C {
		a.sidecar.Refresh()
		a.invalidate()
	}
}

func main() {
	base := flag.String("sidecar", defaultSidecar, "Python Soft Silver sidecar base URL")
	flag.Parse()

	a := &app{sidecar: NewSidecar(*base)}
	a.sidecar.Refresh()

	mygo.App.WhenReady(func() {
		a.shellWin = mygo.NewWindow(mygo.WindowOptions{
			Title:   "DogSC Soft Silver",
			Width:   1080,
			Height:  720,
			Content: ui.View(a.editorShell),
		})
		a.islandWin = mygo.NewWindow(mygo.WindowOptions{
			Title:       "DogSC Recorder",
			Width:       400,
			Height:      120,
			Frameless:   true,
			Transparent: true,
			AlwaysOnTop: true,
			Content:     ui.View(a.recorderIsland),
		})
		a.syncIslandWindow(400, 120)
		go a.poll()
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
