# P23 Market Backend (NestJS)

Internal office betting ledger API for tracking player-to-player transfers, bank operations, and Rock-Paper-Scissors matches.

## Stack
- **Framework:** NestJS (TypeScript)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT (Passport)
- **Docs:** Swagger UI
- **Infrastructure:** Docker & Docker Compose

## Core Concepts
- **Currency:** `M-coin` (1 coin = 10 THB)
- **Net Worth:** `coin - bankDebt`
- **Public Ledger:** All transactions are visible to all users.
- **Settlements:** Periodic snapshots of all balances for historical tracking.

## Features
- **Authentication:** Login/Register with avatar selection (0-24).
- **Transfers:** Peer-to-peer coin transfers with notes.
- **Bank:** Borrow (increase debt/coin) and Repay (decrease debt/coin) system.
- **Leaderboard:** Real-time ranking by net worth.
- **Arena:** Rock-Paper-Scissors mini-game with instant settlement.
- **Dashboard:** Aggregate stats (Total circulation, Top Winners/Losers).

## API Documentation
Interactive Swagger documentation is available at:
- `http://localhost:3000/api` (Local)
- `https://your-api-url.railway.app/api` (Production)

## Setup & Development (Makefile)
The project includes a `Makefile` for easier management:

```bash
# Install dependencies
make install

# Start database (Docker)
docker-compose up -d

# Initialize Database (Migrations + Seed)
make db-init

# Start in development mode
make dev
```

## Production Deployment (Railway)
1. Push this repository to GitHub.
2. Connect to Railway and add a PostgreSQL service.
3. Set the following environment variables:
   - `DATABASE_URL`: Your Railway Postgres connection string.
   - `JWT_SECRET`: A secure random string.
   - `PORT`: `3000`
4. The service will automatically run `prisma migrate deploy` and `prisma db seed` on every deployment.

## Project Structure
- `src/auth/` Security, JWT, and registration.
- `src/users/` Player profiles and leaderboard.
- `src/transactions/` Transfers and bank operations.
- `src/arena/` RPS mini-game engine.
- `src/settlements/` Administrative balance snapshots.
- `src/dashboard/` Aggregated system statistics.
- `prisma/` Schema and migrations.
- `Dockerfile` & `docker-compose.yml` Containerization.
