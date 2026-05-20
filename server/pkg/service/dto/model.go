package dto

type UserCreate struct {
	Username string
	Password string
}

type ProductCreate struct {
	DashboardId int64
	Name        string
	Price       float32
	Quantity    int64
	Category    []string
	CustomData  map[string]interface{}
}
