package domain

type Product struct {
	Id          int64
	DashboardId int64
	Name        string
	Price       float32
	Quantity    int64
	Category    []string
	CustomData  map[string]interface{}
}
