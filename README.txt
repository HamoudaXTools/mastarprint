MASTER PRINT - Password login using phone number, without SMS/Twilio

Replace index.html and the cloud folder in your GitHub repository.
Keep supabase-config.js beside index.html and use only the Supabase project URL and publishable key.
Follow PHONE_LOGIN_SETUP_AR.md carefully. Run supabase/schema.sql before the owner profile SQL if the schema has not already been installed.
The user enters their phone number and password on the site. Supabase Auth uses an internal synthetic email alias; no SMS or Twilio is used.
Never put a Supabase service_role/secret key in browser files.
Back up current local ERP data before first cloud login.
