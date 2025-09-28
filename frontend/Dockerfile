# Stage 1: install Node dependencies
FROM node:22-alpine AS node-deps
RUN apk add --no-cache libc6-compat python3 build-base
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Stage 2: build static frontend
FROM node:22-alpine AS node-build
WORKDIR /app
RUN corepack enable
COPY --from=node-deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# Stage 3: build Go API server
FROM golang:1.24 AS go-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY internal ./internal
COPY cmd ./cmd
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o frontend-server ./cmd/frontend-server

# Final runtime image
FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata && update-ca-certificates
COPY --from=go-build /app/frontend-server ./frontend-server
COPY --from=node-build /app/out ./out
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV PORT=8080
ENV FRONTEND_DIST_DIR=/app/out

ENTRYPOINT ["entrypoint.sh"]
CMD ["./frontend-server"]

EXPOSE 8080
