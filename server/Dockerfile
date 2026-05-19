FROM golang:1.23.0 AS builder

WORKDIR /build
COPY go.* .
RUN go mod download
COPY . .
RUN go build -o ./ims cmd/imsapi/main.go

FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=builder /build/ims ./ims

# Configure DB_USER, DB_PORT, DB_PASSWORD, DB_HOST, DB_NAME, and JWT_KEY
# with environment variables at runtime.
ENV PORT=8080

CMD ["/app/ims"]
