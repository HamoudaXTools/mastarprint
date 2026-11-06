# إعداد الربط السحابي لـ MASTER PRINT


# MASTER PRINT Cloud integration — setup

## What this package does now
- Adds a Supabase SQL schema for one MASTER PRINT company, staff profiles and shared ERP state.
- Adds a browser connection bar and Supabase email/password sign-in.
- Saves the existing `alm_data` ERP state to a shared cloud row and listens for Realtime changes.
- Keeps the existing UI and local data structure.
- Uses only the Supabase publishable key in the browser. Never expose a secret/service-role key.

## Important scope / honest limitations
This is the first cloud-connection foundation, not the final normalized ERP migration. The current web app's legacy username/password login and `mp_users` are still local and are NOT made secure by this patch. Cloud sign-in is a separate Supabase Auth sign-in. Do not treat local user roles as server-enforced permissions.
The first pass stores the ERP data as one JSON snapshot per company. It is suitable for initial connection/testing and light use, but simultaneous edits from multiple users can overwrite each other. Before production use, migrate invoices, sales, purchases, customers, inventory, work orders and accounting to separate relational tables with per-record RLS and conflict-safe writes. Product images currently stored as base64/local browser data need a separate Storage upload migration.
Do not put any Supabase secret key in this website, Android APK, GitHub, or chat.

## 1. Create the Supabase project
1. Open https://supabase.com/dashboard and sign in / create an account.
2. Click New project, create or select an organization.
3. Name it `master-print`, choose a strong database password and keep it in a password manager.
4. Select a region close to your users (for Egypt, choose the nearest available region with acceptable latency).
5. Wait for provisioning to finish.

## 2. Create database tables and security
1. Open the project > SQL Editor > New query.
2. Open `supabase/schema.sql` from this package, copy all contents, paste into SQL Editor, then click Run.
3. Open Database > Replication (or Publications) and verify `public.app_state` is enabled for `supabase_realtime` if the script reports it was not found.
4. In Authentication > Providers, ensure Email is enabled. Disable public signups after the first admin account is created if only the owner should create staff accounts.

## 3. Create the first owner login
1. Open Authentication > Users > Add user.
2. Create the owner's email/password account (use an email you control).
3. Copy the new user's UUID.
4. Open SQL Editor and run this query after replacing both placeholders:
   - `YOUR_AUTH_USER_UUID` with the UUID from Auth > Users.
   - `YOUR_COMPANY_NAME` with `MASTER PRINT`.

   ```sql
   with new_company as (
     insert into public.companies(name) values ('YOUR_COMPANY_NAME')
     returning id
   )
   insert into public.profiles(id, company_id, full_name, role, is_active)
   select 'YOUR_AUTH_USER_UUID'::uuid, id, 'مدير النظام', 'owner', true
   from new_company;
   ```
5. For each additional staff member, create a user in Authentication > Users, then add a profile row with the same company_id and role `admin`, `manager`, `employee`, or `viewer`. Do not copy the old local passwords into SQL.

## 4. Connect the website
1. In the project, open Connect (or Settings > API Keys).
2. Copy the Project URL and the Publishable key (`sb_publishable_...`).
3. In the project folder, copy `supabase-config.example.js` to a new file named `supabase-config.js`.
4. Put the Project URL and publishable key into that new file.
5. Upload the whole folder to your hosting provider (Vercel or another static host). The config file must be served beside `index.html`.
6. Open the site, click “تسجيل دخول السحابة”, and sign in with the owner Supabase email/password.
7. On the first successful connection, the current browser's `alm_data` is uploaded if no cloud snapshot exists. On later connections, the cloud snapshot is loaded into the browser.

## 5. Connect Android
Use the same Supabase Project URL and publishable key in the Android app. Sign users in with Supabase Auth, then read/write `public.app_state` for the authenticated user's company. RLS checks `profiles.company_id`; do not bypass it. Subscribe to Realtime changes on `app_state` filtered by the company UUID.
The Android app ZIP supplied earlier is a UI/build starter and does not yet contain the full production Supabase data layer. The next Android implementation pass must add Supabase Auth, fetch the user's profile/company_id, load app_state, subscribe to Realtime and write changes using the same schema.

## 6. Migration of existing local records
Before the first cloud sign-in, open the original website in the browser that contains the latest data. Export a backup from the system and keep it safely. Then connect that same browser first so it seeds the cloud snapshot. Do not sign in from a blank/new browser before the correct data-bearing browser has seeded the cloud. After seeding, verify invoice/customer/product/order counts before using other devices.

## Security notes
- Browser/mobile: Project URL + publishable key only.
- Server-only: secret key (`sb_secret_...`) only in a protected server environment; never in HTML, JS, APK or Git.
- Enable MFA for owner accounts where possible.
- RLS must remain enabled. Never create public read/write policies for business data.
- The old local `mp_users` login is not a secure multi-user identity system. Replace it with Supabase Auth before production use.
