package middleware

import (
	"github.com/labstack/echo/v4"
	"ims-intro/pkg/domain"
	"net/http"
)

func RoleMiddleware(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := c.Get("user")
			if user == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
			}

			claims, ok := user.(*domain.Claims)
			if !ok {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid user claims"})
			}

			for _, role := range allowedRoles {
				if claims.Role == role {
					return next(c)
				}
			}

			return c.JSON(http.StatusForbidden, map[string]string{"message": "access denied: insufficient permissions"})
		}
	}
}
