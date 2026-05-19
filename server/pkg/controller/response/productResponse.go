package response

import "ims-intro/pkg/domain"

type ProductResponse struct {
	Id          int64    `json:"id"`
	DashboardId int64    `json:"dashboardId"`
	Name        string   `json:"name"`
	Price       float32  `json:"price"`
	Quantity    int64    `json:"quantity"`
	Category    []string `json:"category"`
}

func toProductResponse(product *domain.Product) *ProductResponse {
	return &ProductResponse{
		Id:          product.Id,
		DashboardId: product.DashboardId,
		Name:        product.Name,
		Price:       product.Price,
		Quantity:    product.Quantity,
		Category:    product.Category,
	}
}

func ToProductResponseList(products []*domain.Product) []*ProductResponse {
	responses := make([]*ProductResponse, 0, len(products))
	for _, product := range products {
		responses = append(responses, toProductResponse(product))
	}
	return responses
}
