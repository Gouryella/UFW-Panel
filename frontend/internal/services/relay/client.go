package relay

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"ufwpanel/frontend/internal/models"
)

type Client struct {
	http *http.Client
}

func NewClient(timeout time.Duration) *Client {
	transport := &http.Transport{
		Proxy:           http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	return &Client{
		http: &http.Client{
			Timeout:   timeout,
			Transport: transport,
		},
	}
}

func (c *Client) Forward(ctx context.Context, backend *models.Backend, method, path string, body any) (*http.Response, error) {
	if backend == nil {
		return nil, fmt.Errorf("missing backend configuration")
	}

	fullURL, err := joinURL(backend.URL, path)
	if err != nil {
		return nil, err
	}

	var reader io.ReadCloser
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal payload: %w", err)
		}
		reader = io.NopCloser(bytes.NewReader(payload))
	} else {
		reader = http.NoBody
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, reader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("X-API-KEY", backend.APIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.http.Do(req)
}

func joinURL(base, path string) (string, error) {
	if base == "" {
		return "", fmt.Errorf("empty backend URL")
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("invalid backend URL: %w", err)
	}
	joined, err := url.Parse(path)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	if joined.Scheme != "" || joined.Host != "" {
		return joined.String(), nil
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + path
	return baseURL.String(), nil
}
