.PHONY: help install build dev db-init db-migrate db-generate db-seed lint format

# Default target
help:
	@echo "P23 Market Management Commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make build        - Build the project"
	@echo "  make dev          - Start in development mode (watch)"
	@echo "  make db-init      - Initialize database (migrate and seed)"
	@echo "  make db-migrate   - Create and apply migrations"
	@echo "  make db-generate  - Generate Prisma client"
	@echo "  make db-seed      - Seed the database with initial users"
	@echo "  make lint         - Run linting"
	@echo "  make format       - Run code formatting"

install:
	npm install

build:
	npm run build

dev:
	npm run start:dev

db-init: db-migrate db-seed

db-migrate:
	npx prisma migrate dev --name init

db-migrate-reset:
	npx prisma migrate reset

db-generate:
	npx prisma generate

db-seed:
	npx prisma db seed

lint:
	npm run lint

format:
	npm run format
