# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache curl bash && curl -fsSL https://get.dotenvx.com | sh

COPY package*.json ./
RUN npm ci

COPY . .
ARG DOTENVX_PRIVATE_KEY_PRODUCTION
ENV DOTENVX_PRIVATE_KEY_PRODUCTION=$DOTENVX_PRIVATE_KEY_PRODUCTION
RUN dotenvx run -f .env.production -- npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
