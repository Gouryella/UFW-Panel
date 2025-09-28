package app

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"ufwpanel/frontend/internal/config"
	"ufwpanel/frontend/internal/handlers"
	"ufwpanel/frontend/internal/middleware"
	"ufwpanel/frontend/internal/services/auth"
	"ufwpanel/frontend/internal/services/relay"
	"ufwpanel/frontend/internal/storage"
)

type Server struct {
	engine *gin.Engine
	repo   *storage.BackendRepository
}

func NewServer(cfg *config.Config) (*Server, error) {
	repo, err := storage.NewBackendRepository(cfg.DatabasePath)
	if err != nil {
		return nil, err
	}

	authSvc := auth.NewService(cfg)
	relayClient := relay.NewClient(30 * time.Second)

	router := gin.New()
	router.Use(gin.Recovery(), gin.Logger())

	corsCfg := cors.Config{
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{"Content-Type", "X-API-KEY", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	allowAnyOrigin := len(cfg.AllowedOrigins) == 0
	if !allowAnyOrigin {
		for _, origin := range cfg.AllowedOrigins {
			if strings.TrimSpace(origin) == "*" {
				allowAnyOrigin = true
				break
			}
		}
	}

	if allowAnyOrigin {
		corsCfg.AllowOriginFunc = func(origin string) bool {
			return origin != ""
		}
	} else {
		corsCfg.AllowOrigins = cfg.AllowedOrigins
	}

	router.Use(cors.New(corsCfg))

	authHandler := handlers.NewAuthHandler(authSvc)
	backendHandler := handlers.NewBackendHandler(repo)
	firewallHandler := handlers.NewFirewallHandler(repo, relayClient)

	api := router.Group("/api")
	{
		public := api.Group("")
		authHandler.Register(public)

		secured := api.Group("")
		secured.Use(middleware.RequireAuth(authSvc))
		backendHandler.Register(secured)
		firewallHandler.Register(secured)
	}

	registerStatic(router, cfg.StaticDir)

	return &Server{engine: router, repo: repo}, nil
}

func (s *Server) Engine() *gin.Engine {
	return s.engine
}

func (s *Server) Close() error {
	if s.repo != nil {
		return s.repo.Close()
	}
	return nil
}

func registerStatic(router *gin.Engine, distDir string) {
	if distDir == "" {
		return
	}

	router.Static("/_next", filepath.Join(distDir, "_next"))
	router.Static("/static", filepath.Join(distDir, "static"))
	router.Static("/assets", filepath.Join(distDir, "assets"))

	router.GET("/", func(c *gin.Context) {
		serveIndex(c, distDir)
	})

	router.NoRoute(func(c *gin.Context) {
		requestPath := strings.TrimPrefix(c.Request.URL.Path, "/")
		if requestPath == "" {
			serveIndex(c, distDir)
			return
		}

		attempts := []string{
			requestPath,
			filepath.Join(requestPath, "index.html"),
		}

		for _, rel := range attempts {
			if serveFile(c, distDir, rel) {
				return
			}
		}

		serveIndex(c, distDir)
	})
}

func serveFile(c *gin.Context, distDir, relative string) bool {
	fullPath := filepath.Join(distDir, filepath.Clean(relative))
	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		return false
	}

	c.File(fullPath)
	return true
}

func serveIndex(c *gin.Context, distDir string) {
	if !serveFile(c, distDir, "index.html") {
		c.Status(http.StatusNotFound)
	}
}
