# Aureline Hotel

A responsive hotel website and management frontend for Aureline Hotel in Sorsogon City, Philippines. It uses React, React Router, Vite, Lucide icons, and Bootstrap's grid stylesheet. The guest website includes rooms, booking search, guest account access, stay management, Sorsogon location copy, and selected discount offers.

## Run

```sh
npm install
npm run dev
```

On Windows PowerShell with script restrictions, use `npm.cmd` instead of `npm`. Open the URL printed by Vite, usually `http://localhost:5173`.

```sh
npm test               # Authentication, booking rules, search state, and screen rendering
npm run build         # Production build
npm run format        # Format source, tests, and this guide
npm run format:check  # Check formatting
```

## Structure

```text
src/
  App.jsx                  Provider, routes, and global feedback only
  main.jsx                 React entry point
  routes/                  Route definitions and role-aware route guards
  layouts/                 Public website, management workspace, and auth shells
  context/HotelContext.jsx Shared hotel records, accounts, session, and UI state
  hooks/useSaved.js        Browser-local persistence
  components/
    ui/                    Reusable primitives, brand, fields, modal shell, feedback
    layout/                Management sidebar and header
    rooms/                 Room and public collection cards
    reservations/          Booking bar and reservation table
    forms/                 Separate CRUD, reservation, payment, and password forms
    modals/                Room, guest, booking details, and cancellation dialogs
  pages/
    public/                Home, room collection/details, experiences, contact, search
    auth/                  Shared login and guest sign-up
    account/               Guest stays and profile
    workspace/             Dashboard, reservations, rooms, guests, billing, team
  services/authService.js  Authentication adapter
  data/                    Seed records and hotel website content
  utils/                   Date, currency, name, ID, and search helpers
  styles/                  Management, public website, and authentication styles
  styles.css               Stylesheet entry point
  data.js                  Shared data/utility exports
  reservationRules.js      Date overlap and room status rules
tests/                     Node test runner checks
```

## Screens And Access

| Route                                                          | Screen / access                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `/`                                                            | Public Aureline Hotel homepage                                 |
| `/stay`                                                        | Room collection                                                |
| `/stay/single`, `/stay/double`, `/stay/deluxe`, `/stay/suite`  | Room details                                                   |
| `/experiences`                                                 | Dining, leisure, and gatherings                                |
| `/contact`                                                     | Sorsogon location, stay information, and FAQs                  |
| `/search`                                                      | Availability search; sign in to reserve                        |
| `/login`                                                       | One email/password login for Guest, Front Desk, and Admin      |
| `/signup`                                                      | Guest account registration                                     |
| `/my-stays`                                                    | Signed-in guest's upcoming, current, past, and cancelled stays |
| `/profile`                                                     | Signed-in account profile                                      |
| `/dashboard`, `/reservations`, `/rooms`, `/guests`, `/billing` | Admin and Front Desk workspace                                 |
| `/team`                                                        | Admin-only team management                                     |

The homepage is the starting screen. Account role comes from the matched email account; the login form does not let a person assign their own role. Guest sign-up always creates a Guest. Staff accounts are managed by Admin. Unauthorized routes redirect to login or the correct account area.

Search dates, guest count, and room type are kept in the URL, including the return through login/sign-up. Guest stays show only reservations associated with that guest's ID. The booking lifecycle, room/guest records, staff directory, payment recording, and printable receipts are available in the management workspace.

## Sign-In Accounts

All seeded accounts use **`Aureline123!`**:

| Account    | Email                        |
| ---------- | ---------------------------- |
| Guest      | `isabella.reyes@example.com` |
| Front Desk | `maria@aureline.hotel`       |
| Admin      | `alex@aureline.hotel`        |

Open `/login`, expand **Sign-in access for Guest, Front Desk, and Admin**, choose an account, then submit the form. Newly registered guests can sign out and sign back in with their chosen password. Active staff added by Admin can use the shared access password above.

## Notes For Backend Integration

Replace `services/authService.js` with Express authentication endpoints, implement password hashing on the server, issue/verify JWTs, and enforce roles and record ownership on every protected API. Add MongoDB persistence, server-side input validation, atomic reservation/payment operations, password reset/change, and secure staff provisioning. Axios is installed for integration. Suggested resource routes: `/api/auth`, `/api/users`, `/api/rooms`, `/api/guests`, `/api/reservations`, `/api/payments`.

Reservation history is retained; linked guests/rooms cannot be deleted. Checkout requires payment settlement. Reservations block overlapping dates, and maintenance rooms cannot be reserved. Prices use PHP per night with no tax or service charge configured. Payment recording does not charge a card. Cancellation does not process refunds.

The public website includes original Aureline Hotel branding and Sorsogon City copy. Photography loads from Unsplash; fonts load from Google Fonts with local fallbacks.

To reset local records, clear this site's localStorage keys beginning with `ah-` and reload.
