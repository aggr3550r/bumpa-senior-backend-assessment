# Bumpa Ecommerce Store

NestJS backend baseline for the Bumpa Senior Backend Engineer assessment.

## Tech Stack

- NestJS
- PostgreSQL
- TypeORM
- Jest
- Docker Compose

## Local Setup

```bash
npm install
cp .env.example .env
npm run start:dev
```

The application exposes a baseline health endpoint:

```bash
GET /health
```

## Docker Setup

```bash
cp .env.example .env
docker compose up --build
```

Docker Compose starts the API and a PostgreSQL 16 database.

## Database Setup

The default local `.env.example` assumes this PostgreSQL role and database:

```text
DATABASE_USER=bumpa
DATABASE_PASSWORD=bumpa
DATABASE_NAME=bumpa_ecommerce
```

When running outside Docker, create matching local PostgreSQL credentials or update `.env` to match your existing database.

## Verification

```bash
npm run lint
npm run build
npm test
```

## Baseline Inventory

- Framework: NestJS 10.
- Runtime: Node.js 22.
- Persistence: PostgreSQL through TypeORM 0.3.
- Current route surface: `GET /health`.
- Existing user model: none present in the workspace at ticket 01 start.
- Existing purchase/order models: none present in the workspace at ticket 01 start.
- Existing achievement/badge structures: none present in the workspace at ticket 01 start.
- Event infrastructure: not introduced yet; domain events are deferred to the event-flow tickets.
- Test framework: Jest with a baseline controller unit test.
- Database migrations: not introduced yet; migration setup belongs with the first schema ticket.

## Assessment Assumptions

- The workspace did not contain a starter NestJS application, so ticket 01 establishes the project baseline instead of adapting existing source.
- PostgreSQL and TypeORM are the selected persistence stack.
- No achievement, badge, purchase, or cashback behavior is introduced in ticket 01.
- TypeORM `synchronize` defaults to `false`; schema changes should be introduced through migrations in later tickets.
- Docker support is included as a baseline because no existing infrastructure files were present.
