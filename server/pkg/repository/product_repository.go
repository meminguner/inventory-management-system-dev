package repository

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
	"ims-intro/pkg/domain"
)

type IProductRepository interface {
	GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error)
	GetProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error)
	SearchTags(prefix string, dashboardId int64, userId int64, userRole string) ([]string, error)
	AddProduct(product *domain.Product, userId int64, userRole string) error
	UpdateProductById(updatedProduct *domain.Product, productId int64, userId int64, userRole string) error
	DeleteProductById(productId int64, userId int64, userRole string) error
}

type ProductRepository struct {
	dbPool *pgxpool.Pool
}

func NewProductRepository(dbPool *pgxpool.Pool) IProductRepository {
	return &ProductRepository{dbPool}
}

func (repository *ProductRepository) GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error) {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole); err != nil {
		return nil, err
	}

	productRows, err := repository.dbPool.Query(ctx, "SELECT id, name, price, quantity, category, dashboard_id FROM products WHERE dashboard_id = $1", dashboardId)
	if err != nil {
		log.Errorf("error while getting all products: %v", err)
		return nil, err
	}

	return extractProductsFromRows(productRows)
}

func (repository *ProductRepository) GetProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error) {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole); err != nil {
		return nil, err
	}

	productRows, err := repository.dbPool.Query(ctx, "SELECT id, name, price, quantity, category, dashboard_id FROM products WHERE dashboard_id = $1 AND category @> $2", dashboardId, tags)
	if err != nil {
		log.Errorf("error while getting all products by tags: %v", err)
		return nil, err
	}

	return extractProductsFromRows(productRows)
}

func (repository *ProductRepository) SearchTags(prefix string, dashboardId int64, userId int64, userRole string) ([]string, error) {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole); err != nil {
		return nil, err
	}

	query := `
		SELECT DISTINCT tag
		FROM (SELECT unnest(category) as tag FROM products WHERE dashboard_id = $2) sub
		WHERE tag ILIKE $1
		ORDER BY tag ASC
		LIMIT 10
	`
	rows, err := repository.dbPool.Query(ctx, query, prefix+"%", dashboardId)
	if err != nil {
		log.Errorf("error while searching tags: %v", err)
		return nil, err
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func (repository *ProductRepository) AddProduct(product *domain.Product, userId int64, userRole string) error {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, product.DashboardId, userId, userRole); err != nil {
		return err
	}

	insertStatement := "INSERT INTO products (name, price, quantity, category, dashboard_id) VALUES ($1, $2, $3, $4, $5)"

	addNewProduct, err := repository.dbPool.Exec(ctx, insertStatement, product.Name, product.Price, product.Quantity, product.Category, product.DashboardId)
	if err != nil {
		log.Errorf("error while adding a new product: %v", err)
		return err
	}

	log.Info(fmt.Sprintf("Product added successfully: %v", addNewProduct))
	return nil
}

func (repository *ProductRepository) UpdateProductById(updatedProduct *domain.Product, productId int64, userId int64, userRole string) error {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, updatedProduct.DashboardId, userId, userRole); err != nil {
		return err
	}

	updateStatement := "UPDATE products SET name = $1, price = $2, quantity = $3, category = $4 WHERE id = $5 AND dashboard_id = $6"
	result, err := repository.dbPool.Exec(ctx, updateStatement, updatedProduct.Name, updatedProduct.Price, updatedProduct.Quantity, updatedProduct.Category, productId, updatedProduct.DashboardId)
	if err != nil {
		log.Errorf("error while updating product: %v", err)
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("product with id %d does not exist in dashboard %d", productId, updatedProduct.DashboardId)
	}

	log.Info(fmt.Sprintf("Product updated successfully: %v", updatedProduct))
	return nil
}

func (repository *ProductRepository) DeleteProductById(productId int64, userId int64, userRole string) error {
	ctx := context.Background()
	if err := repository.ensureProductAccess(ctx, productId, userId, userRole); err != nil {
		return err
	}

	deleteExec, err := repository.dbPool.Exec(ctx, "DELETE FROM products WHERE id = $1", productId)
	if err != nil {
		log.Errorf("error while deleting product: %v", err)
		return err
	}

	log.Info("Product deleted successfully")
	log.Info(fmt.Sprintf("%v rows affected", deleteExec.RowsAffected()))

	return nil
}

func (repository *ProductRepository) ensureDashboardAccess(ctx context.Context, dashboardId int64, userId int64, userRole string) error {
	if dashboardId <= 0 {
		return fmt.Errorf("valid dashboard id is required")
	}

	var exists bool
	if err := repository.dbPool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM dashboards WHERE id = $1)", dashboardId).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("dashboard with id %d does not exist", dashboardId)
	}

	if userRole == "admin" || userRole == "super_user" {
		return nil
	}

	query := "SELECT EXISTS(SELECT 1 FROM dashboard_permissions WHERE user_id = $1 AND dashboard_id = $2)"
	if err := repository.dbPool.QueryRow(ctx, query, userId, dashboardId).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("access denied for dashboard %d", dashboardId)
	}

	return nil
}

func (repository *ProductRepository) ensureProductAccess(ctx context.Context, productId int64, userId int64, userRole string) error {
	var dashboardId int64
	err := repository.dbPool.QueryRow(ctx, "SELECT dashboard_id FROM products WHERE id = $1", productId).Scan(&dashboardId)
	if err != nil {
		return fmt.Errorf("product with id %d does not exist", productId)
	}

	return repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole)
}

func extractProductsFromRows(productRows pgx.Rows) ([]*domain.Product, error) {
	defer productRows.Close()

	products := make([]*domain.Product, 0)

	for productRows.Next() {
		product := &domain.Product{}
		if err := productRows.Scan(&product.Id, &product.Name, &product.Price, &product.Quantity, &product.Category, &product.DashboardId); err != nil {
			return nil, err
		}
		products = append(products, product)
	}

	return products, productRows.Err()
}
