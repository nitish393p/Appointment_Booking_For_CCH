# Deploy

1. Configure the production Supabase project by following [README.md](./README.md), including both SQL scripts, the first Director profile, and the `admin-create-user` Edge Function.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as hosting build environment variables. Do not enter a Supabase secret or `service_role` key.
3. Run:

   ```sh
   npm ci
   npm test
   npm run build
   ```

4. Deploy the generated `dist` directory with the included Vercel or Netlify SPA configuration.
5. Complete [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md), including an end-to-end booking against the live database.
