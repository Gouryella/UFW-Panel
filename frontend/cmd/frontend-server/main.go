package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/joho/godotenv"

    "ufwpanel/frontend/internal/app"
    "ufwpanel/frontend/internal/config"
)

func main() {
    if err := godotenv.Load(); err != nil {
        log.Printf("warning: %v", err)
    }

    cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	server, err := app.NewServer(cfg)
	if err != nil {
		log.Fatalf("failed to initialise server: %v", err)
	}
	defer func() {
		if err := server.Close(); err != nil {
			log.Printf("error closing server resources: %v", err)
		}
	}()

	httpServer := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: server.Engine(),
	}

	go func() {
		log.Printf("frontend server listening on %s", cfg.ListenAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	} else {
		log.Println("server stopped")
	}
}
