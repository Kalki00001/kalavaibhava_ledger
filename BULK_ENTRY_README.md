# Bulk Entry update — Kannada Kalavaibhava Cashbook

This update adds multiple Money IN or Money OUT rows and saves the batch in one Supabase insert. It uses the existing `transactions` table and existing RLS policies. No SQL migration is required.

## Deploy the update
1. Back up your current website folder.
2. In the folder you deployed, replace `index.html`, `styles.css`, and `app.js` with these three files.
3. Keep your existing `config.js`, `manifest.webmanifest`, `sw.js`, and `icon.svg`.
4. Test locally at `http://localhost:5500` first.
5. Deploy the updated folder to Netlify using the same existing site (do not create a new site).

## Use it
- Select Money IN or Money OUT.
- Add rows, one per member or expense.
- Each row has its own amount and Cash/UPI mode.
- Choose a common date for the batch.
- Check the batch total and click Save all entries.
- A successful insert refreshes the dashboard and history.

A multi-row Supabase insert is sent as one database request. If it returns an error, the app does not show a success message. Check the error before retrying to avoid accidental duplicates. Existing records are not modified.
