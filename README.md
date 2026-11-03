# CyberCase Appointments

Appointment management for Cyber Crime Helpline LLP, with a public booking form and an authenticated staff dashboard.

## Requirements

- Node.js 20 or newer
- A Supabase project

## Local setup

1. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable/anon key. Never use a Supabase secret or `service_role` key in this browser app.
2. In the Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/booking.sql`.
   The booking script refreshes PostgREST's schema cache and prints a verification row for the `public_book` RPC. Confirm `anon_can_execute` is `true`.
   On an existing project, rerun `booking.sql` before deploying the updated app; it removes the old appointment mode column and its stored values, and enables the dashboard holiday calendar. Active staff can view holidays; Directors and Assistant Directors can add or remove them.
   The staff app temporarily supplies a hidden legacy value if an older database still requires the removed mode column. Run the latest `booking.sql` to remove that column and avoid the compatibility path.
3. Create the initial Director user in Supabase Auth. Promote the director profile using that user's Auth email:

   ```sql
   update public.profiles
   set role = 'director', active = true
   where id = (select id from auth.users where lower(email) = lower('YOUR_DIRECTOR_EMAIL'));
   ```

   New profiles are inactive by default. Disable public Auth sign-ups unless they are specifically required.
4. Install dependencies and start the app:

   ```sh
   npm ci
   npm run dev
   ```

The public form is at `/book`; the staff dashboard is available at `/`.

Directors and Assistant Directors can add company holidays from the dashboard calendar. New public bookings are blocked for those dates; existing appointments are not cancelled automatically.

Any active staff member can use **Register client** in the staff dashboard to record a client and schedule an appointment. Registrations by Forensics Experts are assigned to their own account and start as **Requested**; leaders can assign the client to a team member and set the initial status.

## Director-managed staff accounts

Sign in as the active Director and open **Team**. The Director can create staff accounts using each member's email address and a unique password (at least 6 characters), choose Assistant Director or Forensics Expert access, change roles, and deactivate/reactivate accounts. Assistant Directors can see all appointments and finance; Forensics Experts can see assigned appointments only and cannot see finance. Only Directors can create or manage accounts.

The account-creation Edge Function uses Supabase's server-side secret key and checks the caller's active Director profile. Supabase supplies this key only to the function runtime; never put it in the browser app or web-hosting environment.

Deploy the function to the same Supabase project used by `VITE_SUPABASE_URL`:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy admin-create-user --project-ref YOUR_PROJECT_REF
```

The function must be deployed before **Create account** can work. Confirm it appears under **Edge Functions** in the Supabase Dashboard; deploy it to the same project as `VITE_SUPABASE_URL`.

In the Supabase Dashboard, keep email/password authentication enabled and disable public sign-ups unless you specifically need them. New staff can then sign in with the email and password created by the Director.

## Try the full UI without Supabase

Run `npm run dev:demo` and open the local site. Demo mode uses sample data for the staff dashboard and booking flow, so you can test the pages without configuring the database. Changes are temporary and are never sent to Supabase. Demo mode only runs in the Vite development server; production builds always use the configured Supabase project.

## Verification

```sh
npm test
npm run build
npm audit
```

## Deployment

Deploy the Vite `dist` output with `npm run build`. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build-time environment variables on the hosting provider. Apply the two SQL files above to the production Supabase project before enabling the public booking page.

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for the production checklist.
