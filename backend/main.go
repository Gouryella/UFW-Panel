package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const (
	certFileName = "server.crt"
	keyFileName  = "server.key"
)

var expectedAPIKey string

type failInfo struct {
	Count int
	First time.Time
}

var (
	failedAttempts sync.Map
	blockedIPs     sync.Map
	failWindow     = time.Minute
)

var maxFails int

func init() {
	maxFailsStr := os.Getenv("MAX_FAILS")
	if maxFailsStr == "" {
		log.Println("Warning: MAX_FAILS environment variable not set. Defaulting to 5.")
		maxFails = 5
	} else {
		var err error
		maxFails, err = strconv.Atoi(maxFailsStr)
		if err != nil {
			log.Fatalf("FATAL: Invalid MAX_FAILS value: %s. Must be an integer.", maxFailsStr)
		}
	}
}

func ensureSelfSignedCert(certPath, keyPath string) error {
	if _, err := os.Stat(certPath); err == nil {
		if _, err = os.Stat(keyPath); err == nil {
			log.Printf("Detected existing self-signed certificate, skipping generation (%s, %s)", certPath, keyPath)
			return nil
		}
	}

	log.Println("No self-signed certificate found, starting generation…")

	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("failed to generate private key: %w", err)
	}

	max := new(big.Int)
	max.Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, max)
	if err != nil {
		return fmt.Errorf("failed to generate serial number: %w", err)
	}
	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"UFW-Panel"},
			CommonName:   "localhost",
		},
		NotBefore: time.Now().Add(-time.Hour),
		NotAfter:  time.Now().AddDate(10, 0, 0),

		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return fmt.Errorf("failed to generate certificate: %w", err)
	}

	certOut, err := os.Create(certPath)
	if err != nil {
		return fmt.Errorf("failed to create certificate file: %w", err)
	}
	defer certOut.Close()
	if err = pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes}); err != nil {
		return fmt.Errorf("failed to write certificate: %w", err)
	}

	keyOut, err := os.Create(keyPath)
	if err != nil {
		return fmt.Errorf("failed to create private key file: %w", err)
	}
	defer keyOut.Close()
	if err = pem.Encode(keyOut, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)}); err != nil {
		return fmt.Errorf("failed to write private key: %w", err)
	}

	log.Printf("Self-signed certificate created (%s, %s)", certPath, keyPath)
	return nil
}

