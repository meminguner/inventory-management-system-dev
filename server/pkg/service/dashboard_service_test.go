package service

import (
	"errors"
	"ims-intro/pkg/domain"
	"testing"
)

type fakeDashboardRepository struct {
	dashboards     []*domain.Dashboard
	createdName    string
	createdColumns []domain.ColumnDefinition
}

func (f *fakeDashboardRepository) GetAllDashboards(userId int64, userRole string) []*domain.Dashboard {
	return f.dashboards
}

func (f *fakeDashboardRepository) GetDashboardById(dashboardId int64) (*domain.Dashboard, error) {
	return nil, errors.New("not found")
}

func (f *fakeDashboardRepository) CreateDashboard(dashboard *domain.Dashboard, columns []domain.ColumnDefinition, userId int64) (*domain.Dashboard, error) {
	f.createdName = dashboard.Name
	f.createdColumns = columns
	return dashboard, nil
}

func (f *fakeDashboardRepository) DeleteDashboard(dashboardId int64) error {
	return nil
}

func (f *fakeDashboardRepository) GetPermissionsByUserId(userId int64) ([]int64, error) {
	return []int64{}, nil
}

func (f *fakeDashboardRepository) UpdatePermissionsForUser(userId int64, dashboardIds []int64) error {
	return nil
}

func TestCreateDashboard_EmptyNameRejected(t *testing.T) {
	repo := &fakeDashboardRepository{}
	svc := NewDashboardService(repo)

	if _, err := svc.CreateDashboard("", nil, 1); err == nil {
		t.Fatal("boş tablo ismi reddedilmeliydi")
	}
	if repo.createdName != "" {
		t.Fatal("geçersiz istek repository'e ulaşmamalıydı")
	}
}

func TestCreateDashboard_NilColumnsBecomesEmptySlice(t *testing.T) {
	repo := &fakeDashboardRepository{}
	svc := NewDashboardService(repo)

	if _, err := svc.CreateDashboard("Stok", nil, 1); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.createdColumns == nil {
		t.Fatal("nil columns boş slice'a çevrilmeliydi (JSONB null önlemi)")
	}
}

func TestGetAllDashboards_NilBecomesEmptySlice(t *testing.T) {
	repo := &fakeDashboardRepository{dashboards: nil}
	svc := NewDashboardService(repo)

	result := svc.GetAllDashboards(1, "user")
	if result == nil {
		t.Fatal("nil dashboards boş slice olarak dönmeliydi (frontend null.map önlemi)")
	}
}
