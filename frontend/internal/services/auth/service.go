package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"ufwpanel/frontend/internal/config"
)

type Service struct {
	secret    []byte
	expiresIn time.Duration
	password  string
}

func NewService(cfg *config.Config) *Service {
	return &Service{
		secret:    cfg.JWTSecret,
		expiresIn: cfg.JWTExpiresIn,
		password:  cfg.AuthPassword,
	}
}

func (s *Service) Authenticate(password string) bool {
	if s.password == "" {
		return password == ""
	}
	return password == s.password
}

func (s *Service) IssueToken() (string, time.Time, error) {
	claims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiresIn)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, claims.ExpiresAt.Time, nil
}

func (s *Service) VerifyToken(token string) error {
	if token == "" {
		return errors.New("empty token")
	}
	_, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	})
	return err
}
