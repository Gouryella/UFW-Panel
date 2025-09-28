package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"ufwpanel/frontend/internal/models"
	"ufwpanel/frontend/internal/services/relay"
	"ufwpanel/frontend/internal/storage"
)

type FirewallHandler struct {
	repo  *storage.BackendRepository
	relay *relay.Client
}

func NewFirewallHandler(repo *storage.BackendRepository, relayClient *relay.Client) *FirewallHandler {
	return &FirewallHandler{repo: repo, relay: relayClient}
}

func (h *FirewallHandler) Register(rg *gin.RouterGroup) {
	rg.GET("/status", h.status)
	rg.POST("/enable", h.enable)
	rg.POST("/disable", h.disable)
	rg.POST("/rules/allow", h.allowRule)
	rg.POST("/rules/deny", h.denyRule)
	rg.POST("/rules/allow/ip", h.allowIP)
	rg.POST("/rules/deny/ip", h.denyIP)
	rg.DELETE("/rules/delete/:ruleNumber", h.deleteRule)
}

func (h *FirewallHandler) status(c *gin.Context) {
	backend, ok := h.lookupBackend(c)
	if !ok {
		return
	}

	resp, err := h.relay.Forward(c.Request.Context(), backend, http.MethodGet, "/status", nil)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to fetch status from backend.", err.Error())
		return
	}
	defer resp.Body.Close()

	payloadAny, empty, err := decodeJSON(resp.Body)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to decode backend response.", err.Error())
		return
	}

	if empty {
		payloadAny = map[string]any{}
	}

	payload, ok := payloadAny.(map[string]any)
	if !ok {
		writeError(c, http.StatusInternalServerError, "Unexpected backend payload shape.", nil)
		return
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeError(c, resp.StatusCode, "Failed to fetch status from backend", payload)
		return
	}

	status, ok := payload["status"]
	if !ok {
		status = "unknown"
	}
	rules, ok := payload["rules"]
	if !ok {
		rules = []any{}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
		"rules":  rules,
	})
}

func (h *FirewallHandler) enable(c *gin.Context) {
	h.forwardWithoutBody(c, http.MethodPost, "/enable", "Failed to enable UFW")
}

func (h *FirewallHandler) disable(c *gin.Context) {
	h.forwardWithoutBody(c, http.MethodPost, "/disable", "Failed to disable UFW")
}

func (h *FirewallHandler) allowRule(c *gin.Context) {
	h.forwardWithBody(c, http.MethodPost, "/rules/allow", "Failed to add allow rule", "rule")
}

func (h *FirewallHandler) denyRule(c *gin.Context) {
	h.forwardWithBody(c, http.MethodPost, "/rules/deny", "Failed to add deny rule", "rule")
}

func (h *FirewallHandler) allowIP(c *gin.Context) {
	h.forwardWithBody(c, http.MethodPost, "/rules/allow/ip", "Failed to add allow IP rule", "ip_address")
}

func (h *FirewallHandler) denyIP(c *gin.Context) {
	h.forwardWithBody(c, http.MethodPost, "/rules/deny/ip", "Failed to add deny IP rule", "ip_address")
}

func (h *FirewallHandler) deleteRule(c *gin.Context) {
	ruleNumber := c.Param("ruleNumber")
	if strings.TrimSpace(ruleNumber) == "" {
		writeError(c, http.StatusBadRequest, "Missing rule number.", nil)
		return
	}
	h.forwardWithoutBody(c, http.MethodDelete, fmt.Sprintf("/rules/delete/%s", ruleNumber), "Failed to delete rule")
}

func (h *FirewallHandler) forwardWithoutBody(c *gin.Context, method, path, errMsg string) {
	backend, ok := h.lookupBackend(c)
	if !ok {
		return
	}

	resp, err := h.relay.Forward(c.Request.Context(), backend, method, path, nil)
	if err != nil {
		writeError(c, http.StatusInternalServerError, errMsg, err.Error())
		return
	}
	defer resp.Body.Close()

	handleProxyResponse(c, resp, errMsg)
}

func (h *FirewallHandler) forwardWithBody(c *gin.Context, method, path, errMsg string, requiredFields ...string) {
	backend, ok := h.lookupBackend(c)
	if !ok {
		return
	}

	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		writeError(c, http.StatusBadRequest, "Invalid JSON body.", nil)
		return
	}

	for _, field := range requiredFields {
		if strings.TrimSpace(fmt.Sprintf("%v", payload[field])) == "" {
			writeError(c, http.StatusBadRequest, fmt.Sprintf("Missing required field: %s.", field), nil)
			return
		}
	}

	resp, err := h.relay.Forward(c.Request.Context(), backend, method, path, payload)
	if err != nil {
		writeError(c, http.StatusInternalServerError, errMsg, err.Error())
		return
	}
	defer resp.Body.Close()

	handleProxyResponse(c, resp, errMsg)
}

func (h *FirewallHandler) lookupBackend(c *gin.Context) (*models.Backend, bool) {
	backendID := c.Query("backendId")
	if backendID == "" {
		writeError(c, http.StatusBadRequest, "Missing backendId query parameter.", nil)
		return nil, false
	}

	backend, err := h.repo.Get(c.Request.Context(), backendID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to retrieve backend configuration.", err.Error())
		return nil, false
	}

	if backend == nil || backend.URL == "" || backend.APIKey == "" {
		writeError(c, http.StatusUnauthorized, "Backend not configured or API key/URL is missing.", nil)
		return nil, false
	}

	return backend, true
}

func handleProxyResponse(c *gin.Context, resp *http.Response, errMsg string) {
	body, empty, err := decodeJSON(resp.Body)
	if err != nil {
		writeError(c, http.StatusInternalServerError, errMsg, err.Error())
		return
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeError(c, resp.StatusCode, errMsg, body)
		return
	}

	if empty || body == nil {
		c.Status(resp.StatusCode)
		return
	}

	c.JSON(resp.StatusCode, body)
}

func decodeJSON(r io.Reader) (any, bool, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, true, err
	}
	if len(data) == 0 {
		return nil, true, nil
	}
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, true, err
	}
	return payload, false, nil
}
