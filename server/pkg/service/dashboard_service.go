package service

import (
	"errors"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/repository"
)

type IDashboardService interface {
	GetAllDashboards(userId int64, userRole string) []*domain.Dashboard
	GetDashboardById(dashboardId int64) (*domain.Dashboard, error)
	CreateDashboard(name string, columns []domain.ColumnDefinition, userId int64) (*domain.Dashboard, error)
	DeleteDashboard(dashboardId int64) error
	GetPermissionsByUserId(userId int64) ([]int64, error)
	UpdatePermissionsForUser(userId int64, dashboardIds []int64) error
}

type DashboardService struct {
	dashboardRepository repository.IDashboardRepository
}

func NewDashboardService(dashboardRepository repository.IDashboardRepository) IDashboardService {
	return &DashboardService{dashboardRepository}
}

func (service *DashboardService) GetAllDashboards(userId int64, userRole string) []*domain.Dashboard {
	dashboards := service.dashboardRepository.GetAllDashboards(userId, userRole)
	if dashboards == nil {
		return []*domain.Dashboard{}
	}
	return dashboards
}

func (service *DashboardService) GetDashboardById(dashboardId int64) (*domain.Dashboard, error) {
	return service.dashboardRepository.GetDashboardById(dashboardId)
}

func (service *DashboardService) CreateDashboard(name string, columns []domain.ColumnDefinition, userId int64) (*domain.Dashboard, error) {
	if name == "" {
		return nil, errors.New("tablo ismi boş olamaz")
	}
	if columns == nil {
		columns = []domain.ColumnDefinition{}
	}

	dashboard := &domain.Dashboard{Name: name}
	return service.dashboardRepository.CreateDashboard(dashboard, columns, userId)
}

func (service *DashboardService) DeleteDashboard(dashboardId int64) error {
	return service.dashboardRepository.DeleteDashboard(dashboardId)
}

func (service *DashboardService) GetPermissionsByUserId(userId int64) ([]int64, error) {
	return service.dashboardRepository.GetPermissionsByUserId(userId)
}

func (service *DashboardService) UpdatePermissionsForUser(userId int64, dashboardIds []int64) error {
	return service.dashboardRepository.UpdatePermissionsForUser(userId, dashboardIds)
}
