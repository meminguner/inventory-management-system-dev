package request

import "ims-intro/pkg/service/dto"

type AddProductRequest struct {
	DashboardId int64    `json:"dashboardId"`
	Name        string   `json:"name"`
	Price       float32  `json:"price"`
	Quantity    int64    `json:"quantity"`
	Category    []string `json:"category"`
}

func (request *AddProductRequest) ToModel() *dto.ProductCreate {
	return &dto.ProductCreate{
		DashboardId: request.DashboardId,
		Name:        request.Name,
		Price:       request.Price,
		Quantity:    request.Quantity,
		Category:    request.Category,
	}
}
