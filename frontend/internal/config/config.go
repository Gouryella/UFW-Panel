package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultListenAddr   = ":8080"
	DefaultStaticDir    = "./out"
	DefaultDatabasePath = "./database/ufw-webui.db"
	DefaultJWTExpiry    = "1d"
	CookieName          = "auth_token"
)

type Config struct {
	ListenAddr     string
	StaticDir      string
	DatabasePath   string
	AuthPassword   string
	JWTSecret      []byte
	JWTExpiresIn   time.Duration
	AllowedOrigins []string
}

func Load() (*Config, error) {
	listenAddr := getEnvOrDefault("PORT", DefaultListenAddr)
	if listenAddr != "" && listenAddr[0] != ':' {
		listenAddr = ":" + listenAddr
	}

	staticDir := getEnvOrDefault("FRONTEND_DIST_DIR", DefaultStaticDir)
	dbPath := getEnvOrDefault("FRONTEND_DB_PATH", DefaultDatabasePath)
	authPassword := os.Getenv("AUTH_PASSWORD")
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is not set")
	}

	expiresExpr := getEnvOrDefault("JWT_EXPIRATION", DefaultJWTExpiry)
	expiresIn, err := parseExpiry(expiresExpr)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRATION: %w", err)
	}

	allowedOrigins := parseOrigins(os.Getenv("FRONTEND_ALLOWED_ORIGINS"))

	return &Config{
		ListenAddr:     listenAddr,
		StaticDir:      staticDir,
		DatabasePath:   dbPath,
		AuthPassword:   authPassword,
		JWTSecret:      []byte(jwtSecret),
		JWTExpiresIn:   expiresIn,
		AllowedOrigins: allowedOrigins,
	}, nil
}

func getEnvOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseExpiry(expr string) (time.Duration, error) {
	if expr == "" {
		return 0, fmt.Errorf("empty expiration expression")
	}

	switch suffix := expr[len(expr)-1]; suffix {
	case 'd', 'h', 'm':
		base := expr[:len(expr)-1]
		value, err := strconv.ParseInt(base, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid expiration value %q: %w", expr, err)
		}
		multiplier := map[byte]time.Duration{'d': 24 * time.Hour, 'h': time.Hour, 'm': time.Minute}
		return time.Duration(value) * multiplier[suffix], nil
	default:
		value, err := strconv.ParseInt(expr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid expiration value %q: %w", expr, err)
		}
		return time.Duration(value) * time.Second, nil
	}
}

func parseOrigins(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	var cleaned []string
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	return cleaned
}
