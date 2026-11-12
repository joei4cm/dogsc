package main

import (
	"time"

	"github.com/egoist/mygo/ui"
)

// Soft Silver tokens — match linux/dogsc/web/app.css and the Qt6 host.
// Opaque islands, platinum ink, paper stage. No purple chrome.
var (
	ssBg          = ui.Hex("#ecedef")
	ssPanel       = ui.Hex("#fdfdfe")
	ssPlatinum    = ui.Hex("#1f1f1f")
	ssPlatinumDeep = ui.Hex("#1a1a1a")
	ssMuted       = ui.RGBA(26, 31, 46, 0.55)
	ssOutline     = ui.RGBA(26, 31, 46, 0.075)
	ssLive        = ui.Hex("#e11d48") // recording accent only; not chrome
	ssRadiusIsland float32 = 20
	ssRadiusControl float32 = 12
)

// morphSpring mirrors Apple Soft Silver island morph:
// response ≈ 0.5s, dampingFraction ≈ 0.82 → Bounce ≈ 0.18.
var morphSpring = ui.Animation{
	Spring: ui.SpringOptions{
		Duration: 500 * time.Millisecond,
		Bounce:   0.18,
	},
}

// settleSpring is the quieter inspector / stage settle (~380ms, no bounce).
var settleSpring = ui.Animation{
	Spring: ui.SpringOptions{
		Duration: 380 * time.Millisecond,
		Bounce:   0,
	},
}
