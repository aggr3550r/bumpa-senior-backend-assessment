# Bumpa Ecommerce Store Assessment

NestJS backend for purchase-driven achievements, badge progression, and cashback processing.

## Docker Run

Build images:

```bash
docker compose build --pull
```

Run migrations:

```bash
docker compose --profile tools run --rm migrations
```

Start the API:

```bash
docker compose up app
```

The API listens on `http://localhost:3000` by default. Use `HOST_PORT` to expose a different host port:

```bash
HOST_PORT=8085 docker compose up app
```

Swagger docs are available at:

```text
http://localhost:{PORT}/docs
```

Run tests in Docker:

```bash
docker compose --profile tools run --rm tests
```

Stop containers:

```bash
docker compose down
```

Reset the database volume:

```bash
docker compose down -v
```

## Environment

Docker Compose reads `.env.example` for container-safe defaults. Pass secrets through a local `.env`, exported shell variables, or CI secrets:

```bash
PAYSTACK_SECRET_KEY=your_paystack_test_key docker compose up app worker
```

## Queue Flow

Purchase creation writes a `purchase.completed` outbox row in the same database transaction as the purchase. The worker drains committed outbox rows into BullMQ, then processes purchase, achievement, badge, and cashback jobs asynchronously through Redis.

For local/demo runtime, the API process starts the outbox dispatcher and BullMQ processors automatically. The API request does not wait for achievement evaluation, badge issuance, or Paystack payout attempts.

An optional standalone worker service remains available for production-style process separation:

```bash
docker compose --profile workers up worker
```
