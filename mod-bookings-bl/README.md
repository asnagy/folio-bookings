# mod-bookings-bl

Copyright (C) 2025 The Open Library Foundation

This software is distributed under the terms of the Apache License,
Version 2.0. See the file [LICENSE](LICENSE) for more information.

## Introduction

`mod-bookings-bl` is the **business logic module** for the FOLIO Bookings app.
It orchestrates the full booking lifecycle:

- Creating bookings with multi-item support
- Detecting items currently on loan and triggering recalls via `mod-circulation`
- Setting a visible recall status flag on the booking record for staff
- Registering a scheduled checkout via Okapi's `_timer` interface
- Performing checkout at booking start date/time by calling `mod-circulation`
- Enriching API responses with patron and item details from `mod-users` and `mod-inventory`

## Architecture

```
ui-bookings
    │
    ▼
mod-bookings-bl  (this module — business logic & orchestration)
    │
    ├──► mod-bookings          (storage via bookings-storage interface)
    ├──► mod-inventory         (item lookup & status check)
    ├──► mod-circulation       (recall triggering & checkout)
    ├──► mod-users             (patron lookup & enrichment)
    └──► circulation-storage   (loan lookup for recall targeting)
```

All cross-module calls are routed through the Okapi gateway using Feign clients
with `X-Okapi-*` header propagation.

## API

Full OpenAPI spec: `src/main/resources/swagger.api/bookings-bl.yaml`

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/bookings/bookings` | Search bookings (CQL), returns enriched records |
| POST   | `/bookings/bookings` | Create booking with recall logic |
| GET    | `/bookings/bookings/{id}` | Get enriched booking |
| PUT    | `/bookings/bookings/{id}` | Update booking |
| DELETE | `/bookings/bookings/{id}` | Delete booking |
| POST   | `/bookings/bookings/{id}/activate` | Manually trigger checkout |
| POST   | `/bookings/scheduled/checkout` | Timer endpoint (called by Okapi every 5 min) |

## Business logic flows

### Creating a booking

```
1. Validate request (dates, itemIds present, userId present)
2. For each itemId:
   a. Fetch item from mod-inventory
   b. If item status == "Checked out":
      - Query loan-storage for the open loan
      - Call POST /circulation/loans/{loanId}/recall
      - Set item recallStatus = TRIGGERED (or REQUIRED if recall fails)
      - Set booking overall status = RECALL_TRIGGERED
   c. Otherwise: item recallStatus = NOT_REQUIRED
3. Persist booking + items via mod-bookings storage
4. Return enriched response (patron name, item details)
```

### Scheduled checkout (Okapi _timer, every 5 minutes)

```
1. Query mod-bookings storage for bookings with:
   status IN (CONFIRMED, RECALL_TRIGGERED, PENDING)
   AND startDate BETWEEN (now - 5min) AND (now + 1min)
2. For each matching booking:
   a. Fetch patron barcode from mod-users
   b. For each item: POST /circulation/check-out-by-barcode
   c. Update booking status = ACTIVE
3. Log any checkout failures; continue processing remaining bookings
```

### Manual activation

Same checkout flow as scheduled, but triggered immediately via
`POST /bookings/bookings/{id}/activate`. Requires `bookings.bookings.item.activate`
permission.

## Required Okapi interfaces

| Interface | Version | Usage |
|-----------|---------|-------|
| `bookings-storage` | 1.0 | Persistence layer |
| `circulation` | 9.0–14.0 | Recall + checkout |
| `inventory` | 10.0–13.0 | Item details & status |
| `users` | 16.1 | Patron enrichment |
| `loan-storage` | 7.0 | Loan lookup for recalls |

## Building

```bash
mvn clean install
```

## Running locally

```bash
java -jar target/mod-bookings-bl-*.jar \
  --OKAPI_URL=http://localhost:9130 \
  --SERVER_PORT=8082
```

The module listens on port **8082** by default.

## Docker

```bash
docker build -t mod-bookings-bl .
docker run -p 8082:8082 \
  -e OKAPI_URL=http://okapi:9130 \
  mod-bookings-bl
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8082` | HTTP port |
| `OKAPI_URL` | `http://okapi:9130` | Okapi gateway URL for cross-module calls |
| `JAVA_OPTIONS` | `-XX:MaxRAMPercentage=66.0` | JVM options |

## Health check

```
GET /admin/health
```

## Additional information

See the [FOLIO Developer documentation](https://dev.folio.org) and the companion
modules `mod-bookings` (storage) and `ui-bookings` (UI) in this repository.

Project issue tracker: `MODBOOKINGBL` JIRA project.
