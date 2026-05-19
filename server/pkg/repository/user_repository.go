package repository

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
	"ims-intro/pkg/domain"
)

type IUserRepository interface {
	GetUserByUsername(username string) (domain.User, error)
	GetUserById(id int64) (domain.User, error)
	GetAllUsers() ([]domain.User, error)
	SignUp(user domain.User) error
	UpdateUser(user domain.User) error
	UpdateProfile(user domain.User) error
	DeleteUser(id int64) error
}

type UserRepository struct {
	dbPool *pgxpool.Pool
}

func NewUserRepository(dbPool *pgxpool.Pool) IUserRepository {
	return &UserRepository{dbPool}
}

func (repository *UserRepository) GetUserByUsername(username string) (domain.User, error) {
	ctx := context.Background()

	var user domain.User

	selectStatement := "SELECT id, username, password, role FROM users WHERE username = $1"
	userRow := repository.dbPool.QueryRow(ctx, selectStatement, username)

	err := userRow.Scan(&user.Id, &user.Username, &user.Password, &user.Role)
	if err != nil && err.Error() == "no rows in result set" {
		return domain.User{}, errors.New("error while finding user")
	}

	if err != nil {
		return domain.User{}, err
	}

	return user, nil
}

func (repository *UserRepository) SignUp(user domain.User) error {
	ctx := context.Background()

	insertStatement := "INSERT INTO users(username, password, role) VALUES ($1, $2, $3)"

	addNewUser, err := repository.dbPool.Exec(ctx, insertStatement, user.Username, user.Password, user.Role)
	if err != nil {
		log.Errorf("error while adding new user: %v", err)
		return err
	}

	log.Info(fmt.Sprintf("User added successfully: %v", addNewUser))
	return nil
}

func (repository *UserRepository) GetUserById(id int64) (domain.User, error) {
	ctx := context.Background()
	var user domain.User

	selectStatement := "SELECT id, username, password, role FROM users WHERE id = $1"
	userRow := repository.dbPool.QueryRow(ctx, selectStatement, id)

	err := userRow.Scan(&user.Id, &user.Username, &user.Password, &user.Role)
	if err != nil && err.Error() == "no rows in result set" {
		return domain.User{}, errors.New("error while finding user")
	}

	if err != nil {
		return domain.User{}, err
	}

	return user, nil
}

func (repository *UserRepository) GetAllUsers() ([]domain.User, error) {
	ctx := context.Background()
	var users []domain.User

	selectStatement := "SELECT id, username, password, role FROM users"
	rows, err := repository.dbPool.Query(ctx, selectStatement)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var user domain.User
		err := rows.Scan(&user.Id, &user.Username, &user.Password, &user.Role)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

func (repository *UserRepository) UpdateUser(user domain.User) error {
	ctx := context.Background()

	updateStatement := "UPDATE users SET username = $1, role = $2 WHERE id = $3"
	_, err := repository.dbPool.Exec(ctx, updateStatement, user.Username, user.Role, user.Id)
	if err != nil {
		log.Errorf("error while updating user: %v", err)
		return err
	}

	return nil
}

func (repository *UserRepository) UpdateProfile(user domain.User) error {
	ctx := context.Background()

	updateStatement := "UPDATE users SET username = $1, password = $2 WHERE id = $3"
	_, err := repository.dbPool.Exec(ctx, updateStatement, user.Username, user.Password, user.Id)
	if err != nil {
		log.Errorf("error while updating profile: %v", err)
		return err
	}

	return nil
}

func (repository *UserRepository) DeleteUser(id int64) error {
	ctx := context.Background()

	deleteStatement := "DELETE FROM users WHERE id = $1"
	_, err := repository.dbPool.Exec(ctx, deleteStatement, id)
	if err != nil {
		log.Errorf("error while deleting user: %v", err)
		return err
	}

	return nil
}
