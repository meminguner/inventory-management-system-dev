package controller

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"time"

	"ims-intro/pkg/controller/response"
	"ims-intro/pkg/middleware"

	"github.com/labstack/echo/v4"
)

type AIController struct {
	httpClient *http.Client
}

func NewAIController() *AIController {
	return &AIController{httpClient: &http.Client{Timeout: 75 * time.Second}}
}

func (controller *AIController) RegisterAIRoutes(e *echo.Echo) {
	aiGroup := e.Group("/ai")
	aiGroup.Use(middleware.AuthMiddleware)

	aiGroup.POST("/chat", controller.Chat)
}

// Chat, frontend'in kurduğu provider-formatlı istek gövdesini API anahtarını
// sunucu tarafında ekleyerek AI sağlayıcısına iletir. Anahtar asla
// frontend bundle'ına girmez.
func (controller *AIController) Chat(c echo.Context) error {
	apiKey := os.Getenv("AI_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusServiceUnavailable, response.NewErrorResponse("AI servisi yapılandırılmamış"))
	}

	// base64 görsel içeren istekler büyük olabilir — 20MB üst sınır
	body, err := io.ReadAll(io.LimitReader(c.Request().Body, 20<<20))
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Geçersiz istek gövdesi"))
	}

	url := "https://api.openai.com/v1/chat/completions"
	headers := map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + apiKey,
	}
	if os.Getenv("AI_API_PROVIDER") == "anthropic" {
		url = "https://api.anthropic.com/v1/messages"
		headers = map[string]string{
			"Content-Type":      "application/json",
			"x-api-key":         apiKey,
			"anthropic-version": "2023-06-01",
		}
	}

	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, response.NewErrorResponse("AI isteği oluşturulamadı"))
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	res, err := controller.httpClient.Do(req)
	if err != nil {
		return c.JSON(http.StatusBadGateway, response.NewErrorResponse("AI servisine ulaşılamadı"))
	}
	defer res.Body.Close()

	return c.Stream(res.StatusCode, "application/json", res.Body)
}
