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
	SearchTags(prefix string, dashboardId int64, userId int64, userRole string) ([]string, error)
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
	err := validateProductCreate(productCreate)
	if err != nil {
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

func (service *ProductService) SearchTags(prefix string, dashboardId int64, userId int64, userRole string) ([]string, error) {
	return service.productRepository.SearchTags(prefix, dashboardId, userId, userRole)
}

func (service *ProductService) UpdateProductById(updatedProduct *dto.ProductCreate, productId int64, userId int64, userRole string) error {
	err := validateProductCreate(updatedProduct)
	if err != nil {
		return err
	}

	product := productCreateToProduct(updatedProduct)
	return service.productRepository.UpdateProductById(product, productId, userId, userRole)
}

func (service *ProductService) DeleteById(productId int64, userId int64, userRole string) error {
	return service.productRepository.DeleteProductById(productId, userId, userRole)
}

func validateProductCreate(productCreate *dto.ProductCreate) error {
	if productCreate.DashboardId <= 0 {
		return errors.New("valid dashboard id is required")
	}
	if productCreate.Name == "" {
		return errors.New("name can't be empty")
	}
	if productCreate.Price < 0 {
		return errors.New("price can't be less than zero")
	}
	if productCreate.Quantity < 0 {
		return errors.New("quantity can't be less than zero")
	}
	if len(productCreate.Category) == 0 {
		return errors.New("category can't be empty")
	}
	for _, tag := range productCreate.Category {
		if strings.Contains(tag, " ") {
			return errors.New("category tags cannot contain spaces, use underscores instead")
		}
	}
	return nil
}

func productCreateToProduct(productCreate *dto.ProductCreate) *domain.Product {
	uniqueCategories := []string{}
	seen := make(map[string]bool)
	for _, cat := range productCreate.Category {
		if !seen[cat] {
			seen[cat] = true
			uniqueCategories = append(uniqueCategories, cat)
		}
	}
	return &domain.Product{
		DashboardId: productCreate.DashboardId,
		Name:        productCreate.Name,
		Price:       productCreate.Price,
		Quantity:    productCreate.Quantity,
		Category:    uniqueCategories,
	}
}