func AuthMiddleware() gin.HandlerFunc {
	expectedAPIKey = os.Getenv("UFW_API_KEY")
	if expectedAPIKey == "" {
		log.Fatal("FATAL: UFW_API_KEY not set")
	}

	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		ip := c.ClientIP()

		if _, blocked := blockedIPs.Load(ip); blocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "IP blocked"})
			c.Abort()
			return
		}

		apiKey := c.GetHeader("X-API-KEY")
		if apiKey == "" || apiKey != expectedAPIKey {
			now := time.Now()
			val, _ := failedAttempts.LoadOrStore(ip, &failInfo{Count: 0, First: now})
			fi := val.(*failInfo)

			if now.Sub(fi.First) > failWindow {
				fi.Count = 1
				fi.First = now
			} else {
				fi.Count++
			}

			if fi.Count >= maxFails {
				blockedIPs.Store(ip, struct{}{})
				go func() {
					if err := DenyUFWFromIP(ip, "", fmt.Sprintf("AUTO BLOCK: %d fails/m", maxFails)); err != nil {
						log.Printf("WARN: failed to add UFW deny rule for %s: %v", ip, err)
					}
				}()
				c.JSON(http.StatusForbidden, gin.H{"error": "Too many failed attempts, IP blocked"})
			} else {
				c.JSON(http.StatusForbidden, gin.H{"error": "Invalid or missing API key"})
			}
			c.Abort()
			return
		}

		failedAttempts.Delete(ip)
		c.Next()
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: Could not load .env file:", err)
	}

	router := gin.Default()

	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	rawItems := []string{}
	if allowedOriginsEnv != "" {
		for _, v := range strings.Split(allowedOriginsEnv, ",") {
			if vv := strings.TrimSpace(v); vv != "" {
				rawItems = append(rawItems, vv)
			}
		}
	}
	if len(rawItems) == 0 {
		rawItems = []string{"http://localhost:3000"}
		log.Println("Warning: CORS_ALLOWED_ORIGINS not set. Defaulting to http://localhost:3000")
	}
	log.Printf("CORS raw allow list: %v", rawItems)

	type originRule struct {
		exact string
		glob  string
	}
	var rules []originRule
	for _, it := range rawItems {
		if strings.HasPrefix(it, "*.") {
			rules = append(rules, originRule{glob: strings.TrimPrefix(it, "*.")})
		} else {
			rules = append(rules, originRule{exact: it})
		}
	}

	allowOriginFunc := func(origin string) bool {
		for _, r := range rules {
			if r.exact != "" && origin == r.exact {
				return true
			}
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := u.Hostname()
		for _, r := range rules {
			if r.glob != "" && (host == r.glob || strings.HasSuffix(host, "."+r.glob)) {
				return true
			}
		}
		return false
	}

	router.Use(cors.New(cors.Config{
		AllowOriginFunc:  allowOriginFunc,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "X-API-KEY", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	authorized := router.Group("/")
	authorized.Use(AuthMiddleware())
	{
		authorized.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong"})
		})

		authorized.GET("/status", func(c *gin.Context) {
			status, err := GetUFWStatus()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get UFW status", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, status)
		})

		type AllowRuleRequest struct {
			Rule    string `json:"rule" binding:"required"`
			Comment string `json:"comment"`
		}
		authorized.POST("/rules/allow", func(c *gin.Context) {
			var req AllowRuleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
				return
			}
			if err := AllowUFWPort(req.Rule, req.Comment); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add allow rule", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Rule added successfully", "rule": req.Rule, "comment": req.Comment})
		})

		type DenyRuleRequest struct {
			Rule    string `json:"rule" binding:"required"`
			Comment string `json:"comment"`
		}
		authorized.POST("/rules/deny", func(c *gin.Context) {
			var req DenyRuleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
				return
			}
			if err := DenyUFWPort(req.Rule, req.Comment); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add deny rule", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Deny rule added successfully", "rule": req.Rule, "comment": req.Comment})
		})

		authorized.DELETE("/rules/delete/:number", func(c *gin.Context) {
			ruleNumber := c.Param("number")
			if ruleNumber == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Rule number parameter is required"})
				return
			}
			if err := DeleteUFWByNumber(ruleNumber); err != nil {
				if strings.Contains(err.Error(), "not found") {
					c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found", "details": err.Error()})
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule", "details": err.Error()})
				}
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Rule deleted successfully", "rule_number": ruleNumber})
		})

		authorized.POST("/enable", func(c *gin.Context) {
			log.Println("Attempting to enable UFW via API endpoint...")
			if err := EnableUFW(); err != nil {
				log.Printf("Error enabling UFW via API: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable UFW", "details": err.Error()})
				return
			}
			log.Println("UFW enabled successfully via API.")
			c.JSON(http.StatusOK, gin.H{"message": "UFW enabled successfully"})
		})

		authorized.POST("/disable", func(c *gin.Context) {
			if err := DisableUFW(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable UFW", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "UFW disabled successfully (or was already inactive)"})
		})

		type IPRuleRequest struct {
			IPAddress    string `json:"ip_address" binding:"required"`
			PortProtocol string `json:"port_protocol"`
			Comment      string `json:"comment"`
		}
		authorized.POST("/rules/allow/ip", func(c *gin.Context) {
			var req IPRuleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
				return
			}
			if err := AllowUFWFromIP(req.IPAddress, req.PortProtocol, req.Comment); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add allow rule from IP", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Allow rule from IP added successfully", "ip_address": req.IPAddress, "port_protocol": req.PortProtocol, "comment": req.Comment})
		})
		authorized.POST("/rules/deny/ip", func(c *gin.Context) {
			var req IPRuleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
				return
			}
			if err := DenyUFWFromIP(req.IPAddress, req.PortProtocol, req.Comment); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add deny rule from IP", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Deny rule from IP added successfully", "ip_address": req.IPAddress, "port_protocol": req.PortProtocol, "comment": req.Comment})
		})

		type RouteAllowRuleRequest struct {
			Protocol string `json:"protocol"`
			FromIP   string `json:"from_ip"`
			ToIP     string `json:"to_ip"`
			Port     string `json:"port"`
			Comment  string `json:"comment"`
		}
		authorized.POST("/rules/route/allow", func(c *gin.Context) {
			var req RouteAllowRuleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
				return
			}
			if req.Protocol == "" && req.Port == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: Protocol or Port must be specified for a route rule."})
				return
			}
			if err := RouteAllowUFW(req.Protocol, req.FromIP, req.ToIP, req.Port, req.Comment); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add route allow rule", "details": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"message":  "Route allow rule added successfully",
				"protocol": req.Protocol,
				"from_ip":  req.FromIP,
				"to_ip":    req.ToIP,
				"port":     req.Port,
				"comment":  req.Comment,
			})
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "30737"
	}
	apiRule := port + "/tcp"

	log.Printf("Attempting to add allow rule for API port %s during startup...", apiRule)
	if startupErr := AllowUFWPort(apiRule, ""); startupErr != nil {
		if strings.Contains(startupErr.Error(), "Skipping adding existing rule") {
			log.Printf("Rule for API port '%s' already exists or skipping message detected.", apiRule)
		} else {
			log.Printf("WARNING: Error adding allow rule for API port '%s' during startup: %v. Ensure the server is run with sudo if needed.", apiRule, startupErr)
		}
	} else {
		log.Printf("Successfully added or ensured allow rule for API port: %s", apiRule)
	}

	log.Printf("Starting server on port %s", port)

	// Check for custom TLS certificate paths
	certPath := os.Getenv("TLS_CERT_PATH")
	keyPath := os.Getenv("TLS_KEY_PATH")
	
	if certPath != "" && keyPath != "" {
		// Validate custom certificate files exist
		if _, err := os.Stat(certPath); os.IsNotExist(err) {
			log.Fatalf("FATAL: Custom certificate file not found: %s", certPath)
		}
		if _, err := os.Stat(keyPath); os.IsNotExist(err) {
			log.Fatalf("FATAL: Custom private key file not found: %s", keyPath)
		}
		log.Printf("Using custom TLS certificate: %s and key: %s", certPath, keyPath)
	} else {
		// Use self-signed certificate
		certPath = certFileName
		keyPath = keyFileName
		if err := ensureSelfSignedCert(certPath, keyPath); err != nil {
			log.Fatalf("FATAL: Failed to ensure self-signed certificate: %v", err)
		}
	}

	log.Printf("Attempting to start HTTPS server on port %s using %s and %s", port, certPath, keyPath)
	if err := router.RunTLS(":"+port, certPath, keyPath); err != nil {
		log.Fatalf("FATAL: Failed to start HTTPS server: %v", err)
	}
}
