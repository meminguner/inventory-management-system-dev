package service

import (
	"errors"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/repository"
	"ims-intro/pkg/service/dto"
	"strings"
)

type IProductService interface {
	Add(productCreate *dto.ProductCreate, userId int64, userRole string) error
	GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error)
	GetAllProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error)
	SearchTags(prefix string, dashboardId int64, userId int64, userRole string, column string) ([]string, error)
	UpdateProductById(updatedProduct *dto.ProductCreate, productId int64, userId int64, userRole string) error
	DeleteById(productId int64, userId int64, userRole string) error
}

type ProductService struct {
	productRepository repository.IProductRepository
}

func NewProductService(productRepository repository.IProductRepository) IProductService {
	return &ProductService{productRepository}
}

func (service *ProductService) Add(productCreate *dto.ProductCreate, userId int64, userRole string) error {
	if err := validateProductCreate(productCreate); err != nil {
		return err
	}
	product := productCreateToProduct(productCreate)
	return service.productRepository.AddProduct(product, userId, userRole)
}

func (service *ProductService) GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error) {
	return service.productRepository.GetAllProducts(dashboardId, userId, userRole)
}

func (service *ProductService) GetAllProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error) {
	return service.productRepository.GetProductsByTags(dashboardId, tags, userId, userRole)
}

func (service *ProductService) SearchTags(prefix string, dashboardId int64, userId int64, userRole string, column string) ([]string, error) {
	return service.productRepository.SearchTags(prefix, dashboardId, userId, userRole, column)
}

func (service *ProductService) UpdateProductById(updatedProduct *dto.ProductCreate, productId int64, userId int64, userRole string) error {
	if err := validateProductCreate(updatedProduct); err != nil {
		return err
	}
	product := productCreateToProduct(updatedProduct)
	return service.productRepository.UpdateProductById(product, productId, userId, userRole)
}

func (service *ProductService) DeleteById(productId int64, userId int64, userRole string) error {
	return service.productRepository.DeleteProductById(productId, userId, userRole)
}

func validateProductCreate(p *dto.ProductCreate) error {
	if p.DashboardId <= 0 {
		return errors.New("geçerli bir dashboard id gereklidir")
	}
	// Custom veri içeren ürünler için eski alan validasyonu atlanır
	if len(p.CustomData) > 0 {
		return nil
	}
	if p.Name == "" {
		return errors.New("name can't be empty")
	}
	if p.Price < 0 {
		return errors.New("price can't be less than zero")
	}
	if p.Quantity < 0 {
		return errors.New("quantity can't be less than zero")
	}
	if len(p.Category) == 0 {
		return errors.New("category can't be empty")
	}
	for _, tag := range p.Category {
		if strings.Contains(tag, " ") {
			return errors.New("category tags cannot contain spaces")
		}
	}
	return nil
}

func productCreateToProduct(p *dto.ProductCreate) *domain.Product {
	uniqueCategories := []string{}
	seen := make(map[string]bool)
	for _, cat := range p.Category {
		if !seen[cat] {
			seen[cat] = true
			uniqueCategories = append(uniqueCategories, cat)
		}
	}
	customData := p.CustomData
	if customData == nil {
		customData = map[string]interface{}{}
	}
	return &domain.Product{
		DashboardId: p.DashboardId,
		Name:        p.Name,
		Price:       p.Price,
		Quantity:    p.Quantity,
		Category:    uniqueCategories,
		CustomData:  customData,
	}
}
