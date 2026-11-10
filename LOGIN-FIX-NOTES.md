MASTER PRINT — Login and sign-in repair

Changes in this package:
- Rebuilt from the clean MASTER-PRINT-PIXEL-MATCH source, avoiding duplicated toolbar/script injection that could interrupt page parsing.
- Updated the sign-in field to email address and refreshed the login screen with a larger brand mark, printing-machine background, responsive layout, and teal/cyan visual identity.
- Added a password-reset action using the existing Supabase password recovery flow.
- Improved post-authentication handling: valid credentials now open the dashboard even if the optional app_state row cannot be read/initialized; cloud sync problems are reported separately.
- Missing/inactive profiles and profile/RLS errors are now shown directly on the login form with actionable messages.

Deployment:
1. Back up the current GitHub repository.
2. Extract this ZIP and upload its contents to the repository root (index.html must be at root).
3. Keep supabase-config.js from this ZIP, or preserve your current file if it contains the correct project's URL and publishable key.
4. In GitHub Pages, wait for deployment, then hard-refresh the site with Ctrl+F5.

Important:
- This package does not change Supabase passwords, users, roles, company IDs, or database records.
- If the page says there is no active profile, check that the authenticated user's id has a row in public.profiles, with is_active=true and a valid company_id.
- If email/password is rejected, verify the exact email used in Supabase Auth and that email confirmation has been completed if enabled.
- Only the Supabase publishable key belongs in supabase-config.js. Never put a service_role or sb_secret key in the website.
