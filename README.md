# Bumpa Ecommerce Store Assessment

NestJS backend for purchase-driven achievements, badge progression, and cashback processing.

## Run With Docker

Build the images:

```bash
docker compose build
```

Run database migrations:

```bash
docker compose --profile tools run --rm migrations
```

Start Postgres and the API:

```bash
docker compose up app
```

The API listens on `http://localhost:3000` by default. Swagger docs are available at:

```text
http://localhost:3000/docs
```

If your local `.env` overrides `PORT` and that host port is already in use, choose another host port:

```bash
PORT=3001 docker compose up app
```

Run tests in Docker:

```bash
docker compose --profile tools run --rm tests
```

Stop and remove containers:

```bash
docker compose down
```

Reset the local database volume:

```bash
docker compose down -v
```

## Environment

Docker Compose reads `.env.example` and supplies container-safe defaults. To use real Paystack credentials locally, export them before running Compose:

```bash
export PAYSTACK_SECRET_KEY=your_paystack_test_key
docker compose up app
```

For local demo runs, `NODE_ENV=development` allows the Paystack adapter to mock the specific unverified-business payout restriction returned by Paystack. Other provider failures still fail normally.

## Seed Data

Achievement and badge definitions are loaded from `src/resources/*.json` when the API starts and `PROGRESSION_DEFINITION_LOADERS_ENABLED=true`. Run migrations first so the loader has the required tables.

## Queue Worker

There is no separate queue process in this project. Domain events are handled in-process through Nest's event emitter, so `docker compose up app` runs the complete application flow.

## Local Commands

Install dependencies:

```bash
npm ci
```

Run the app:

```bash
npm run start:dev
```

Run migrations:

```bash
npm run migration:run
```

Run verification:

```bash
npm run lint && npm run build && npm test
```
