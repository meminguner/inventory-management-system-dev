# Akıllı Stok Takip Sistemi (Inventory Management System)

Yapay zeka destekli, özelleştirilebilir sütun yapısıyla dinamik tablo yönetimi sunan modern bir stok takip uygulaması. Varlık yönetimi ihtiyaçlarını karşılayan bu sistem; rol tabanlı erişim kontrolü (RBAC), esnek tablo tasarımı ve yapay zeka ile otomatik veri doldurma özelliklerini bir arada sunar.

---

## Temel Özellikler

### Dinamik Tablo Sistemi
- Kullanıcılar kendi stok tablolarını özel sütunlarla tasarlayabilir
- Desteklenen sütun tipleri: **metin**, **adet** (tam sayı), **sayı** (ondalıklı), **etiket/tag** (çoklu değer)
- Her sütun için tip bazlı kısıtlamalar: minLength, maxLength, min, max, decimalPlaces, maxTags
- Sütun verileri PostgreSQL JSONB alanında saklanır; şema değişikliklerine gerek kalmaz

### AI ile Tablo Oluşturma (Görev 2)
- Kullanıcı bir ürün görseli ve/veya metin açıklama sağlar
- Sistem, OpenAI `gpt-4o-mini` modeline görsel + metin gönderir
- AI, tablonun amacına uygun sütun yapısını (`ColumnDefinition[]`) otomatik önerir
- Kullanıcı önerileri düzenleyip onaylar; tablo oluşturulur
- Mimari: provider-agnostic AI client (OpenAI ve Anthropic destekli), prompt sandwich konfigürasyonu

### AI ile Ürün Ekleme (Görev 3)
- Tablo detay sayfasında "✨ Akıllı Ürün Ekle" butonu
- Kullanıcı ürün görseli ve/veya açıklama girer
- AI'ya tablonun sütun şeması ve mevcut etiket havuzu context olarak verilir
- AI, her sütun için uygun değeri (`metin` → string, `adet` → integer, `sayı` → number, `tag` → string[]) doldurur
- Form pre-fill'li açılır; kullanıcı düzenleyip kaydedebilir

### Rol Tabanlı Erişim Kontrolü (RBAC)
| Rol | Yetkiler |
|-----|----------|
| `admin` | Tam yetki — kullanıcı yönetimi, tüm tablolar, tablo silme |
| `super_user` | Tablo oluşturma/silme, kullanıcı yönetimi (user rolünü), tüm tablolara erişim |
| `user` | Yalnızca atanan tablolar, profil düzenleme |

### Etiket (Tag) Sistemi
- Ürün kaydında mevcut etiketler arasından seçim yapılabilir
- Yeni etiket yazıldığında o tablonun etiket havuzuna eklenir
- Otomatik tamamlama (autocomplete) araması destekler

### Ürün Tablosu
- Tag bazlı arama ve filtreleme
- Autocomplete öneriler (3+ karakter)
- Ürün düzenleme ve silme
- Tablo silme (onay modalı ile)

---

## Mimari

### Backend — Go + Echo v4
```
server/pkg/
├── controller/    # HTTP handler'ları (Echo route'ları)
├── service/       # İş mantığı katmanı
├── repository/    # PostgreSQL sorguları (pgx v4)
├── middleware/    # JWT auth, RBAC rol kontrolü
└── domain/        # Struct tanımları (Dashboard, Product, Claims)
```

- **Auth:** JWT cookie (`token`) — HttpOnly değil; frontend `js-cookie` ile okur
- **JSONB:** `column_definitions` (tablo şeması) ve `custom_data` (ürün verileri) JSONB olarak saklanır
- **Migration:** `cmd/migrate/main.go` — `IF NOT EXISTS` ile idempotent

### Frontend — React + TypeScript + Vite + Tailwind CSS
```
client/src/
├── lib/
│   └── ai-client.ts        # Provider-agnostic AI client (OpenAI + Anthropic)
├── config/
│   └── ai-prompts.ts       # Prompt sandwich konfigürasyonu (Görev 2 & 3)
└── components/
    ├── Root.tsx             # Ana sayfa — dashboard kartları
    ├── Dashboard.tsx        # Tablo detayı — ürün listesi, AI modal
    ├── Add.tsx              # Ürün ekleme — LegacyForm + DynamicForm
    ├── Update.tsx           # Ürün güncelleme
    ├── CreateTable.tsx      # Tablo oluşturma sihirbazı (2 adım)
    ├── CreateTableAI.tsx    # AI ile tablo oluşturma sayfası
    ├── ColumnDefinitionForm.tsx  # Sütun tanımlama formu
    ├── UserManagement.tsx   # Kullanıcı yönetimi
    ├── Profile.tsx          # Profil düzenleme
    ├── Header.tsx           # Global üst bilgi (auth nav)
    ├── Login.tsx
    └── SignUp.tsx
```

