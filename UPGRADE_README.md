# Kannada Kalavaibhava Cashbook — Upgrade

This is a replacement front-end for the existing Supabase-backed cashbook.

## What changed
- Edit and delete existing transactions.
- Excel workbook export with Summary, Transactions, and Member Report sheets.
- JSON backup download of all current transactions.
- Separate Cash and UPI balances.
- Member-wise contribution totals.
- Improved responsive/mobile dashboard.

## IMPORTANT: Preserve your existing project and data
1. Make a copy of your current project folder first.
2. Do NOT delete or recreate your Supabase project or `public.transactions` table.
3. Do NOT run a DROP, TRUNCATE, or table recreation query.
4. In your existing project, replace only `index.html`, `styles.css`, and `app.js` with the files in this upgrade folder.
5. Keep your existing `config.js`, `manifest.webmanifest`, `sw.js`, and `icon.svg` unchanged.
6. Restart the local web server and hard-refresh the browser (Ctrl+F5).

## No database migration required
The upgrade uses the existing columns:
`id, type, description, amount, payment_mode, transaction_date, created_at`.
Edit and delete use your existing authenticated Supabase client and existing RLS policies.

## How to use
- Money IN: enter member name, amount, payment mode, date.
- Money OUT: enter expense description, amount, payment mode, date.
- Edit: tap Edit beside a transaction, change the fields, then Save changes.
- Delete: tap Delete and confirm. Deletion is permanent from the app; export a backup first.
- Export Excel: downloads a workbook with Summary, Transactions, and Member Report.
- JSON backup: downloads a raw JSON backup of all transactions currently loaded from Supabase.

## Important accounting notes
- Cash balance = Cash credits minus Cash debits.
- UPI balance = UPI credits minus UPI debits.
- Overall balance = Cash balance + UPI balance.
- Member report groups Money IN entries by the description/name. Use consistent spelling for the same member to avoid duplicate rows.
- If an expense was paid using cash, select Cash. If paid by UPI, select UPI.
- The app does not verify bank/UPI transfers; reconcile entries with actual payment records.
- Export Excel and JSON periodically and store backups in a safe place.

## Security
- Continue using your existing Supabase Project URL and Publishable/anon key in `config.js`.
- Never place a Supabase secret/service-role key in browser code.
- Keep Row Level Security enabled. The existing user_id-based RLS policies must remain active.
- Do not share your login or backup files publicly.
