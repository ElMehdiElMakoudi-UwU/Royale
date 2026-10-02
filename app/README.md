# Royale

Shop management for the pastry shop: product catalog, staff accounts, stock and delivery counts, delivery-note checking, daily cash closing and cash-gap tracking, weekly factory account, expenses, salaries, a monthly result, and a touchscreen cash register (POS). French and Arabic.

Stack: Next.js 16, SQLite (`better-sqlite3` + Drizzle), Tailwind 4. The whole database is one file: `data/royale.db`.

## Run locally

```bash
npm install
npm run seed   # creates the owner account (from .env.local) and the starting catalog
npm run dev    # http://localhost:3000
```

`.env.local` holds `OWNER_NAME`, `OWNER_USERNAME`, `OWNER_PASSWORD`, used by `npm run seed` only on an empty database.

### Reading delivery-note photos

Add `ANTHROPIC_API_KEY=...` to `.env.local` (locally) or to a `.env` file next to `docker-compose.yml` (VPS), then restart.
Without it, photos are still stored with the note but lines are typed by hand. Photos are kept in `data/uploads/`.

## Deploy on the VPS (Docker)

```bash
docker compose build
docker compose run --rm -e OWNER_NAME=... -e OWNER_USERNAME=... -e OWNER_PASSWORD=... app npm run seed
docker compose up -d
```

The app listens on `127.0.0.1:3000`; put Nginx or Caddy in front with HTTPS (login cookies are `Secure` in production).
For a test without HTTPS, set `INSECURE_COOKIES=1`.

**Backups:** copy `data/royale.db` (e.g. a nightly `sqlite3 data/royale.db ".backup backup-$(date +%F).db"`).

## Changing the schema

Edit `src/db/schema.ts`, then `npm run db:generate`. Migrations in `drizzle/` run automatically when the app starts.

## How sales are estimated

For a validated stock count on day D:

    sold = previous validated stock count (day P) + validated delivery counts dated P to D−1 − stock on D

Stock is counted before the morning delivery is put away, so day D's delivery counts toward the next stock count.

## Cash closing and cash gap

Each evening the till is closed: *declared sales = cash counted − morning float + money paid out of the till + card*.

Sales periods run between two consecutive validated stock counts (from the first count's day, up to the day before the next one).
For each period, *expected sales* = (opening stock + validated deliveries − closing stock) × sale price, and the
*cash gap* = declared − expected (negative = money missing). The Ventes page flags what makes a period unreliable:
days without a closing, products without a sale price, products counted only once, unvalidated delivery counts.

## Money

- **Factory account** (weeks run Monday → Sunday): owed = opening balance + accepted amounts of validated delivery notes − payments − credit notes. Draft notes are listed but not counted.
- **Expenses**: entered directly (paid outside the till) plus till payouts from cash closings, once the owner gives them a category. The "Pas une dépense" category (owner withdrawal, advance already recorded) is excluded.
- **Salaries**: monthly salary per employee; advances and salary payments count toward a salary month; bonuses are extra.
- **Monthly result** = declared sales − accepted delivery notes − expenses − salaries paid. Stock changes are ignored.

## Cash register (POS)

- `/pos` is a full-screen register for a tablet: product grid by category, weight pad for products sold by the kg, price pad for products without a sale price, cash (with change) or card.
- Receipts print through the tablet's print system (AirPrint / Android print service) on an 80 mm roll: set paper width to 80 mm and margins to none. Header, footer and auto-print are in Réglages.
- Every sale is saved on the tablet first (`localStorage`) and sent to the server in the background, so the register keeps working when the internet drops; the server ignores duplicates (`client_id`).
- Owner can void a ticket (with a reason) in Tickets. Voided tickets are excluded everywhere.
- With the register in use, the cash closing shows the expected cash (float + cash sales − payouts) against the cash counted, and the Ventes page shows the stock gap: what left the stock but was never rung up.

## Special orders

`/orders` records customer orders for an occasion (birthday, wedding, Eid, Ramadan…): customer and phone, pickup day and time,
optional home delivery, catalog or custom items with their price, and details for the kitchen (writing on the cake…).

- Status: *à préparer* → *prête* → *remise*. Only the owner cancels, reopens or deletes. Open orders are listed by pickup day; late, today's and tomorrow's ones show on the home page.
- Deposits and balance payments are recorded on the order, **not** rung up on the register. Cash and card payments go in the till, so the cash closing adds them to the expected cash and card. Transfers don't go through the till and are added to the monthly result.
- "Imprimer le bon" prints an 80 mm order slip for the customer (total, deposit, balance due).

## How delivery notes are checked

A note is compared with the delivery count(s) of the same date and with the catalog's agreed purchase prices:

- **Quantity**: invoiced vs counted, per product.
- **Unit price**: charged vs agreed.
- **Arithmetic**: qty × unit price vs the printed line amount, and the sum of lines vs the printed total.
- **Received but not invoiced**: counted on delivery, missing from the note.

*Correct amount* = counted quantities × agreed prices (invoiced price when the catalog has none; unmatched lines as printed).
When a factory designation is linked to a product, it's saved as an alias so it's matched automatically next time.