- **State:** Redux/Zustand yok — JWT cookie + local useState
- **API:** Vite proxy `/api/*` → `localhost:8080`

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend dil | Go 1.23+ |
| Web framework | Echo v4 |
| Veritabanı | PostgreSQL 12+ |
| DB driver | pgx v4 |
| Auth | JWT (golang-jwt/jwt/v5) |
| Frontend dil | TypeScript |
| UI framework | React 18 |
| Build tool | Vite |
| CSS | Tailwind CSS |
| AI provider | OpenAI (gpt-4o-mini) / Anthropic |
| HTTP client | Fetch API (provider-agnostic) |

---

## AI Entegrasyonu — Teknik Detay

### Soyut AI Client (`ai-client.ts`)
```ts
// Tablo şeması üretme (Görev 2)
generateTableSchema({ tableName, description?, image? }) → ColumnDefinition[]

// Ürün alanları doldurma (Görev 3)
generateProductFields({ description?, image?, tableSchema, existingTags? }) → Record<string, value>
```

- Provider env var'dan okunur: `VITE_AI_API_PROVIDER=openai|anthropic`
- Model env var'dan okunur: `VITE_AI_MODEL=gpt-4o-mini`
- 60 saniyelik timeout — AbortController kullanır
- Görsel base64 encode edilerek gönderilir (vision API)
- Markdown code fence strip — AI'nın JSON döndürmesini sağlar

### Prompt Sandwich Yapısı (`ai-prompts.ts`)
```
[PRE_PROMPT]  ← uzman rolü + kural seti
Tablo şeması / Kullanıcı açıklaması
[POST_PROMPT] ← strict JSON format zorunluluğu
```

### AI Veri Akışı — Görev 2
```
Kullanıcı (görsel + metin)
    → CreateTableAI.tsx
    → generateTableSchema()
    → OpenAI gpt-4o-mini
    → ColumnDefinition[] parse
    → CreateTable.tsx Step 2 pre-fill
    → Kullanıcı onaylar
    → POST /api/dashboards
```

### AI Veri Akışı — Görev 3
```
Kullanıcı (görsel + metin)
    → Dashboard.tsx AI Modal
    → buildExistingTags() ← mevcut ürünlerden
    → generateProductFields(tableSchema, existingTags)
    → OpenAI gpt-4o-mini
    → buildPrefillValues() ← tip dönüşümleri
    → DynamicAddForm pre-fill
    → Kullanıcı düzenler + kaydeder
    → POST /api/products
```

---

## Kurulum

### Docker ile (önerilen)

Tek gereksinim: Docker (Desktop veya Engine).

```bash
# Root dizininde .env oluştur ve değerleri doldur
cp .env.example .env
# Zorunlu: DB_PASSWORD, JWT_KEY, VITE_AI_API_KEY

# Tüm stack'i ayağa kaldır (db + migration + api + web)
docker compose up --build -d
```

Uygulama: `http://localhost:3000` (port `WEB_PORT` ile değiştirilebilir)

- `db` — PostgreSQL 16, veriler `pgdata` volume'unda kalıcı
- `migrate` — idempotent şema migration'ı, tek seferlik çalışır
- `api` — Go backend (`:8080`, container içi)
- `web` — nginx; statik frontend + `/api/*` → backend proxy

> Not: `VITE_*` değişkenleri build sırasında bundle'a gömülür — değiştirince
> `docker compose up --build web` ile web imajını yeniden build etmek gerekir.

### Manuel kurulum

Gereksinimler:
- Go 1.23+
- Node.js 18+
- PostgreSQL 12+

### Backend
```bash
# Root dizininde .env oluştur
cp .env.example .env
# .env içindeki DB ve JWT değerlerini doldur

# Migration (idempotent)
cd server && go run cmd/migrate/main.go

# Sunucuyu başlat
go run cmd/imsapi/main.go   # :8080
```

### Frontend
```bash
cd client

# AI entegrasyonu için .env oluştur
cp .env.example .env
# VITE_AI_API_KEY değerini doldur

npm install
npm run dev   # :5173
```

Vite proxy: `/api/*` → `localhost:8080`

---

## Lisans
MIT — orijinal lisans metni [LICENSE](LICENSE) dosyasında korunmaktadır.
