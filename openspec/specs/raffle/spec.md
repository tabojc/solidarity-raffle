# Raffle Domain Spec

## Overview

The raffle system manages number reservations and sales for a humanitarian fundraiser. The system supports three user roles (public, seller, admin) with a simple state machine for number management.

## Core Entities

### Number
- **Range**: 00-99 (100 numbers total)
- **States**: available, reserved, sold
- **Transitions**: available → reserved → sold

### Raffle Config
- **Name**: Rifa Solidaria
- **Beneficiary**: Yudith Ortega
- **Prizes**: Primer premio (600$), Segundo premio (400$)
- **Ticket price**: 20$
- **Draw date**: 26/07/2026, 10:30 PM
- **Lottery**: Lotería Táchira A y B

## Requirements

### REQ-001: Number Grid Display

The system MUST display a 10x10 grid of numbers from 00 to 99.

**Scenarios:**

Given a user visits the main page
When the grid loads
Then all 100 numbers are displayed in a 10x10 matrix
And each number shows its current state with appropriate color

Given a number is in "available" state
When displayed
Then it shows with light background and dark text
And it is clickable

Given a number is in "reserved" state
When displayed
Then it shows with rose/muted background
And it is NOT clickable by public users
And it shows "Reservado" indicator

Given a number is in "sold" state
When displayed
Then it shows with accent color background
And it is NOT clickable
And it shows "Vendido" indicator

### REQ-002: Number Reservation

Any public visitor MUST be able to reserve an available number by clicking on it.

**Scenarios:**

Given a number is available
When a visitor clicks on it
Then the number transitions to "reserved" state
And the grid updates to show the new state
And other visitors see the update within 5 seconds

Given a number is already reserved or sold
When a visitor clicks on it
Then nothing happens
And no error is shown

Given a visitor reserves a number
When the reservation is created
Then it includes a timestamp
And it can optionally include the visitor's name/contact

### REQ-003: Reservation Timeout

Reserved numbers MUST return to available state after a configurable timeout.

**Scenarios:**

Given a number is reserved
When 24 hours pass without confirmation
Then the number returns to "available" state
And the grid updates to show availability

Given a number is reserved
When a seller confirms payment before timeout
Then the number transitions to "sold" state
And the timeout is cancelled

### REQ-004: Seller Confirmation

Sellers MUST be able to confirm payments for reserved numbers.

**Scenarios:**

Given a seller accesses the admin panel with valid token
When they view the reserved numbers list
Then they see all numbers in "reserved" state
And they see who reserved each number and when

Given a seller clicks "Confirmar pago" for a reserved number
When the confirmation is submitted
Then the number transitions to "sold" state
And the confirmation timestamp is recorded
And the public grid updates within 5 seconds

### REQ-005: Admin Panel

Admins MUST have access to a control panel with additional features.

**Scenarios:**

Given an admin accesses the panel with valid token
When they view the dashboard
Then they see a summary of numbers by state (available/reserved/sold)
And they see all reserved numbers with seller actions
And they can export data to CSV

Given an admin clicks "Export CSV"
When the export is requested
Then a CSV file is generated with current state
And the file includes: Numero, Estado, ReservadoPor, ReservadoEl, ConfirmadoEl
And the file downloads automatically

### REQ-006: Real-time Updates

The system MUST reflect state changes across all connected clients.

**Scenarios:**

Given multiple users are viewing the grid
When one user reserves a number
Then all other users see the update within 5 seconds

Given the admin confirms a payment
When the state changes to "sold"
Then all public users see the number as sold within 5 seconds

### REQ-007: Mobile Responsiveness

The system MUST be fully functional on mobile devices.

**Scenarios:**

Given a user accesses from a mobile device
When the page loads
Then all elements are visible and tappable
And the grid numbers are at least 44x44px touch targets
And the layout adapts to screen width

### REQ-008: Secret Link Authentication

Admin access MUST be protected by a secret token in the URL.

**Scenarios:**

Given a user visits `/admin?token=VALID_TOKEN`
When the token matches the configured secret
Then they see the admin panel

Given a user visits `/admin?token=INVALID_TOKEN`
When the token does not match
Then they see an access denied message
And they cannot access the admin panel

Given a user visits `/admin` without a token
When no token is provided
Then they see an access denied message

## Non-Functional Requirements

### NFR-001: Performance
- Grid MUST load in under 2 seconds on 3G connection
- State updates MUST propagate within 5 seconds
- CSV export MUST complete within 3 seconds

### NFR-002: Availability
- System MUST be available 99.9% of the time
- Vercel free tier provides sufficient uptime

### NFR-003: Data Integrity
- No double reservation of the same number
- State transitions MUST be atomic
- CSV export MUST reflect consistent state

### NFR-004: Security
- Admin token MUST be at least 16 characters
- Rate limiting: max 10 requests per minute per IP
- No sensitive data exposed in client-side code

## Out of Scope (v1)
- User authentication with login
- Payment integration
- Multiple raffles per deployment
- Real-time WebSocket connections
- Mobile app (PWA considered for v2)
