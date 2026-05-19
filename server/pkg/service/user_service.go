package service

import (
	"errors"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/repository"
	"ims-intro/pkg/service/dto"
	"os"
	"strings"
	"time"
)

type IUserService interface {
	Login(username, password string) (string, error)
	SignUp(user dto.UserCreate) error
	GetProfile(id int64) (domain.User, error)
	UpdateProfile(id int64, username string, currentPassword string, newPassword string) (domain.User, string, error)
	GetAllUsers() ([]domain.User, error)
	UpdateUser(id int64, username string, role string, requesterRole string) error
	DeleteUser(id int64, requesterRole string) error
}

type UserService struct {
	userRepository repository.IUserRepository
}

func NewUserService(userRepository repository.IUserRepository) IUserService {
	return &UserService{userRepository}
}

func (service *UserService) Login(username, password string) (string, error) {
	user, err := service.userRepository.GetUserByUsername(username)
	if err != nil {
		return "", errors.New("no user found with the username: " + username)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", errors.New("invalid password")
	}

	tokenString, err := createToken(user)
	if err != nil {
		return "", errors.New("error signing the token: " + err.Error())
	}

	return tokenString, nil
}

func (service *UserService) SignUp(userCreate dto.UserCreate) error {
	err := validateUserCreate(userCreate)
	if err != nil {
		return err
	}

	user := userCreateToUser(userCreate)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("error while creating password hash")
	}

	user.Password = string(hashedPassword)

	return service.userRepository.SignUp(user)
}

func (service *UserService) GetProfile(id int64) (domain.User, error) {
	user, err := service.userRepository.GetUserById(id)
	if err != nil {
		return domain.User{}, errors.New("user not found")
	}
	return user, nil
}

func (service *UserService) UpdateProfile(id int64, username string, currentPassword string, newPassword string) (domain.User, string, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return domain.User{}, "", errors.New("username can't be empty")
	}
	if currentPassword == "" {
		return domain.User{}, "", errors.New("current password is required")
	}

	user, err := service.userRepository.GetUserById(id)
	if err != nil {
		return domain.User{}, "", errors.New("user not found")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(currentPassword))
	if err != nil {
		return domain.User{}, "", errors.New("current password is invalid")
	}

	if username != user.Username {
		existingUser, err := service.userRepository.GetUserByUsername(username)
		if err == nil && existingUser.Id != user.Id {
			return domain.User{}, "", errors.New("username is already in use")
		}
	}

	user.Username = username
	if strings.TrimSpace(newPassword) != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return domain.User{}, "", errors.New("error while creating password hash")
		}
		user.Password = string(hashedPassword)
	}

	if err := service.userRepository.UpdateProfile(user); err != nil {
		return domain.User{}, "", err
	}

	token, err := createToken(user)
	if err != nil {
		return domain.User{}, "", errors.New("error signing the token: " + err.Error())
	}

	return user, token, nil
}

func (service *UserService) GetAllUsers() ([]domain.User, error) {
	users, err := service.userRepository.GetAllUsers()
	if users == nil {
		return []domain.User{}, err
	}
	return users, err
}

func (service *UserService) UpdateUser(id int64, username string, role string, requesterRole string) error {
	if requesterRole != "admin" {
		return errors.New("unauthorized: only admin can update users")
	}

	user, err := service.userRepository.GetUserById(id)
	if err != nil {
		return errors.New("user not found")
	}

	if user.Role == "admin" {
		return errors.New("unauthorized: cannot modify another admin")
	}

	user.Username = username
	user.Role = role

	return service.userRepository.UpdateUser(user)
}

func (service *UserService) DeleteUser(id int64, requesterRole string) error {
	if requesterRole != "admin" {
		return errors.New("unauthorized: only admin can delete users")
	}

	user, err := service.userRepository.GetUserById(id)
	if err != nil {
		return errors.New("user not found")
	}

	if user.Role == "admin" {
		return errors.New("unauthorized: cannot delete another admin")
	}

	return service.userRepository.DeleteUser(id)
}

func validateUserCreate(u dto.UserCreate) error {
	if u.Username == "" {
		return errors.New("username can't be empty")
	}
	if u.Password == "" {
		return errors.New("password can't be empty")
	}
	return nil
}

func userCreateToUser(userCreate dto.UserCreate) domain.User {
	return domain.User{
		Username: userCreate.Username,
		Password: userCreate.Password,
		Role:     "user",
	}
}

func createToken(user domain.User) (string, error) {
	jwtKey := os.Getenv("JWT_KEY")

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &domain.Claims{
		Id:       user.Id,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtKey))
}
