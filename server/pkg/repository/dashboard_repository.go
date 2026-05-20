package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
	"ims-intro/pkg/domain"
)

type IDashboardRepository interface {
	GetAllDashboards(userId int64, userRole string) []*domain.Dashboard
	GetDashboardById(dashboardId int64) (*domain.Dashboard, error)
	CreateDashboard(dashboard *domain.Dashboard, columns []domain.ColumnDefinition, userId int64) (*domain.Dashboard, error)
	DeleteDashboard(dashboardId int64) error
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
		query = "SELECT id, name, column_definitions FROM dashboards ORDER BY id ASC"
	} else {
		query = "SELECT d.id, d.name, d.column_definitions FROM dashboards d INNER JOIN dashboard_permissions dp ON d.id = dp.dashboard_id WHERE dp.user_id = $1 ORDER BY d.id ASC"
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
		var colDefJSONB pgtype.JSONB
		err := rows.Scan(&dashboard.Id, &dashboard.Name, &colDefJSONB)
		if err != nil {
			log.Errorf("error scanning dashboard: %v", err)
			continue
		}
		dashboard.ColumnDefinitions = parseColumnDefs(colDefJSONB)
		dashboards = append(dashboards, dashboard)
	}

	return dashboards
}

func (repository *DashboardRepository) GetDashboardById(dashboardId int64) (*domain.Dashboard, error) {
	ctx := context.Background()
	dashboard := &domain.Dashboard{}
	var colDefJSONB pgtype.JSONB

	err := repository.dbPool.QueryRow(ctx,
		"SELECT id, name, column_definitions FROM dashboards WHERE id = $1",
		dashboardId,
	).Scan(&dashboard.Id, &dashboard.Name, &colDefJSONB)

	if err != nil {
		return nil, fmt.Errorf("dashboard with id %d not found", dashboardId)
	}

	dashboard.ColumnDefinitions = parseColumnDefs(colDefJSONB)
	return dashboard, nil
}

func (repository *DashboardRepository) CreateDashboard(dashboard *domain.Dashboard, columns []domain.ColumnDefinition, userId int64) (*domain.Dashboard, error) {
	ctx := context.Background()

	var exists bool
	err := repository.dbPool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM dashboards WHERE LOWER(name) = LOWER($1))",
		dashboard.Name,
	).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("bu isimde bir tablo zaten mevcut")
	}

	colDefJSON, err := json.Marshal(columns)
	if err != nil {
		return nil, err
	}
	colDefJSONB := pgtype.JSONB{Bytes: colDefJSON, Status: pgtype.Present}

	tx, err := repository.dbPool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var resultColDef pgtype.JSONB
	err = tx.QueryRow(ctx,
		"INSERT INTO dashboards (name, column_definitions) VALUES ($1, $2) RETURNING id, name, column_definitions",
		dashboard.Name, colDefJSONB,
	).Scan(&dashboard.Id, &dashboard.Name, &resultColDef)
	if err != nil {
		log.Errorf("error while adding a new dashboard: %v", err)
		return nil, err
	}

	_, err = tx.Exec(ctx,
		"INSERT INTO dashboard_permissions (user_id, dashboard_id) VALUES ($1, $2)",
		userId, dashboard.Id,
	)
	if err != nil {
		log.Errorf("error granting permission to creator: %v", err)
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	dashboard.ColumnDefinitions = parseColumnDefs(resultColDef)
	log.Info(fmt.Sprintf("Dashboard added successfully: %v", dashboard))
	return dashboard, nil
}

func (repository *DashboardRepository) DeleteDashboard(dashboardId int64) error {
	ctx := context.Background()
	result, err := repository.dbPool.Exec(ctx,
		"DELETE FROM dashboards WHERE id = $1",
		dashboardId,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("tablo bulunamadı")
	}
	return nil
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

func parseColumnDefs(j pgtype.JSONB) []domain.ColumnDefinition {
	if j.Status != pgtype.Present || len(j.Bytes) == 0 {
		return []domain.ColumnDefinition{}
	}
	var cols []domain.ColumnDefinition
	if err := json.Unmarshal(j.Bytes, &cols); err != nil {
		return []domain.ColumnDefinition{}
	}
	return cols
}
