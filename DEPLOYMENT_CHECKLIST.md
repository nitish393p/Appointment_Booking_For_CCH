# Production deployment checklist

## Supabase

- [ ] Run `supabase/schema.sql`, followed by `supabase/booking.sql`.
- [ ] On an existing project, rerun `booking.sql` before deploying the updated frontend. This drops the old meeting-mode column and permanently deletes its stored values.
- [ ] Confirm the booking SQL verification query returns `public_book` with `anon_can_execute = true`; the script also requests a PostgREST schema-cache reload.
- [ ] Run the scripts against the same Supabase project whose URL is configured in the hosting environment.
- [ ] Deploy `supabase/functions/admin-create-user` to the same project (`npx supabase link --project-ref <project-ref>`, then `npx supabase functions deploy admin-create-user`).
- [ ] Keep the function JWT verification enabled; never add a Supabase secret/service-role key to frontend or hosting build variables.
- [ ] Create the initial Director in Supabase Auth and promote that user's profile to `director` and `active = true`.
- [ ] Disable public Auth sign-ups unless they are intentionally required. New profiles are inactive by default.
- [ ] Confirm RLS is enabled on all public data tables and that the browser app uses only a publishable/anon key (never a secret or `service_role` key).
- [ ] Run the latest `booking.sql` to enable the dashboard holiday calendar and its staff/leader access policies. Add office closures from the Director or Assistant Director dashboard; existing appointments are not cancelled automatically.
- [ ] Run the latest `schema.sql` to allow active staff members to register clients; non-leader registrations are assigned to the creating staff member.
- [ ] Verify public slots are Tuesday through Sunday, with Monday closed and the configured break times unavailable.

## Hosting

- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's build environment.
- [ ] Build with `npm ci` and `npm run build`; publish the generated `dist` directory.
- [ ] Confirm the SPA fallback and security headers from the platform configuration are active.
- [ ] Keep `.env.local` out of source control; use `.env.example` only as a placeholder template.

## Validation

- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] `npm audit` has no unresolved high/critical advisories.
- [ ] Test one public booking end to end against the production Supabase project.
- [ ] Verify staff sign-in, role restrictions, appointment updates, and sign-out.
- [ ] As Director, create one test Forensics Expert and Assistant Director account; verify their different data/finance access and deactivate the test accounts afterward.
- [ ] Confirm the production site uses HTTPS and the `/book` route works on mobile and desktop.

Do not treat deployment as complete until the production database and hosted environment variables have both been configured and the live booking flow has been verified.
