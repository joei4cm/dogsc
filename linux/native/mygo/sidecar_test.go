package main

import (
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSidecarRecordAndProjects(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/record", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"active": true, "paused": false, "elapsed": 12.4, "session": "s1",
		})
	})
	mux.HandleFunc("/api/projects", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"id": "p1", "name": "Demo", "duration": 3.5, "media_path": "/tmp/a.mp4"},
		})
	})
	mux.HandleFunc("/api/record/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"active":true}`))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	s := NewSidecar(srv.URL)
	s.Refresh()
	online, errMsg, st, projs := s.Snapshot()
	if !online || errMsg != "" {
		t.Fatalf("online=%v err=%q", online, errMsg)
	}
	if !st.Active || st.Phase != "recording" {
		t.Fatalf("status=%+v", st)
	}
	if len(projs) != 1 || projs[0].MediaPath != "/tmp/a.mp4" {
		t.Fatalf("projects=%+v", projs)
	}
	if err := s.StartRecord(); err != nil {
		t.Fatal(err)
	}
}

func TestFormatElapsed(t *testing.T) {
	if got := formatElapsed(65); got != "1:05" {
		t.Fatalf("got %q", got)
	}
}

func TestSidecarProjectAndThumb(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/projects/p1", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id": "p1", "name": "Clip", "duration": 4.2, "media_path": "/tmp/clip.mp4",
		})
	})
	mux.HandleFunc("/api/projects/p1/thumb", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		img := image.NewRGBA(image.Rect(0, 0, 2, 2))
		img.Set(0, 0, color.RGBA{R: 200, G: 200, B: 200, A: 255})
		_ = png.Encode(w, img)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	s := NewSidecar(srv.URL)
	p, err := s.Project("p1")
	if err != nil || p.MediaPath != "/tmp/clip.mp4" {
		t.Fatalf("project=%+v err=%v", p, err)
	}
	img, err := s.Thumb("p1", 0.5)
	if err != nil || img == nil {
		t.Fatalf("thumb err=%v", err)
	}
	if s.MediaURL("p1") != srv.URL+"/api/projects/p1/media" {
		t.Fatalf("media url=%s", s.MediaURL("p1"))
	}
}
