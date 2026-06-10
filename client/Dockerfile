FROM node:20-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .

# Vite env vars build sırasında bundle'a gömülür — runtime'da değiştirilemez.
# API anahtarı backend'de tutulur (AI_API_KEY), bundle'a asla girmez.
ARG VITE_AI_API_PROVIDER=openai
ARG VITE_AI_MODEL=gpt-4o-mini
ENV VITE_AI_API_PROVIDER=$VITE_AI_API_PROVIDER \
    VITE_AI_MODEL=$VITE_AI_MODEL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html
