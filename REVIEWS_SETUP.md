# Anonymous Reviews Setup

This page is a static client. Reviews and ratings require the Supabase project configured for the feature; they are not stored in the browser or in the repository.

## Project and client configuration

- Supabase project reference: `jwjedzfibiaxrpteprfu`.
- Dashboard: `https://supabase.com/dashboard/project/jwjedzfibiaxrpteprfu?showConnect=true`.
- The dashboard URL is for administration, not the API. The API URL must be copied from the project **Connect** dialog (normally the project API endpoint) and supplied separately to the client.
- Keep the client values in `js/supabase-config.js` (the expected configuration module). Its public exports are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `REVIEWS_TABLE`, `REVIEWS_MAX_COMMENT_LENGTH`, `REVIEWS_COOLDOWN_MS`, and a CAPTCHA configuration object. Set the URL/key/table and client limits for the deployment; CAPTCHA `siteKey` and `verify` values are placeholders until a provider is configured.
- The module should contain only the project URL, publishable/anonymous client key, and non-secret client settings. Do not put a service-role key, database password, CAPTCHA secret, or any other secret in this repository or browser code.
- If the publishable key is replaced or rotated, update the deployment's configuration module/environment at the same time, deploy it, and revoke the old key when no longer needed. Never commit the replacement secret or a service-role key.

## Migration

From the nested Git repository root (`Aumazing-Front-Page/`), with the Supabase CLI installed:

```sh
cd Aumazing-Front-Page
supabase init
supabase login
supabase link --project-ref jwjedzfibiaxrpteprfu
supabase db push
```

Run `supabase init` only when `supabase/config.toml` is absent. It creates the local CLI configuration while preserving the existing `supabase/migrations/20260901183552_create_reviews.sql` file. `supabase link` and `supabase db push` require the logged-in Supabase account to be a member of project `jwjedzfibiaxrpteprfu` with sufficient database/migration privileges. Your current `supabase link` output shows that this account is authenticated but does not have the required project access; ask the project owner to add this account to the project or run the migration themselves.

The migration creates `public.reviews` with `id`, `reviewer_id`, `display_name`, `rating`, `comment`, `status` (`pending`/`approved`/`rejected`), `created_at`, and `approved_at`, plus the RLS policies and grants described below. `supabase status` is only for the local Supabase stack and requires Docker Desktop with the Linux engine running; Docker is not required for an authorized remote `db push`.

### SQL Editor alternative

If the CLI account cannot access the project, an authorized project owner can open the supplied Dashboard URL, go to **SQL Editor > New query**, paste the complete contents of `supabase/migrations/20260901183552_create_reviews.sql`, and run it. Confirm `public.reviews`, its RLS policies, and grants in **Table Editor** or the Dashboard. This direct SQL route applies the schema but may not create the CLI migration-history record; reconcile migration history before using `supabase db push` later.

Applying a migration to the remote project has not been verified by this document; do not describe it as applied unless an authorized operator checks the Dashboard/Migrations history or runs an authorized query. Review the migration's exact table, column, policy, and grant names before running it. For a local rehearsal, use the local Supabase stack and `supabase db reset` after Docker Desktop is running.

## Anonymous Auth

In Dashboard > **Authentication > Providers**, enable the **Anonymous** provider. The browser signs in anonymously to obtain a per-browser Auth identity; this is not proof of a person's identity and can be lost when browser storage is cleared. Confirm the client handles an existing anonymous session and sign-in errors. If the provider is disabled, inserts should fail rather than silently becoming public unauthenticated writes.

## CAPTCHA and abuse controls

The feature supports CAPTCHA as a deployment option, but this repository does not contain a CAPTCHA site key or secret. Add the public site key through deployment configuration, for example `CAPTCHA_SITE_KEY` in `js/supabase-config.js`, and keep `CAPTCHA_SECRET_KEY` only in Supabase Auth settings or a trusted server/Edge Function. The review client verifies CAPTCHA before creating an anonymous session and passes the token to Supabase Auth as `signInAnonymously({ options: { captchaToken } })`; existing sessions are reused without a new sign-in. Configure the chosen provider and allowed site origins in its dashboard, then configure the matching Supabase Auth CAPTCHA setting if anonymous sign-in is protected. Never expose the secret key. CAPTCHA alone is not moderation or authorization.

The client may apply cooldowns, duplicate detection, and a per-browser submission limit to reduce casual spam. These are bypassable client-side controls, not a security boundary. Enforce authorization and row visibility with Supabase Auth, RLS, and grants; add a trusted rate-limit/verification service if stronger abuse resistance is required.

## Moderation and visibility

A moderator reviews rows in the Supabase Table Editor or an authorized moderation tool and changes `status` from `pending` to `approved` or `rejected`. A database trigger sets `approved_at` to `now()` when status becomes `approved` and clears it for `pending` or `rejected`; do not rely on a client-supplied timestamp. Only rows with `status = 'approved'` are public. Pending and rejected rows must not appear in public review lists, public rating averages, or public counts. A moderator can revoke approval by changing status back to `pending` or `rejected`, which clears `approved_at`.

The public client must render review text as text (`textContent` or an equivalent safe renderer), never concatenate user text into `innerHTML` or inject it as HTML. Do not trust display names, comments, or any other submitted field.

## Switching projects

Changing the URL and publishable key points the client at another Supabase project; it does not transfer the schema, migrations, Auth users/anonymous identities, Edge Functions, secrets, storage, or data. Apply the migration separately to the destination, configure Auth/CAPTCHA/functions/secrets there, and migrate data only through an intentional, authorized process. The destination's publishable key must be obtained from that project's Connect settings.

## Focused verification checklist

Run these checks against a local project first, then repeat against the authorized remote project. Record the project reference and migration revision used; do not claim live verification without authorization and observed results.

1. **RLS and grants:** with the publishable client key, an anonymous Auth session can insert only its own permitted `public.reviews` fields (`reviewer_id`, `display_name`, `rating`, and `comment`); it cannot update, delete, or read arbitrary rows. An unauthenticated request cannot insert. Public `SELECT` is limited to `status = 'approved'`; there are no public update/delete grants or policies. A moderator/service-role path can review and set `status` outside these public grants. Verify the table is not accidentally exposed through broad table grants or an `USING (true)` policy on pending/rejected rows.
2. **Approved-only reads:** public list queries return approved rows only. Public average/count calculations include approved rows only; inserting a pending row must not change those stats.
3. **Moderation transitions:** a pending row is invisible publicly, becomes visible and changes stats only after approval with non-null `approved_at`, and disappears from public reads/stats after rejection or approval revocation. A rejected row remains invisible.
4. **Malicious text:** submit strings containing HTML and script-looking text, then inspect the rendered page and DOM. The characters must display as text; no element or script may be created from the submission.
5. **Anonymous identity and abuse:** verify anonymous sign-in is required, refresh preserves the intended session behavior, and the cooldown/duplicate/per-browser limit rejects repeated casual submissions without being treated as authorization.
6. **CAPTCHA configuration:** verify the configured site key/origins and Auth CAPTCHA setting with a non-secret test configuration; confirm the secret is present only in the trusted dashboard/function configuration and absent from client bundles.
