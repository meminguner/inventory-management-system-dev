package postgresql

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
)

func GetConnectionPool(context context.Context, config Config) *pgxpool.Pool {
	connString := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		config.UserName,
		config.Password,
		config.Host,
		config.Port,
		config.DbName,
	)

	connConfig, parseConfigErr := pgxpool.ParseConfig(connString)
	if parseConfigErr != nil {
		panic(parseConfigErr)
	}

	connConfig.MaxConns = 10

	conn, err := pgxpool.ConnectConfig(context, connConfig)
	if err != nil {
		log.Errorf("Unable to connect to database: %v", err)
		panic(err)
	}

	return conn
}
