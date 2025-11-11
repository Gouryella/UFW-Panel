package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"ufwpanel/frontend/internal/models"

	_ "modernc.org/sqlite"
)

type BackendRepository struct {
	db *sql.DB
}

func NewBackendRepository(dbPath string) (*BackendRepository, error) {
	if err := ensureDir(dbPath); err != nil {
		return nil, fmt.Errorf("prepare db directory: %w", err)
	}

	dsn := fmt.Sprintf("file:%s?_fk=1", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &BackendRepository{db: db}, nil
}

func ensureDir(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	return nil
}

func migrate(db *sql.DB) error {
	stmt := `
	CREATE TABLE IF NOT EXISTS backends (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		url TEXT NOT NULL UNIQUE,
		apiKey TEXT NOT NULL,
		createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if _, err := db.Exec(stmt); err != nil {
		return fmt.Errorf("create table backends: %w", err)
	}
	return nil
}

func (r *BackendRepository) Close() error {
	if r == nil || r.db == nil {
		return nil
	}
	return r.db.Close()
}

func (r *BackendRepository) List(ctx context.Context) ([]models.Backend, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, url FROM backends ORDER BY createdAt DESC`)
	if err != nil {
		return nil, fmt.Errorf("query backends: %w", err)
	}
	defer rows.Close()

	var backends []models.Backend
	for rows.Next() {
		var b models.Backend
		if err := rows.Scan(&b.ID, &b.Name, &b.URL); err != nil {
			return nil, fmt.Errorf("scan backend: %w", err)
		}
		backends = append(backends, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate backends: %w", err)
	}
	return backends, nil
}

func (r *BackendRepository) Get(ctx context.Context, id string) (*models.Backend, error) {
	var backend models.Backend
	err := r.db.QueryRowContext(ctx, `SELECT id, name, url, apiKey FROM backends WHERE id = ?`, id).
		Scan(&backend.ID, &backend.Name, &backend.URL, &backend.APIKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get backend %s: %w", id, err)
	}
	return &backend, nil
}

func (r *BackendRepository) Create(ctx context.Context, backend models.Backend) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO backends (id, name, url, apiKey) VALUES (?, ?, ?, ?)`,
		backend.ID, backend.Name, backend.URL, backend.APIKey,
	)
	if err != nil {
		return fmt.Errorf("insert backend: %w", err)
	}
	return nil
}

func (r *BackendRepository) Delete(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM backends WHERE id = ?`, id)
	if err != nil {
		return false, fmt.Errorf("delete backend %s: %w", id, err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("rows affected: %w", err)
	}
	return affected > 0, nil
}

func (r *BackendRepository) Update(ctx context.Context, backend models.Backend) error {
	_, err := r.db.ExecContext(
		ctx,
		`UPDATE backends SET name = ?, url = ?, apiKey = ? WHERE id = ?`,
		backend.Name, backend.URL, backend.APIKey, backend.ID,
	)
	if err != nil {
		return fmt.Errorf("update backend %s: %w", backend.ID, err)
	}
	return nil
}
