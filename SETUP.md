# One-time setup (about 15–25 minutes)

You need a free Supabase project and a static website host that supports HTTPS.

## 1. Create the online database
1. Open https://supabase.com/ and create an account.
2. Create a new project. Keep the database password somewhere safe.
3. In the project dashboard, open **SQL Editor**.
4. Open `supabase-schema.sql` from this folder, copy the entire contents, paste it into SQL Editor, and run it.
5. In **Authentication -> Providers -> Email**, keep Email enabled and disable **Allow new users to sign up**. For a private event ledger, email confirmation is recommended.

## 2. Connect this website to Supabase
1. In Supabase, open **Project Settings -> API** (or **Data API / API Keys**, depending on dashboard layout).
2. Copy the **Project URL**.
3. Copy the **anon / publishable key**. Never copy the `service_role` or secret key.
4. Open `config.js` and replace the two placeholder values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

The anon/publishable key is intended for browser use only because database access is restricted by the Row Level Security policies you ran in step 1.

Before applying the hardened policies, set `cashbook_owner` to `true` in the existing owner's **raw app metadata** in the Supabase Dashboard user editor. Do not use user metadata, and do not change the owner's email or password. Sign out and sign back in afterward so the refreshed JWT contains the server-controlled claim. Users without this claim are denied by RLS.

## 3. Publish the website
Upload all files in this folder to a static HTTPS host, such as Netlify, Cloudflare Pages, or GitHub Pages. The `config.js` file must be included. For a quick private test, use Netlify Drop or another static host that gives you an HTTPS URL.

Do not share the URL publicly if you want the app to stay discreet. The login is the access control; an unlisted URL alone is not security.

## 4. Use it on your Android phone
1. Open the HTTPS website in Chrome.
2. Sign in with the existing owner account.
3. Tap Chrome's menu (⋮) -> **Add to Home screen** or **Install app**.
4. Open it from your home screen like an app.

## 5. Daily use
- When a member pays: choose **Money IN**, enter their name, amount and Cash/UPI, then tap **Add money received**.
- When you spend: choose **Money OUT**, enter the expense purpose, amount and Cash/UPI, then tap **Record money spent**.
- The balance and history update after each saved transaction.

## Security and backup notes
- Row Level Security is enabled and each row is tied to the signed-in user.
- The app does not expose a service-role key.
- Supabase project/database backups and retention depend on the plan. Export your transactions periodically as an additional backup; this starter version does not yet include an export button.
- Never share your login, email verification links, or database secrets.

Production hosting: Netlify
Source control: GitHub
Automatic deployment: Enabled
Database: Supabase
