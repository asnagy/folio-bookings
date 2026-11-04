# FOLIO Bookings App

Copyright (C) 2025 The Open Library Foundation  
Apache License 2.0 — see [LICENSE](LICENSE)

---

## Overview

The **Bookings** app lets library staff create booking records that reserve one
or more inventory items for a patron and automatically check them out at a
scheduled future date and time.

This repository contains all three modules that make up the app:

| Module | Role | Language / Framework |
|--------|------|----------------------|
| [`mod-bookings`](mod-bookings/) | Storage layer — CRUD persistence for booking records | Java 17 / Spring Boot 3 / PostgreSQL |
| [`mod-bookings-bl`](mod-bookings-bl/) | Business logic — recall triggering, checkout scheduling, enriched API | Java 17 / Spring Boot 3 |
| [`ui-bookings`](ui-bookings/) | User interface — three-pane Stripes app | JavaScript / React / Stripes |

---

## Feature summary

- Create a booking for one or more inventory items assigned to a patron
- Patron lookup via barcode entry **or** `find-user` plugin modal
- Item lookup via barcode scan/entry **or** "Title look-up" (`find-instance` plugin)
- Automatic **recall triggering** when a booked item is currently on loan:
  - Recall is sent to `mod-circulation` immediately on booking creation
  - Booking carries a visible `Recall Triggered` status for staff visibility
- Automatic **checkout at start date/time** via Okapi's `_timer` interface
  (runs every 5 minutes; no external scheduler required)
- **Manual activation** — staff can force checkout early from the UI
- Permission-gated UI: View / Create+Edit / Delete / Override availability
- Booking statuses: `Pending → Recall Triggered → Confirmed → Active → Completed / Cancelled`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FOLIO Platform                        │
│                                                               │
│  ┌────────────┐     ┌──────────────────┐                     │
│  │ ui-bookings│────►│ mod-bookings-bl  │                     │
│  │  (Stripes) │     │ (business logic) │                     │
│  └────────────┘     └──────┬───────────┘                     │
│                             │                                  │
│              ┌──────────────┼──────────────────┐              │
│              ▼              ▼                  ▼              │
│       mod-bookings    mod-circulation    mod-inventory        │
│       (storage)       (recall/checkout) (item lookup)        │
│              │                                                │
│              ▼                                                │
│          PostgreSQL                                           │
│                                                               │
│       mod-users      circulation-storage                      │
│       (patron data)  (loan lookup for recalls)               │
└─────────────────────────────────────────────────────────────┘
```

All inter-module communication is routed through Okapi. `mod-bookings-bl` uses
Spring Cloud OpenFeign clients that automatically propagate `X-Okapi-Tenant`,
`X-Okapi-Token`, and `X-Okapi-Url` headers on every outbound call.

---

## Okapi interfaces

### Provided

| Interface | Version | Module |
|-----------|---------|--------|
| `bookings-storage` | 1.0 | `mod-bookings` |
| `bookings` | 1.0 | `mod-bookings-bl` |

### Required by `mod-bookings-bl`

| Interface | Version |
|-----------|---------|
| `bookings-storage` | 1.0 |
| `circulation` | 9.0–14.0 |
| `inventory` | 10.0–13.0 |
| `users` | 16.1 |
| `loan-storage` | 7.0 |

---

## Permissions

All permissions are defined in the `mod-bookings-bl` ModuleDescriptor and
mirrored in the `ui-bookings` package.json.

| Permission set | Description |
|----------------|-------------|
| `bookings.bookings.view` | View-only access |
| `bookings.bookings.create-edit` | Create, edit, activate |
| `bookings.bookings.delete` | Delete bookings |
| `bookings.bookings.override-availability` | Book items regardless of loan status |
| `bookings.all` | All of the above |

---

## Quick-start: local development

### Backend

```bash
# 1. Start Postgres
docker run -d --name folio-pg \
  -e POSTGRES_USER=folio_admin \
  -e POSTGRES_PASSWORD=folio_admin \
  -e POSTGRES_DB=okapi_modules \
  -p 5432:5432 postgres:13

# 2. Build and run mod-bookings (storage) on port 8081
cd mod-bookings
mvn clean package -DskipTests
java -jar target/mod-bookings-*.jar

# 3. Build and run mod-bookings-bl (BL) on port 8082
cd ../mod-bookings-bl
mvn clean package -DskipTests
java -jar target/mod-bookings-bl-*.jar --OKAPI_URL=http://localhost:9130
```

### Frontend

```bash
cd ui-bookings
yarn install
yarn config set "@folio:registry" https://repository.folio.org/repository/npm-folio/

# Serve against a local Okapi (with all permissions for initial dev)
stripes serve --okapi http://localhost:9130 --tenant diku --hasAllPerms
```

---

## Deployment to a FOLIO reference environment

1. Publish Docker images for `mod-bookings` and `mod-bookings-bl`
2. Register ModuleDescriptors with Okapi
3. Enable both modules for the tenant via `/_/proxy/tenants/{tenant}/modules`
4. Add `@folio/bookings` to the platform's `package.json` and `stripes.config.js`
5. Ensure `ui-plugin-find-user` and `ui-plugin-find-instance` are also enabled

Refer to the FOLIO DevOps guide:
[Install a new back-end module to reference environments](https://dev.folio.org/guides/install-backend-module/)

---

## Issue tracker

| Module | JIRA project |
|--------|-------------|
| `mod-bookings` | `MODBOOKING` |
| `mod-bookings-bl` | `MODBOOKINGBL` |
| `ui-bookings` | `UIBOOKING` |

---

## Additional information

- [FOLIO Developer Documentation](https://dev.folio.org)
- [Stripes Module Developer Guide](https://github.com/folio-org/stripes/blob/main/doc/dev-guide.md)
- [FOLIO Spring Way Guide](https://dev.folio.org/start/primer-develop-backend/)
- [OpenAPI Primer for FOLIO](https://dev.folio.org/start/primer-develop-backend/)
