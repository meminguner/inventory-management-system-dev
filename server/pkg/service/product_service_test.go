package service

import (
	"ims-intro/pkg/domain"
	"ims-intro/pkg/service/dto"
	"testing"
)

type fakeProductRepository struct {
	addedProduct   *domain.Product
	updatedProduct *domain.Product
	addErr         error
}

func (f *fakeProductRepository) GetAllProducts(dashboardId int64, userId int64, userRole string) ([]*domain.Product, error) {
	return []*domain.Product{}, nil
}

func (f *fakeProductRepository) GetProductsByTags(dashboardId int64, tags []string, userId int64, userRole string) ([]*domain.Product, error) {
	return []*domain.Product{}, nil
}

func (f *fakeProductRepository) SearchTags(prefix string, dashboardId int64, userId int64, userRole string, column string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeProductRepository) AddProduct(product *domain.Product, userId int64, userRole string) error {
	f.addedProduct = product
	return f.addErr
}

func (f *fakeProductRepository) UpdateProductById(updatedProduct *domain.Product, productId int64, userId int64, userRole string) error {
	f.updatedProduct = updatedProduct
	return nil
}

func (f *fakeProductRepository) DeleteProductById(productId int64, userId int64, userRole string) error {
	return nil
}

func validProductCreate() *dto.ProductCreate {
	return &dto.ProductCreate{
		DashboardId: 1,
		Name:        "Laptop",
		Price:       999.99,
		Quantity:    5,
		Category:    []string{"elektronik"},
	}
}

func TestAdd_ValidLegacyProduct(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	if err := svc.Add(validProductCreate(), 1, "admin"); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.addedProduct == nil {
		t.Fatal("AddProduct repository'e ulaşmadı")
	}
}

func TestAdd_ValidationErrors(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*dto.ProductCreate)
	}{
		{"dashboard id eksik", func(p *dto.ProductCreate) { p.DashboardId = 0 }},
		{"isim boş", func(p *dto.ProductCreate) { p.Name = "" }},
		{"negatif fiyat", func(p *dto.ProductCreate) { p.Price = -1 }},
		{"negatif adet", func(p *dto.ProductCreate) { p.Quantity = -1 }},
		{"kategori boş", func(p *dto.ProductCreate) { p.Category = nil }},
		{"tag'de boşluk", func(p *dto.ProductCreate) { p.Category = []string{"iki kelime"} }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeProductRepository{}
			svc := NewProductService(repo)
			p := validProductCreate()
			tc.mutate(p)

			if err := svc.Add(p, 1, "admin"); err == nil {
				t.Fatal("validasyon hatası bekleniyordu, nil döndü")
			}
			if repo.addedProduct != nil {
				t.Fatal("geçersiz ürün repository'e ulaşmamalıydı")
			}
		})
	}
}

func TestAdd_CustomDataBypassesLegacyValidation(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	p := &dto.ProductCreate{
		DashboardId: 1,
		CustomData:  map[string]interface{}{"Marka": "Acme"},
	}
	if err := svc.Add(p, 1, "admin"); err != nil {
		t.Fatalf("custom_data'lı ürün legacy validasyona takılmamalı: %v", err)
	}
}

func TestAdd_CustomDataDoesNotBypassDashboardIdCheck(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	p := &dto.ProductCreate{
		DashboardId: 0,
		CustomData:  map[string]interface{}{"Marka": "Acme"},
	}
	if err := svc.Add(p, 1, "admin"); err == nil {
		t.Fatal("dashboard id kontrolü custom_data ile atlanmamalı")
	}
}

func TestAdd_DeduplicatesCategories(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	p := validProductCreate()
	p.Category = []string{"a", "b", "a", "b", "c"}

	if err := svc.Add(p, 1, "admin"); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	got := repo.addedProduct.Category
	want := []string{"a", "b", "c"}
	if len(got) != len(want) {
		t.Fatalf("kategori dedup hatalı: %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("kategori sırası/dedup hatalı: %v", got)
		}
	}
}

func TestAdd_NilCustomDataBecomesEmptyMap(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	if err := svc.Add(validProductCreate(), 1, "admin"); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.addedProduct.CustomData == nil {
		t.Fatal("nil CustomData boş map'e çevrilmeliydi (JSONB null önlemi)")
	}
}

func TestUpdate_ValidationApplies(t *testing.T) {
	repo := &fakeProductRepository{}
	svc := NewProductService(repo)

	p := validProductCreate()
	p.Name = ""

	if err := svc.UpdateProductById(p, 10, 1, "admin"); err == nil {
		t.Fatal("update'te de validasyon hatası bekleniyordu")
	}
	if repo.updatedProduct != nil {
		t.Fatal("geçersiz ürün repository'e ulaşmamalıydı")
	}
}
