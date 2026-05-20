package domain

type ColumnType string

const (
	ColumnTypeMetin ColumnType = "metin"
	ColumnTypeAdet  ColumnType = "adet"
	ColumnTypeSayi  ColumnType = "sayı"
	ColumnTypeTag   ColumnType = "tag"
)

type ColumnConstraints struct {
	MinLength     *int     `json:"minLength,omitempty"`
	MaxLength     *int     `json:"maxLength,omitempty"`
	Min           *float64 `json:"min,omitempty"`
	Max           *float64 `json:"max,omitempty"`
	DecimalPlaces *int     `json:"decimalPlaces,omitempty"`
	MaxTags       *int     `json:"maxTags,omitempty"`
}

type ColumnDefinition struct {
	Name        string            `json:"name"`
	Type        ColumnType        `json:"type"`
	Constraints ColumnConstraints `json:"constraints"`
}

type Dashboard struct {
	Id                int64              `json:"id"`
	Name              string             `json:"name"`
	ColumnDefinitions []ColumnDefinition `json:"columnDefinitions"`
}
