# mod-bookings

Copyright (C) 2025 The Open Library Foundation

This software is distributed under the terms of the Apache License,
Version 2.0. See the file [LICENSE](LICENSE) for more information.

## Introduction

`mod-bookings` is the **storage module** for the FOLIO Bookings app. It provides
persistent storage for booking records and booking-item associations via a RESTful
API defined in OpenAPI 3.0.

This module follows the [FOLIO Spring Way](https://dev.folio.org/start/primer-develop-backend/)
pattern using Spring Boot 3, JPA/Hibernate, PostgreSQL, and Liquibase.

## Architecture

```
ui-bookings  ──►  mod-bookings-bl  ──►  mod-bookings  (this module)
                  (business logic)       (storage / persistence)
```

`mod-bookings` is a pure CRUD storage layer. All business logic (recall triggering,
checkout automation, cross-module orchestration) lives in `mod-bookings-bl`.

## API

The full OpenAPI specification is at
`src/main/resources/swagger.api/bookings.yaml`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/bookings-storage/bookings` | Search bookings (CQL) |
| POST   | `/bookings-storage/bookings` | Create a booking |
| GET    | `/bookings-storage/bookings/{id}` | Get booking by ID |
| PUT    | `/bookings-storage/bookings/{id}` | Update a booking |
| DELETE | `/bookings-storage/bookings/{id}` | Delete a booking |
| GET    | `/bookings-storage/booking-items` | List booking-item associations |
| POST   | `/bookings-storage/booking-items` | Add item to a booking |
| DELETE | `/bookings-storage/booking-items/{id}` | Remove item from a booking |

### Booking statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Newly created, items not yet verified |
| `RECALL_REQUIRED` | One or more items are on loan; staff must recall |
| `RECALL_TRIGGERED` | Recall has been sent via mod-circulation |
| `CONFIRMED` | All items available, checkout will fire at start time |
| `ACTIVE` | Checkout has been performed; items are on loan to the patron |
| `COMPLETED` | Booking period has ended |
| `CANCELLED` | Booking was cancelled |

## Data model

### `bookings` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID | FOLIO user record |
| `start_date` | timestamptz | Checkout fires at this date/time |
| `end_date` | timestamptz | |
| `status` | varchar(32) | See status table above |
| `notes` | varchar(2000) | Staff notes |
| `pickup_service_point_id` | UUID | |
| `created_date` | timestamptz | Managed by folio-spring-base |
| `created_by_user_id` | UUID | |
| `updated_date` | timestamptz | |
| `updated_by_user_id` | UUID | |

### `booking_items` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `booking_id` | UUID FK | References `bookings.id` |
| `item_id` | UUID | mod-inventory item UUID |
| `instance_id` | UUID | Denormalized for display |
| `holdings_record_id` | UUID | |
| `item_barcode` | varchar(128) | Denormalized for display |
| `item_title` | varchar(512) | Denormalized for display |
| `call_number` | varchar(256) | |
| `recall_status` | varchar(32) | `NOT_REQUIRED`, `REQUIRED`, `TRIGGERED`, `RETURNED` |

## Prerequisites

- Java 17
- Maven 3.8+
- PostgreSQL 13+
- A running Okapi instance

## Building

```bash
mvn clean install
```

## Running locally

```bash
# Start a local Postgres instance
docker run -d \
  -e POSTGRES_USER=folio_admin \
  -e POSTGRES_PASSWORD=folio_admin \
  -e POSTGRES_DB=okapi_modules \
  -p 5432:5432 postgres:13

# Run the module
java -jar target/mod-bookings-*.jar \
  --DB_HOST=localhost \
  --DB_PORT=5432 \
  --DB_USERNAME=folio_admin \
  --DB_PASSWORD=folio_admin \
  --DB_DATABASE=okapi_modules
```

The module listens on port **8081** by default.

## Docker

```bash
docker build -t mod-bookings .
docker run -p 8081:8081 \
  -e DB_HOST=postgres \
  -e DB_USERNAME=folio_admin \
  -e DB_PASSWORD=folio_admin \
  -e DB_DATABASE=okapi_modules \
  mod-bookings
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8081` | HTTP port |
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `folio_admin` | PostgreSQL username |
| `DB_PASSWORD` | `folio_admin` | PostgreSQL password |
| `DB_DATABASE` | `okapi_modules` | PostgreSQL database name |
| `JAVA_OPTIONS` | `-XX:MaxRAMPercentage=66.0` | JVM options |

## Health check

```
GET /admin/health
```

## Additional information

See the [FOLIO Developer documentation](https://dev.folio.org) for more information
on developing FOLIO backend modules.

Project issue tracker: create tickets under the `MODBOOKING` JIRA project.
