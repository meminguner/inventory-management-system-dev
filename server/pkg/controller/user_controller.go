package controller

import (
	"github.com/labstack/echo/v4"
	"ims-intro/pkg/controller/request"
	"ims-intro/pkg/controller/response"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/middleware"
	"ims-intro/pkg/service"
	"net/http"
	"strconv"
	"time"
)

type UserController struct {
	userService service.IUserService
}

func NewUserController(userService service.IUserService) *UserController {
	return &UserController{userService}
}

func (controller *UserController) RegisterUserRoutes(e *echo.Echo) {
	e.POST("/login", controller.Login)
	e.POST("/signup", controller.SignUp)
	e.POST("/logout", controller.Logout)

	profileGroup := e.Group("/profile")
	profileGroup.Use(middleware.AuthMiddleware)
	profileGroup.GET("", controller.GetProfile)
	profileGroup.PUT("", controller.UpdateProfile)

	usersGroup := e.Group("/users")
	usersGroup.Use(middleware.AuthMiddleware)
	usersGroup.Use(middleware.RoleMiddleware("admin", "super_user"))

	usersGroup.GET("", controller.GetAllUsers)
	usersGroup.PUT("/:id", controller.UpdateUser)
	usersGroup.DELETE("/:id", controller.DeleteUser)
}

func (controller *UserController) Login(c echo.Context) error {
	var loginRequest request.LoginRequest
	err := c.Bind(&loginRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: unable to bind the provided data to the user structure"))
	}

	token, err := controller.userService.Login(loginRequest.Username, loginRequest.Password)
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	setAuthCookie(c, token)

	return c.NoContent(http.StatusOK)
}

func (controller *UserController) SignUp(c echo.Context) error {
	var signUpRequest request.SignUpRequest
	err := c.Bind(&signUpRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request: unable to bind the provided data to the user structure"))
	}

	err = controller.userService.SignUp(signUpRequest.ToDtoModel())
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusCreated)
}

func (controller *UserController) Logout(c echo.Context) error {
	cookie := new(http.Cookie)
	cookie.Name = "token"
	cookie.Value = ""
	cookie.Path = "/"
	cookie.MaxAge = -1
	c.SetCookie(cookie)

	return c.NoContent(http.StatusOK)
}

func (controller *UserController) GetProfile(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)

	user, err := controller.userService.GetProfile(userClaims.Id)
	if err != nil {
		return c.JSON(http.StatusNotFound, response.NewErrorResponse(err.Error()))
	}

	return c.JSON(http.StatusOK, response.ToUserResponse(user))
}

func (controller *UserController) UpdateProfile(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)

	req := new(request.UpdateProfileRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request body"))
	}

	user, token, err := controller.userService.UpdateProfile(userClaims.Id, req.Username, req.CurrentPassword, req.NewPassword)
	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, response.NewErrorResponse(err.Error()))
	}

	setAuthCookie(c, token)
	return c.JSON(http.StatusOK, response.ToUserResponse(user))
}

func (controller *UserController) GetAllUsers(c echo.Context) error {
	userClaims := c.Get("user").(*domain.Claims)

	users, err := controller.userService.GetAllUsers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, response.NewErrorResponse(err.Error()))
	}

	var filteredUsers []domain.User
	for _, u := range users {
		if userClaims.Role == "admin" || u.Role == "user" {
			filteredUsers = append(filteredUsers, u)
		}
	}

	if filteredUsers == nil {
		filteredUsers = []domain.User{}
	}

	return c.JSON(http.StatusOK, response.ToUserResponseList(filteredUsers))
}

type updateUserRequest struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

func (controller *UserController) UpdateUser(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid user ID"))
	}

	req := new(updateUserRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid request body"))
	}

	userClaims := c.Get("user").(*domain.Claims)

	err = controller.userService.UpdateUser(id, req.Username, req.Role, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusForbidden, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusOK)
}

func setAuthCookie(c echo.Context, token string) {
	cookie := new(http.Cookie)
	cookie.Name = "token"
	cookie.Value = token
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(24 * time.Hour)
	c.SetCookie(cookie)
}

func (controller *UserController) DeleteUser(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.NewErrorResponse("Invalid user ID"))
	}

	userClaims := c.Get("user").(*domain.Claims)

	err = controller.userService.DeleteUser(id, userClaims.Role)
	if err != nil {
		return c.JSON(http.StatusForbidden, response.NewErrorResponse(err.Error()))
	}

	return c.NoContent(http.StatusOK)
}
