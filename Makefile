.PHONY: dev prod down logs clean migrate

# Development with hot reload
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production build
prod:
	docker compose up --build -d

# Stop all services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Logs for specific service
logs-%:
	docker compose logs -f $*

# Clean everything (volumes included)
clean:
	docker compose down -v --rmi local

# Run migrations manually
migrate:
	docker compose exec auth npx prisma migrate dev
	docker compose exec projects npx prisma migrate dev
	docker compose exec chat npx prisma migrate dev

# Generate Prisma clients
generate:
	cd services/auth && npx prisma generate
	cd services/projects && npx prisma generate
	cd services/chat && npx prisma generate

# Create initial migrations
migrate-init:
	cd services/auth && npx prisma migrate dev --name init
	cd services/projects && npx prisma migrate dev --name init
	cd services/chat && npx prisma migrate dev --name init
