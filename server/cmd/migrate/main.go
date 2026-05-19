package main

import (
	"context"
	"fmt"
	"ims-intro/pkg/common/app"
	"ims-intro/pkg/common/postgresql"
	"log"
	"path/filepath"

	"github.com/joho/godotenv"
)

func main() {
	envPath := filepath.Join("..", ".env")
	err := godotenv.Load(envPath)
	if err != nil {
		log.Println("Error loading .env file, continuing with environment variables")
	}

	ctx := context.Background()
	configurationManager := app.NewConfigurationManager()
	dbPool := postgresql.GetConnectionPool(ctx, configurationManager.PostgresqlConfig)
	defer dbPool.Close()

	fmt.Println("Running migrations...")

	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username VARCHAR(255) NOT NULL UNIQUE,
		password TEXT NOT NULL,
		role VARCHAR(50) NOT NULL DEFAULT 'user'
	);`
	_, err = dbPool.Exec(ctx, createUsersTable)
	if err != nil {
		log.Fatalf("Failed to create users table: %v", err)
	}
	fmt.Println("Users table created or already exists.")

	// 1. Create dashboards table
	createDashboardsTable := `
	CREATE TABLE IF NOT EXISTS dashboards (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL
	);`
	_, err = dbPool.Exec(ctx, createDashboardsTable)
	if err != nil {
		log.Fatalf("Failed to create dashboards table: %v", err)
	}
	fmt.Println("Dashboards table created or already exists.")

	// 1.1 Insert a default dashboard if table is empty so existing products aren't orphaned
	insertDefaultDashboard := `
	INSERT INTO dashboards (name)
	SELECT 'Ana Tablo'
	WHERE NOT EXISTS (SELECT 1 FROM dashboards);
	`
	_, err = dbPool.Exec(ctx, insertDefaultDashboard)
	if err != nil {
		log.Fatalf("Failed to insert default dashboard: %v", err)
	}

	var defaultDashboardId int
	err = dbPool.QueryRow(ctx, "SELECT id FROM dashboards ORDER BY id ASC LIMIT 1").Scan(&defaultDashboardId)
	if err != nil {
		log.Fatalf("Failed to get default dashboard id: %v", err)
	}

	checkProductsTableQuery := `
	SELECT EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_name = 'products'
	);
	`
	var productsTableExists bool
	err = dbPool.QueryRow(ctx, checkProductsTableQuery).Scan(&productsTableExists)
	if err != nil {
		log.Fatalf("Failed to check if products table exists: %v", err)
	}

	if !productsTableExists {
		createProductsTable := fmt.Sprintf(`
		CREATE TABLE products (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			price REAL NOT NULL DEFAULT 0,
			quantity INT NOT NULL DEFAULT 0,
			category TEXT[] NOT NULL DEFAULT '{}',
			dashboard_id INT NOT NULL DEFAULT %d REFERENCES dashboards(id) ON DELETE CASCADE
		);`, defaultDashboardId)
		_, err = dbPool.Exec(ctx, createProductsTable)
		if err != nil {
			log.Fatalf("Failed to create products table: %v", err)
		}
		fmt.Println("Products table created.")
	}

	// 2. Add dashboard_id to products
	// Check if column exists first to be idempotent
	checkColumnQuery := `
	SELECT column_name 
	FROM information_schema.columns 
	WHERE table_name='products' and column_name='dashboard_id';
	`
	var colName string
	err = dbPool.QueryRow(ctx, checkColumnQuery).Scan(&colName)
	if err != nil && err.Error() != "no rows in result set" {
		log.Fatalf("Failed to check if dashboard_id column exists: %v", err)
	}

	if colName == "" {
		addDashboardIdColumn := fmt.Sprintf(`
		ALTER TABLE products 
		ADD COLUMN dashboard_id INT NOT NULL DEFAULT %d REFERENCES dashboards(id) ON DELETE CASCADE;
		`, defaultDashboardId)

		_, err = dbPool.Exec(ctx, addDashboardIdColumn)
		if err != nil {
			log.Fatalf("Failed to add dashboard_id column to products: %v", err)
		}
		fmt.Println("Added dashboard_id column to products table.")
	} else {
		fmt.Println("dashboard_id column already exists in products table.")
	}

	// 3. Create dashboard_permissions table
	createDashboardPermissionsTable := `
	CREATE TABLE IF NOT EXISTS dashboard_permissions (
		user_id INT REFERENCES users(id) ON DELETE CASCADE,
		dashboard_id INT REFERENCES dashboards(id) ON DELETE CASCADE,
		PRIMARY KEY (user_id, dashboard_id)
	);`
	_, err = dbPool.Exec(ctx, createDashboardPermissionsTable)
	if err != nil {
		log.Fatalf("Failed to create dashboard_permissions table: %v", err)
	}
	fmt.Println("dashboard_permissions table created or already exists.")

	fmt.Println("Migration completed successfully.")
}
