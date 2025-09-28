package handlers

import "github.com/gin-gonic/gin"

func writeError(c *gin.Context, status int, message string, details any) {
	payload := gin.H{"error": message}
	if details != nil {
		payload["details"] = details
	}
	c.JSON(status, payload)
}
