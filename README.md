# GreenLoop — Vercel deployment (Node + Postgres)

This is a rewrite of the original PHP/MySQL GreenLoop app so it can run on **Vercel**.

- **Backend:** Node.js + Express (Vercel Function at `api/index.js`)
- **Database:** PostgreSQL (`pg`) — works with Neon, Supabase, or any hosted Postgres
- **Frontend:** the original HTML/CSS/JS, with pages rendered by Express to inject the CSRF token
- **API contract:** unchanged — the frontend still calls `/api.php?action=...`

## Deploy

1. Create a Postgres database (e.g. Neon free tier) and copy its connection string.
2. Create a Vercel project from this folder/repo.
3. Add environment variables in Vercel:
   - `DATABASE_URL` = your Postgres connection string
   - `JWT_SECRET` = a long random string
4. Deploy. The schema in `lib/schema.sql` is created automatically on first request.
5. Visit `https://<your-project>.vercel.app/setup-admin.php`, create the first administrator, then **delete `setup-admin.php`** (remove the route/file) for security.
6. Sign in at `/admin-login.php` or `/driver-login.php`.

## Local development

```bash
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/greenloop JWT_SECRET=dev-secret node api/index.js
```

Open http://localhost:3000/

## Notes

- Sessions are stateless JWTs in an httpOnly cookie (`gl_session`), suitable for serverless.
- CSRF uses a double-submit cookie (`gl_csrf`) injected into page templates as `{{CSRF}}`.
- Uploaded report images are stored as base64 text in the database (serverless has no persistent disk).
- GPS tracking requires HTTPS — Vercel provides it by default.
