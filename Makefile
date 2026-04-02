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
	docker compose exec notifications npx prisma migrate dev

# Generate Prisma clients
generate:
	cd services/auth && npx prisma generate
	cd services/projects && npx prisma generate
	cd services/chat && npx prisma generate
	cd services/notifications && npx prisma generate

# Create initial migrations
migrate-init:
	cd services/auth && npx prisma migrate dev --name init
	cd services/projects && npx prisma migrate dev --name init
	cd services/chat && npx prisma migrate dev --name init
	cd services/notifications && npx prisma migrate dev --name init

# Push schema directly (no migration files needed — for dev/hackathon)
db-push:
	docker compose exec projects npx prisma db push --accept-data-loss
	docker compose exec auth npx prisma db push --accept-data-loss
	docker compose exec chat npx prisma db push --accept-data-loss
	docker compose exec notifications npx prisma db push --accept-data-loss

# Seed demo data (run after db-push)
seed:
	docker compose exec auth npx tsx prisma/seed.ts
	docker compose exec projects npx tsx prisma/seed.ts
	docker compose exec chat npx tsx prisma/seed.ts
	docker compose exec notifications npx tsx prisma/seed.ts

# Reset DB + re-seed (full clean demo state)
reset:
	docker compose exec postgres psql -U platform -c "DROP DATABASE IF EXISTS auth_db; DROP DATABASE IF EXISTS projects_db; DROP DATABASE IF EXISTS chat_db; DROP DATABASE IF EXISTS notifications_db;"
	docker compose exec postgres psql -U platform -c "CREATE DATABASE auth_db; CREATE DATABASE projects_db; CREATE DATABASE chat_db; CREATE DATABASE notifications_db;"
	$(MAKE) db-push
	$(MAKE) seed
