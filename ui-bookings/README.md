# ui-bookings

Copyright (C) 2025 The Open Library Foundation

This software is distributed under the terms of the Apache License,
Version 2.0. See the file [LICENSE](LICENSE) for more information.

## Introduction

`ui-bookings` is the Stripes UI module for the FOLIO **Bookings** app.
It provides a three-pane interface for creating and managing booking records
that associate inventory items with patron checkouts scheduled for a future date.

## Features

- **Three-pane layout** — search/filter sidebar → results list → detail/edit panel
- **Create bookings** with one or many inventory items per booking
- **Patron lookup** — barcode entry field or `find-user` plugin modal
- **Item lookup** — two mechanisms:
  1. Barcode scan/entry field (press Enter or click search icon)
  2. **Title look-up** — `find-instance` plugin opens the full Inventory search modal (same pattern as the Requests app)
- **Recall warning banner** — when a booked item is currently checked out, a prominent warning explains that a recall will be triggered automatically on save
- **Booking status badges** — colour-coded `Pending`, `Recall triggered`, `Confirmed`, `Active`, `Completed`, `Cancelled`
- **Manual activation** — staff can force checkout early via the "Activate booking" action
- **Delete with confirmation** modal
- Permission-gated UI — edit/delete/activate controls only shown to users with appropriate permissions

## Required backend modules

| Module | Interface | Version |
|--------|-----------|---------|
| `mod-bookings-bl` | `bookings` | `1.0` |
| `mod-users` | `users` | `16.1` |
| `mod-inventory` | `inventory` | `10.0–13.0` |
| `mod-circulation` | `circulation` | `9.0–14.0` |

## Required Stripes plugins

These plugins must be installed in the platform for full functionality:

| Plugin | Type | Usage |
|--------|------|-------|
| `ui-plugin-find-user` | `find-user` | Patron look-up modal |
| `ui-plugin-find-instance` | `find-instance` | Title/item look-up modal |

The app degrades gracefully if plugins are absent — fallback buttons are rendered
that open the plugin container (which will display a "plugin not found" message).

## Permissions

| Permission | Description |
|------------|-------------|
| `ui-bookings.view` | View booking records |
| `ui-bookings.create-edit` | Create and edit bookings, trigger recalls |
| `ui-bookings.delete` | Delete bookings |
| `ui-bookings.override-availability` | Book items regardless of loan status |

## Installation

```bash
# Install dependencies
yarn install

# Serve locally (requires a running Okapi/FOLIO backend)
yarn start

# Build for production
yarn build

# Run tests
yarn test

# Generate module descriptor
yarn build-mod-descriptor
```

## Development setup

Follow the [FOLIO front-end development guide](https://dev.folio.org/start/primer-develop-frontend/)
to set up your local Stripes environment.

```bash
# Point to the FOLIO registry
yarn config set "@folio:registry" https://repository.folio.org/repository/npm-folio/

# Clone alongside stripes-sample-platform
git clone https://github.com/folio-org/stripes-sample-platform
cd stripes-sample-platform

# Add ui-bookings to your stripes.config.js
# '@folio/bookings': {}

# Serve
stripes serve --okapi http://localhost:9130 --tenant diku
```

To serve the app with all permissions enabled before backend permissions are
configured:

```bash
stripes serve --hasAllPerms
```

## Module structure

```
ui-bookings/
├── src/
│   ├── index.js                    # Module entry point; all routes declared here
│   ├── manifest.js                 # stripes-connect resource definitions
│   ├── components/
│   │   ├── BookingsApp.js          # Root three-pane layout component
│   │   ├── BookingsApp.css
│   │   ├── BookingItemsTable.js    # Shared items MCL (read + edit modes)
│   │   ├── BookingDetail/
│   │   │   └── BookingDetail.js    # Third-pane detail view with accordions
│   │   ├── BookingForm/
│   │   │   ├── BookingForm.js      # Create/edit form
│   │   │   └── PatronLookup/
│   │   │       └── PatronLookup.js # Barcode + find-user plugin patron selection
│   │   └── BookingStatus/
│   │       ├── BookingStatusBadge.js   # Colour-coded booking status pill
│   │       └── BookingRecallBadge.js   # Per-item recall status pill
│   ├── settings/
│   │   └── index.js                # Settings entry point (placeholder)
│   └── util/
│       ├── bookingUtils.js         # Shared display/formatting utilities
│       └── validation.js           # Final-form validators
├── translations/
│   └── ui-bookings/
│       └── en.json                 # English translation strings
├── test/
│   ├── components/
│   │   └── BookingStatusBadge.test.js
│   └── util/
│       └── bookingUtils.test.js
├── icons/
│   ├── app.png
│   └── app.svg
├── package.json                    # Stripes module manifest + npm config
└── jest.config.js
```

## Additional information

- [Stripes Module Developer Guide](https://github.com/folio-org/stripes/blob/main/doc/dev-guide.md)
- [FOLIO Developer Documentation](https://dev.folio.org)
- Backend modules: [mod-bookings](../mod-bookings), [mod-bookings-bl](../mod-bookings-bl)

Project issue tracker: `UIBOOKING` JIRA project.
