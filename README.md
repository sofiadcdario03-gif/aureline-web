# Aureline Hotel

A responsive hotel website and management frontend for Aureline Hotel in Sorsogon City, Philippines. It uses React, React Router, Vite, Lucide icons, and Bootstrap's grid stylesheet. The guest website includes rooms, booking search, guest account access, stay management, Sorsogon location copy, and selected discount offers.

## Run

```sh
npm install
npm run seed:rooms
npm run server
```

In a second terminal:

```sh
npm run dev
```

On Windows PowerShell with script restrictions, use `npm.cmd` instead of `npm`. Open the URL printed by Vite, usually `http://localhost:5173`.

```sh
npm test               # Authentication, booking rules, search state, and screen rendering
npm run build         # Production build
npm run format        # Format source, tests, and this guide
npm run format:check  # Check formatting
```

Copy `.env.example` to `.env` and set `MONGO_URI`, `JWT_SECRET`, and the email settings before starting the API. `MONGODB_DB_NAME` defaults to `hotel-management`. Use a unique random secret of at least 32 bytes for `JWT_SECRET`; the server only generates an ephemeral signing key for local development when it is unset. Production startup requires an explicit `JWT_SECRET`.

`npm run seed:rooms` inserts the 24 sample rooms only when their IDs are absent; it does not overwrite existing room records and is safe to rerun. To create the first administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the local `.env` and run `npm run create-admin`. The setup command refuses to overwrite an existing account and never prints the password. Existing browser-only room, guest, reservation, and payment data is not automatically imported into MongoDB; it is left untouched in the browser's prior `ah-*` localStorage keys.

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

## API and Reservations

The Express API uses MongoDB Atlas for rooms, guests, staff, credentials, reservations, and payment records. Passwords are PBKDF2-hashed on the server. Signed access tokens are required for protected APIs; Admin manages rooms and staff, Admin/Front Desk manage workspace records and reservations, and Guests may only view or cancel their own reservations. Room search is public.

Room status values are `Available`, `Maintenance`, and `Inactive`. Occupancy and availability are derived from active reservation records; overlapping stays are rejected using check-in/check-out dates, with checkout/check-in on the same date allowed. Reservation creation and edits use MongoDB transactions to serialize claims per room. Historical reservations remain stored when a room is archived.

API endpoints include `/api/auth/login`, `/api/auth/register`, `/api/rooms`, and `/api/reservations`, plus protected guest/staff/profile endpoints and the existing OTP/password-reset routes. The frontend talks only to Express; MongoDB credentials remain server-side.

Reservation history is retained; linked guests/rooms cannot be deleted. Checkout requires payment settlement. Reservations block overlapping dates, and maintenance rooms cannot be reserved. Prices use PHP per night with no tax or service charge configured. Payment recording does not charge a card. Cancellation does not process refunds.

The public website includes original Aureline Hotel branding and Sorsogon City copy. Photography loads from Unsplash; fonts load from Google Fonts with local fallbacks.

To reset local records, clear this site's localStorage keys beginning with `ah-` and reload.
