package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"ufwpanel/frontend/internal/config"
	"ufwpanel/frontend/internal/services/auth"
)

func RequireAuth(authSvc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(config.CookieName)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"authenticated": false,
				"error":         "Unauthorized.",
			})
			return
		}

		if err := authSvc.VerifyToken(token); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"authenticated": false,
				"error":         "Session expired or invalid.",
			})
			return
		}

		c.Next()
	}
}
