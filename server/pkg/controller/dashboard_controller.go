package controller

import (
	"github.com/labstack/echo/v4"
	"ims-intro/pkg/controller/response"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/middleware"
	"ims-intro/pkg/service"
	"net/http"
	"strconv"
)

type DashboardController struct {
	dashboardService service.IDashboardService
}

func NewDashboardController(dashboardService service.IDashboardService) *DashboardController {
	return &DashboardController{dashboardService}
}

func (controller *DashboardController) RegisterDashboardRoutes(e *echo.Echo) {
	dashboardsGroup := e.Group("/dashboards")
	dashboardsGroup.Use(middleware.AuthMiddleware)

	dashboardsGroup.GET("", controller.GetAllDashboards)
	// Create Dashboard requires super_user or admin
	dashboardsGroup.POST("", controller.CreateDashboard, middleware.RoleMiddleware("super_user", "admin"))

	// Dashboard permission routes for users
	userDashboardsGroup := e.Group("/users/:id/dashboards")
	userDashboardsGroup.Use(middleware.AuthMiddleware)
	userDashboardsGroup.Use(middleware.RoleMiddleware("admin", "super_user"))
	
	userDashboardsGroup.GET("", controller.GetUserDashboards)
	userDashboardsGroup.PUT("", controller.UpdateUserDashboards)
}

func (controller *DashboardController) GetAllDashboards(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)
	
	dashboards := controller.dashboardService.GetAllDashboards(userClaims.Id, userClaims.Role)
	return c.JSON(http.StatusOK, dashboards)
}

type createDashboardRequest struct {
	Name string `json:"name"`
}

func (controller *DashboardController) CreateDashboard(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)

	req := new(createDashboardRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request body"))
	}

	dashboard, err := controller.dashboardService.CreateDashboard(req.Name, userClaims.Id)
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	return c.JSON(http.StatusCreated, dashboard)
}

func (controller *DashboardController) GetUserDashboards(c echo.Context) error {
	idParam := c.Param("id")
	userId, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid user ID"))
	}

	dashboardIds, err := controller.dashboardService.GetPermissionsByUserId(userId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, response.NewErrorResponse(err.Error()))
	}

	if dashboardIds == nil {
		dashboardIds = []int64{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"dashboard_ids": dashboardIds})
}

type updatePermissionsRequest struct {
	DashboardIds []int64 `json:"dashboard_ids"`
}

func (controller *DashboardController) UpdateUserDashboards(c echo.Context) error {
	idParam := c.Param("id")
	userId, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid user ID"))
	}

	req := new(updatePermissionsRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request body"))
	}

	err = controller.dashboardService.UpdatePermissionsForUser(userId, req.DashboardIds)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusOK)
}
