package handlers

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"ufwpanel/frontend/internal/models"
	"ufwpanel/frontend/internal/storage"
)

type BackendHandler struct {
	repo *storage.BackendRepository
}

func NewBackendHandler(repo *storage.BackendRepository) *BackendHandler {
	return &BackendHandler{repo: repo}
}

func (h *BackendHandler) Register(rg *gin.RouterGroup) {
	rg.GET("/backends", h.list)
	rg.POST("/backends", h.create)
	rg.DELETE("/backends", h.remove)
}

func (h *BackendHandler) list(c *gin.Context) {
	ctx := c.Request.Context()
	backends, err := h.repo.List(ctx)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to fetch backends.", err.Error())
		return
	}
	c.JSON(http.StatusOK, backends)
}

func (h *BackendHandler) create(c *gin.Context) {
	type request struct {
		Name   string `json:"name"`
		URL    string `json:"url"`
		APIKey string `json:"apiKey"`
	}

	var body request
	if err := c.ShouldBindJSON(&body); err != nil {
		writeError(c, http.StatusBadRequest, "Invalid payload.", nil)
		return
	}

	body.Name = strings.TrimSpace(body.Name)
	body.URL = strings.TrimSpace(body.URL)
	body.APIKey = strings.TrimSpace(body.APIKey)

	if body.Name == "" || body.URL == "" || body.APIKey == "" {
		writeError(c, http.StatusBadRequest, "Missing required fields: name, url, apiKey.", nil)
		return
	}

	if !isValidURL(body.URL) {
		writeError(c, http.StatusBadRequest, "Invalid URL format.", nil)
		return
	}

	backend := models.Backend{
		ID:     uuid.NewString(),
		Name:   body.Name,
		URL:    body.URL,
		APIKey: body.APIKey,
	}

	ctx := c.Request.Context()
	if err := h.repo.Create(ctx, backend); err != nil {
		if isUniqueViolation(err) {
			writeError(c, http.StatusConflict, "A backend with this URL already exists.", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, "Failed to add backend.", err.Error())
		return
	}

	c.JSON(http.StatusCreated, backend)
}

func (h *BackendHandler) remove(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		writeError(c, http.StatusBadRequest, "Missing backend ID query parameter.", nil)
		return
	}

	ctx := c.Request.Context()
	deleted, err := h.repo.Delete(ctx, id)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to remove backend.", err.Error())
		return
	}
	if !deleted {
		writeError(c, http.StatusNotFound, "Backend configuration not found.", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backend removed successfully"})
}

func isValidURL(raw string) bool {
	u, err := url.ParseRequestURI(raw)
	if err != nil {
		return false
	}
	return u.Scheme != "" && u.Host != ""
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "UNIQUE constraint failed")
}
