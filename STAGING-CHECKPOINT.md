# HUB Giulestean - Staging Checkpoint

Established: 2026-09-16

## Environments

Production:
- Git branch: `main`
- Vercel: production deployment / `hubgiulestean.ro`
- Supabase: `HubGiulestean`
- Supabase ref: `bhqpixyiojthpfqnyhsh`
- Cloudflare Turnstile: ENABLED

Staging / Test:
- Git branch: `staging`
- Vercel: branch Preview deployment
- Supabase: `HubGiulestean-Test`
- Supabase ref: `llgzzqgdhpibsgnpnsnf`
- Cloudflare Turnstile: DISABLED / not loaded
- No Vercel Preview hostname is added to the Cloudflare Turnstile widget.

## Release rule

All changes follow this path:

1. Implement on a feature branch or directly against the staging workflow.
2. Deploy to Vercel Preview / staging.
3. Use Supabase Test only.
4. Run functional and regression tests.
5. Mark the change PASS.
6. Only after explicit production authorization, promote the tested commit to `main`.
7. Verify Vercel production and production Supabase after cutover.

No untested change is promoted directly to production.

## Data rule

The staging project uses the production schema/security model but does not contain copied production user data.

The reproducible staging baseline is:
`supabase/staging/20260916_hubgiulestean_test_baseline.sql`

Do not apply that baseline to the production Supabase project.

Staging branch initialized on 2026-09-16.

Rollback note 2026-09-16: reverted the newsletter header experiment. Active staging UI keeps only the validated mobile logo dropdown on the marketplace homepage.
