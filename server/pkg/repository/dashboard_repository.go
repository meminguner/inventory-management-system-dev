package repository

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
	"ims-intro/pkg/domain"
)

type IDashboardRepository interface {
	GetAllDashboards(userId int64, userRole string) []*domain.Dashboard
	CreateDashboard(dashboard *domain.Dashboard, userId int64) (*domain.Dashboard, error)
	GetPermissionsByUserId(userId int64) ([]int64, error)
	UpdatePermissionsForUser(userId int64, dashboardIds []int64) error
}

type DashboardRepository struct {
	dbPool *pgxpool.Pool
}

func NewDashboardRepository(dbPool *pgxpool.Pool) IDashboardRepository {
	return &DashboardRepository{dbPool}
}

func (repository *DashboardRepository) GetAllDashboards(userId int64, userRole string) []*domain.Dashboard {
	ctx := context.Background()
	var query string
	var args []interface{}

	if userRole == "admin" || userRole == "super_user" {
		query = "SELECT id, name FROM dashboards ORDER BY id ASC"
	} else {
		query = "SELECT d.id, d.name FROM dashboards d INNER JOIN dashboard_permissions dp ON d.id = dp.dashboard_id WHERE dp.user_id = $1 ORDER BY d.id ASC"
		args = append(args, userId)
	}

	rows, err := repository.dbPool.Query(ctx, query, args...)
	if err != nil {
		log.Errorf("error while getting all dashboards: %v", err)
		return nil
	}
	defer rows.Close()

	var dashboards []*domain.Dashboard
	for rows.Next() {
		dashboard := &domain.Dashboard{}
		err := rows.Scan(&dashboard.Id, &dashboard.Name)
		if err != nil {
			log.Errorf("error scanning dashboard: %v", err)
			continue
		}
		dashboards = append(dashboards, dashboard)
	}

	return dashboards
}

func (repository *DashboardRepository) CreateDashboard(dashboard *domain.Dashboard, userId int64) (*domain.Dashboard, error) {
	ctx := context.Background()

	tx, err := repository.dbPool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	insertStatement := "INSERT INTO dashboards (name) VALUES ($1) RETURNING id, name"

	err = tx.QueryRow(ctx, insertStatement, dashboard.Name).Scan(&dashboard.Id, &dashboard.Name)
	if err != nil {
		log.Errorf("error while adding a new dashboard: %v", err)
		return nil, err
	}

	insertPermission := "INSERT INTO dashboard_permissions (user_id, dashboard_id) VALUES ($1, $2)"
	_, err = tx.Exec(ctx, insertPermission, userId, dashboard.Id)
	if err != nil {
		log.Errorf("error granting permission to creator: %v", err)
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	log.Info(fmt.Sprintf("Dashboard added successfully: %v", dashboard))
	return dashboard, nil
}

func (repository *DashboardRepository) GetPermissionsByUserId(userId int64) ([]int64, error) {
	ctx := context.Background()
	rows, err := repository.dbPool.Query(ctx, "SELECT dashboard_id FROM dashboard_permissions WHERE user_id = $1", userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dashboardIds []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			continue
		}
		dashboardIds = append(dashboardIds, id)
	}
	return dashboardIds, nil
}

func (repository *DashboardRepository) UpdatePermissionsForUser(userId int64, dashboardIds []int64) error {
	ctx := context.Background()
	tx, err := repository.dbPool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, "DELETE FROM dashboard_permissions WHERE user_id = $1", userId)
	if err != nil {
		return err
	}

	for _, dId := range dashboardIds {
		_, err = tx.Exec(ctx, "INSERT INTO dashboard_permissions (user_id, dashboard_id) VALUES ($1, $2)", userId, dId)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
