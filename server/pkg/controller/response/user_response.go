package response

import "ims-intro/pkg/domain"

type ErrorResponse struct {
	ErrorMessage string `json:"error_message"`
}

func NewErrorResponse(errorMessage string) *ErrorResponse {
	return &ErrorResponse{errorMessage}
}

type LoginResponse struct {
	Token string `json:"token"`
}

func NewLoginResponse(token string) *LoginResponse {
	return &LoginResponse{token}
}

type UserResponse struct {
	Id       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func ToUserResponse(user domain.User) UserResponse {
	return UserResponse{
		Id:       user.Id,
		Username: user.Username,
		Role:     user.Role,
	}
}

func ToUserResponseList(users []domain.User) []UserResponse {
	responses := make([]UserResponse, 0, len(users))
	for _, user := range users {
		responses = append(responses, ToUserResponse(user))
	}
	return responses
}
