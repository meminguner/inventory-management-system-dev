package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/labstack/gommon/log"
	"ims-intro/pkg/domain"
)

type IProductRepository interface {
	GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error)
	GetProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error)
	SearchTags(prefix string, dashboardId int64, userId int64, userRole string, column string) ([]string, error)
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

	rows, err := repository.dbPool.Query(ctx,
		"SELECT id, name, price, quantity, category, dashboard_id, custom_data FROM products WHERE dashboard_id = $1",
		dashboardId,
	)
	if err != nil {
		log.Errorf("error while getting all products: %v", err)
		return nil, err
	}
	return extractProductsFromRows(rows)
}

func (repository *ProductRepository) GetProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error) {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole); err != nil {
		return nil, err
	}

	rows, err := repository.dbPool.Query(ctx,
		"SELECT id, name, price, quantity, category, dashboard_id, custom_data FROM products WHERE dashboard_id = $1 AND category @> $2",
		dashboardId, tags,
	)
	if err != nil {
		log.Errorf("error while getting products by tags: %v", err)
		return nil, err
	}
	return extractProductsFromRows(rows)
}

func (repository *ProductRepository) SearchTags(prefix string, dashboardId int64, userId int64, userRole string, column string) ([]string, error) {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, dashboardId, userId, userRole); err != nil {
		return nil, err
	}

	var rows pgx.Rows
	var err error

	if column == "" {
		rows, err = repository.dbPool.Query(ctx, `
			SELECT DISTINCT tag
			FROM (SELECT unnest(category) AS tag FROM products WHERE dashboard_id = $2) sub
			WHERE tag ILIKE $1
			ORDER BY tag ASC
			LIMIT 10
		`, prefix+"%", dashboardId)
	} else {
		rows, err = repository.dbPool.Query(ctx, `
			SELECT DISTINCT elem
			FROM products,
			     jsonb_array_elements_text(
			         CASE WHEN jsonb_typeof(custom_data->$3) = 'array'
			         THEN custom_data->$3
			         ELSE '[]'::jsonb END
			     ) AS elem
			WHERE dashboard_id = $2 AND elem ILIKE $1
			ORDER BY elem ASC
			LIMIT 10
		`, prefix+"%", dashboardId, column)
	}

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

	customDataJSONB, err := marshalJSONB(product.CustomData)
	if err != nil {
		return err
	}

	_, err = repository.dbPool.Exec(ctx,
		"INSERT INTO products (name, price, quantity, category, dashboard_id, custom_data) VALUES ($1, $2, $3, $4, $5, $6)",
		product.Name, product.Price, product.Quantity, product.Category, product.DashboardId, customDataJSONB,
	)
	if err != nil {
		log.Errorf("error while adding a new product: %v", err)
		return err
	}

	log.Info(fmt.Sprintf("Product added successfully for dashboard %d", product.DashboardId))
	return nil
}

func (repository *ProductRepository) UpdateProductById(updatedProduct *domain.Product, productId int64, userId int64, userRole string) error {
	ctx := context.Background()
	if err := repository.ensureDashboardAccess(ctx, updatedProduct.DashboardId, userId, userRole); err != nil {
		return err
	}

	customDataJSONB, err := marshalJSONB(updatedProduct.CustomData)
	if err != nil {
		return err
	}

	result, err := repository.dbPool.Exec(ctx,
		"UPDATE products SET name = $1, price = $2, quantity = $3, category = $4, custom_data = $5 WHERE id = $6 AND dashboard_id = $7",
		updatedProduct.Name, updatedProduct.Price, updatedProduct.Quantity, updatedProduct.Category, customDataJSONB, productId, updatedProduct.DashboardId,
	)
	if err != nil {
		log.Errorf("error while updating product: %v", err)
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("product with id %d does not exist in dashboard %d", productId, updatedProduct.DashboardId)
	}

	log.Info(fmt.Sprintf("Product %d updated successfully", productId))
	return nil
}

func (repository *ProductRepository) DeleteProductById(productId int64, userId int64, userRole string) error {
	ctx := context.Background()
	if err := repository.ensureProductAccess(ctx, productId, userId, userRole); err != nil {
		return err
	}

	_, err := repository.dbPool.Exec(ctx, "DELETE FROM products WHERE id = $1", productId)
	if err != nil {
		log.Errorf("error while deleting product: %v", err)
		return err
	}
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

	if err := repository.dbPool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM dashboard_permissions WHERE user_id = $1 AND dashboard_id = $2)",
		userId, dashboardId,
	).Scan(&exists); err != nil {
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

func extractProductsFromRows(rows pgx.Rows) ([]*domain.Product, error) {
	defer rows.Close()
	products := make([]*domain.Product, 0)
	for rows.Next() {
		product := &domain.Product{}
		var customDataJSONB pgtype.JSONB
		if err := rows.Scan(&product.Id, &product.Name, &product.Price, &product.Quantity, &product.Category, &product.DashboardId, &customDataJSONB); err != nil {
			return nil, err
		}
		product.CustomData = unmarshalJSONBMap(customDataJSONB)
		products = append(products, product)
	}
	return products, rows.Err()
}

func marshalJSONB(v interface{}) (pgtype.JSONB, error) {
	if v == nil {
		return pgtype.JSONB{Bytes: []byte("{}"), Status: pgtype.Present}, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return pgtype.JSONB{}, err
	}
	return pgtype.JSONB{Bytes: b, Status: pgtype.Present}, nil
}

func unmarshalJSONBMap(j pgtype.JSONB) map[string]interface{} {
	result := map[string]interface{}{}
	if j.Status == pgtype.Present && len(j.Bytes) > 0 {
		json.Unmarshal(j.Bytes, &result) //nolint:errcheck
	}
	return result
}
