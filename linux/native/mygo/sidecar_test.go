package main

import (
	"encoding/json"
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
