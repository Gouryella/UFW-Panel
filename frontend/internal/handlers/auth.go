package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"ufwpanel/frontend/internal/config"
	"ufwpanel/frontend/internal/services/auth"
)

type AuthHandler struct {
	auth *auth.Service
}

func NewAuthHandler(authSvc *auth.Service) *AuthHandler {
	return &AuthHandler{auth: authSvc}
}

func (h *AuthHandler) Register(rg *gin.RouterGroup) {
	rg.GET("/auth", h.getAuth)
	rg.POST("/auth", h.postAuth)
	rg.POST("/auth/logout", h.logout)
}

func (h *AuthHandler) getAuth(c *gin.Context) {
	token, err := c.Cookie(config.CookieName)
	if err != nil || token == "" {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	if err := h.auth.VerifyToken(token); err != nil {
		expireCookie(c)
		status := http.StatusUnauthorized
		c.JSON(status, gin.H{
			"authenticated": false,
			"error":         "Session expired or invalid.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"authenticated": true})
}

func (h *AuthHandler) postAuth(c *gin.Context) {
	type request struct {
		Password string `json:"password"`
	}
	var body request
	if err := c.ShouldBindJSON(&body); err != nil {
		writeError(c, http.StatusBadRequest, "Password not provided.", nil)
		return
	}

	if h.auth == nil {
		writeError(c, http.StatusInternalServerError, "Server configuration error.", nil)
		return
	}

	if !h.auth.Authenticate(body.Password) {
		writeError(c, http.StatusUnauthorized, "Incorrect password.", nil)
		return
	}

	token, expiresAt, err := h.auth.IssueToken()
	if err != nil {
		writeError(c, http.StatusInternalServerError, "Failed to issue auth token.", err.Error())
		return
	}

	secure := gin.Mode() == gin.ReleaseMode

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     config.CookieName,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})

	c.JSON(http.StatusOK, gin.H{"authenticated": true})
}

func (h *AuthHandler) logout(c *gin.Context) {
	expireCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

func expireCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     config.CookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   gin.Mode() == gin.ReleaseMode,
		SameSite: http.SameSiteStrictMode,
	})
}
