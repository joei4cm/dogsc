package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const defaultSidecar = "http://127.0.0.1:47321"

// Sidecar talks to the Python Soft Silver bridge (`dogsc edit --port 47321`),
// same contract as Qt6 HostBridge.
type Sidecar struct {
	Base   string
	Client *http.Client

	mu      sync.Mutex
	status  RecordStatus
	projs   []Project
	err     string
	online  bool
}

type RecordStatus struct {
	Active  bool   `json:"active"`
	Paused  bool   `json:"paused"`
	Phase   string `json:"phase"`
	Elapsed float64 `json:"elapsed"`
	Session string `json:"session"`
}

type Project struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Duration float64 `json:"duration"`
	MediaPath string `json:"media_path"`
}

func NewSidecar(base string) *Sidecar {
	if base == "" {
		base = defaultSidecar
	}
	return &Sidecar{
		Base: base,
		Client: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

func (s *Sidecar) Snapshot() (online bool, err string, status RecordStatus, projects []Project) {
	s.mu.Lock()
	defer s.mu.Unlock()
	projs := append([]Project(nil), s.projs...)
	return s.online, s.err, s.status, projs
}

func (s *Sidecar) Refresh() {
	status, err := s.getRecord()
	projs, err2 := s.listProjects()
	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		s.online = false
		s.err = err.Error()
		return
	}
	s.online = true
	s.status = status
	if err2 != nil {
		s.err = err2.Error()
		return
	}
	s.projs = projs
	s.err = ""
}

func (s *Sidecar) StartRecord() error {
	_, err := s.post("/api/record/start", map[string]any{})
	return err
}

func (s *Sidecar) StopRecord() error {
	_, err := s.post("/api/record/stop", nil)
	return err
}

func (s *Sidecar) PauseRecord() error {
	_, err := s.post("/api/record/pause", nil)
	return err
}

func (s *Sidecar) ResumeRecord() error {
	_, err := s.post("/api/record/resume", nil)
	return err
}

func (s *Sidecar) getRecord() (RecordStatus, error) {
	var st RecordStatus
	if err := s.getJSON("/api/record", &st); err != nil {
		return st, err
	}
	if st.Phase == "" {
		switch {
		case st.Active && st.Paused:
			st.Phase = "paused"
		case st.Active:
			st.Phase = "recording"
		default:
			st.Phase = "idle"
		}
	}
	return st, nil
}

func (s *Sidecar) listProjects() ([]Project, error) {
	var raw any
	if err := s.getJSON("/api/projects", &raw); err != nil {
		return nil, err
	}
	switch v := raw.(type) {
	case []any:
		out := make([]Project, 0, len(v))
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			out = append(out, projectFromMap(m))
		}
		return out, nil
	case map[string]any:
		if items, ok := v["items"].([]any); ok {
			out := make([]Project, 0, len(items))
			for _, item := range items {
				m, ok := item.(map[string]any)
				if !ok {
					continue
				}
				out = append(out, projectFromMap(m))
			}
			return out, nil
		}
	}
	return nil, fmt.Errorf("unexpected /api/projects shape")
}

func projectFromMap(m map[string]any) Project {
	p := Project{
		ID:   asString(m["id"]),
		Name: asString(m["name"]),
	}
	switch d := m["duration"].(type) {
	case float64:
		p.Duration = d
	}
	p.MediaPath = asString(m["media_path"])
	if p.MediaPath == "" {
		p.MediaPath = asString(m["mediaPath"])
	}
	return p
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func (s *Sidecar) getJSON(path string, dest any) error {
	resp, err := s.Client.Get(s.Base + path)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s: HTTP %d", path, resp.StatusCode)
	}
	return json.Unmarshal(body, dest)
}

func (s *Sidecar) post(path string, payload any) (json.RawMessage, error) {
	var buf bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&buf).Encode(payload); err != nil {
			return nil, err
		}
	}
	resp, err := s.Client.Post(s.Base+path, "application/json", &buf)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s: HTTP %d: %s", path, resp.StatusCode, bytes.TrimSpace(body))
	}
	return body, nil
}
