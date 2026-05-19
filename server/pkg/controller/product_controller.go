package controller

import (
	"fmt"
	"github.com/labstack/echo/v4"
	"ims-intro/pkg/controller/request"
	"ims-intro/pkg/controller/response"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/middleware"
	"ims-intro/pkg/service"
	"net/http"
	"strconv"
	"strings"
)

type ProductController struct {
	productService service.IProductService
}

func NewProductController(productService service.IProductService) *ProductController {
	return &ProductController{productService}
}

func (controller *ProductController) RegisterProductRoutes(e *echo.Echo) {
	productsGroup := e.Group("/products")
	productsGroup.Use(middleware.AuthMiddleware)

	e.GET("/tags", controller.SearchTags, middleware.AuthMiddleware)

	productsGroup.GET("", controller.GetAllProducts)
	productsGroup.POST("", controller.AddNewProduct)
	productsGroup.PUT("/:id", controller.UpdateProductById)
	productsGroup.DELETE("/:id", controller.DeleteProductById)
}

func (controller *ProductController) GetAllProducts(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	dashboardId, err := parseDashboardId(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse(err.Error()))
	}

	tagStr := c.QueryParam("tag")
	fmt.Printf("\n--- [BACKEND LOG] Gelen Arama Etiketi (Tag): '%s' ---\n\n", tagStr)

	var products []*domain.Product
	if len(tagStr) == 0 {
		products, err = controller.productService.GetAllProducts(dashboardId, userClaims.Id, userClaims.Role)
	} else {
		var tags []string
		for _, t := range strings.Split(tagStr, ",") {
			trimmed := strings.TrimSpace(t)
			if trimmed != "" {
				tags = append(tags, trimmed)
			}
		}

		if len(tags) == 0 {
			products, err = controller.productService.GetAllProducts(dashboardId, userClaims.Id, userClaims.Role)
		} else {
			products, err = controller.productService.GetAllProductsByTags(dashboardId, tags, userClaims.Id, userClaims.Role)
		}
	}
	if err != nil {
		return c.JSON(http.StatusForbidden, response.NewErrorResponse(err.Error()))
	}

	return c.JSON(http.StatusOK, response.ToProductResponseList(products))
}

func (controller *ProductController) SearchTags(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	dashboardId, err := parseDashboardId(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse(err.Error()))
	}

	q := c.QueryParam("q")
	fmt.Printf("\n--- [BACKEND LOG] Öneri İçin Girilen Karakterler: '%s' ---\n\n", q)

	if len(q) < 3 {
		return c.JSON(http.StatusOK, []string{})
	}

	tags, err := controller.productService.SearchTags(q, dashboardId, userClaims.Id, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusForbidden, response.NewErrorResponse(err.Error()))
	}
	if tags == nil {
		tags = []string{}
	}
	return c.JSON(http.StatusOK, tags)
}

func (controller *ProductController) AddNewProduct(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	addProductResponse := new(request.AddProductRequest)

	err := c.Bind(addProductResponse)
	if err != nil || addProductResponse == nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: unable to bind the provided data to the product structure"))
	}

	err = controller.productService.Add(addProductResponse.ToModel(), userClaims.Id, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusCreated)
}

func (controller *ProductController) UpdateProductById(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	param := c.Param("id")
	if param == "" {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: no product id specified"))
	}

	productId, err := strconv.Atoi(param)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: product id must be an integer"))
	}

	addProductResponse := new(request.AddProductRequest)
	err = c.Bind(addProductResponse)
	if err != nil || addProductResponse == nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: unable to bind the provided data to the product structure"))
	}

	err = controller.productService.UpdateProductById(addProductResponse.ToModel(), int64(productId), userClaims.Id, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusOK)
}

func (controller *ProductController) DeleteProductById(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	param := c.Param("id")
	if param == "" {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: no product id specified"))
	}

	productId, err := strconv.Atoi(param)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: product id must be an integer"))
	}

	err = controller.productService.DeleteById(int64(productId), userClaims.Id, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusOK)
}

func parseDashboardId(c echo.Context) (int64, error) {
	dashboardIdStr := c.QueryParam("dashboardId")
	if dashboardIdStr == "" {
		return 0, fmt.Errorf("dashboardId is required")
	}

	dashboardId, err := strconv.ParseInt(dashboardIdStr, 10, 64)
	if err != nil || dashboardId <= 0 {
		return 0, fmt.Errorf("dashboardId must be a positive integer")
	}

	return dashboardId, nil
}
