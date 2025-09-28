# UFW Panel Frontend

This package now consists of two pieces that ship together:

- A static Next.js interface exported into the `out/` directory.
- A Go gateway (`cmd/frontend-server`) that replaces the former Next.js API routes and serves both the static assets and the proxy endpoints consumed by the UI.

## Prerequisites

- Node.js 22+ (with Corepack/Yarn enabled)
- Go 1.23+

## Development workflow

1. Install dependencies once:
   ```bash
   yarn install
   ```
2. Export the UI whenever you need fresh static assets:
   ```bash
   yarn build
   ```
   The build writes to `out/` and can be watched/served by the Go server immediately.
3. Start the Go server (it will serve `/api/*` and the static front-end). The process automatically loads variables from a local `.env` file if present:
   ```bash
   AUTH_PASSWORD=changeme \
   JWT_SECRET=some-long-secret \
   go run ./cmd/frontend-server
   ```
4. Optional: when running `yarn dev` for rapid UI iteration, point the browser calls to the Go server by exporting `NEXT_PUBLIC_API_BASE=http://localhost:8080` before starting the dev server.

Environment variables recognised by the server:

- `AUTH_PASSWORD` – password expected by the `/api/auth` endpoint (required for login).
- `JWT_SECRET` – HMAC secret used to sign the session cookie (required).
- `JWT_EXPIRATION` – optional TTL expression (`1d`, `12h`, etc.), default `1d`.
- `PORT` – listening port for the Go server, default `8080`.
- `FRONTEND_DIST_DIR` – override location of the exported Next.js assets if you are not using the default `./out`.
- `FRONTEND_DB_PATH` – optional path to the SQLite file (`./database/ufw-webui.db` by default).
- `FRONTEND_ALLOWED_ORIGINS` – optional comma-separated list of origins permitted for cross-site requests with cookies; leave unset to allow requests from any origin.

## Production build

The provided Dockerfile compiles the Go gateway and exports the UI in a multi-stage build:

```bash
docker build -t ufw-panel-frontend ./frontend
```

The resulting image exposes port `8080` and expects the same environment variables listed above at runtime.

## Testing

Run the following commands from the `frontend/` directory to make sure the project still builds cleanly:

```bash
# Compile the Go gateway
go build ./...

# Lint the React client
yarn lint

# Regenerate the static export used by the Go server
yarn build

# (Optional) Smoke-test the full stack locally
AUTH_PASSWORD=changeme \
JWT_SECRET=some-long-secret \
go run ./cmd/frontend-server
```

If you have additional Go or React tests in the future, add them alongside these commands so they remain easy to discover.
