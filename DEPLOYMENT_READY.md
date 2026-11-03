# Deployment guide

The application can be built as a static Vite site. Production readiness still depends on configuring the production Supabase project and hosting environment.

1. Follow [README.md](./README.md) to apply the database SQL and create/promote the initial Director.
2. Deploy the Director-only `admin-create-user` Edge Function as documented in [README.md](./README.md).
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider. Use only a publishable/anon key in this browser app.
4. Run `npm ci`, `npm test`, `npm run build`, and `npm audit`.
5. Publish `dist` and verify the live booking form, Director account creation, and staff role restrictions against the production database.

Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) as the final release gate. The production environment cannot be verified from this repository alone.
