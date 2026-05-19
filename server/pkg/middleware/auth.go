package middleware

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"ims-intro/pkg/domain"
	"net/http"
	"os"
	"strings"
)

func AuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		tokenString := ""
		authHeader := c.Request().Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		}

		if tokenString == "" {
			cookie, err := c.Cookie("token")
			if err == nil {
				tokenString = cookie.Value
			}
		}

		if tokenString == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": "missing or invalid token"})
		}

		jwtKey := os.Getenv("JWT_KEY")

		claims := &domain.Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			return []byte(jwtKey), nil
		})

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid token"})
		}

		c.Set("user", claims)
		return next(c)
	}
}
