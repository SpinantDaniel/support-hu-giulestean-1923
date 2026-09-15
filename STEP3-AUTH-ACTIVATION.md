# Step 3 — Auth activation gate (v5.26)

This file documents the production-only activation sequence for verified email signup,
Cloudflare Turnstile and Resend SMTP. Never commit API keys, SMTP passwords or
Turnstile secret keys to this public repository.

## State before activation

- Production remains on `main`.
- Preview branch: `v5.26-release-hardening`.
- Preview uses Cloudflare's official always-pass testing sitekey.
- `auth-config.js` intentionally has no sitekey on hubgiulestean.ro until the real
  production sitekey is committed.
- The legacy `register-user` Edge Function remains active only because the current
  production frontend still calls it. The v5.26 branch does not call it.
- Database migration `v5_26_verified_signup_metadata` is live and backward-compatible.

## External credentials — do not commit

### Resend
Use a verified sender/domain dedicated to authentication where possible.

Supabase custom SMTP values:
- Host: `smtp.resend.com`
- Port: `465` (SMTPS) or `587` (STARTTLS)
- Username: `resend`
- Password: Resend API key with sending-only permission
- Sender name: `HUB Giulestean`
- Sender address: a verified address/domain, e.g. `no-reply@auth.hubgiulestean.ro`

### Cloudflare Turnstile
Create a managed Turnstile widget for:
- `hubgiulestean.ro`
- `www.hubgiulestean.ro`
- the Vercel preview branch alias during acceptance testing, if Cloudflare requires it.

Keep the Turnstile secret only in Supabase Auth configuration.
Only the public sitekey belongs in `auth-config.js`.

## Supabase Auth production configuration

1. Authentication → URL Configuration
   - Site URL: `https://hubgiulestean.ro`
   - Redirect URLs:
     - `https://hubgiulestean.ro/**`
     - `https://www.hubgiulestean.ro/**`
     - the current protected Preview branch URL/alias for acceptance testing.

2. Authentication → Sign In / Providers → Email
   - Email/password enabled.
   - Confirm email enabled (`mailer_autoconfirm = false`).

3. Authentication → Emails → SMTP Settings
   - Enable custom SMTP.
   - Enter the Resend SMTP values above.
   - Never paste the API key into source code.

4. Authentication → Email Templates
   - Confirmation must use the standard confirmation URL/link.
   - Recovery must use the standard recovery URL/link.
   - The v5.26 frontend expects a recovery link and the `PASSWORD_RECOVERY` event,
     not a numeric recovery OTP.

5. Authentication → Bot and Abuse Protection
   - Provider: Cloudflare Turnstile.
   - Enter the production Turnstile secret key.
   - Enable CAPTCHA protection only after the production frontend contains the real
     Turnstile sitekey and the acceptance tests have passed.

## Cutover order

1. Verify Resend domain and SMTP delivery.
2. Configure Supabase URL settings, email confirmation, SMTP and email templates.
3. Create/configure the real Turnstile widget.
4. Replace the production-empty sitekey in `auth-config.js` with the real public sitekey.
5. Test signup, confirmation and recovery on Preview.
6. Merge/deploy v5.26 frontend to production.
7. Enable Supabase Turnstile protection.
8. Verify production login/signup/recovery.
9. Retire the legacy public `register-user` Edge Function so it can no longer bypass
   verified signup.

Do not enable global CAPTCHA before the new frontend is live: the v5.25 production
frontend does not submit a CAPTCHA token and login/signup/recovery would fail.

## Acceptance tests

### Signup
- Complete Turnstile.
- Create a new disposable test account.
- Confirm that no authenticated session exists before email verification.
- Confirm `auth.users.email_confirmed_at` is null before clicking the email.
- Confirm the corresponding profile has server-side legal acceptance timestamps/version.
- Click the confirmation email.
- Confirm the email becomes verified and the account can authenticate.

### CAPTCHA
- A login/signup/recovery call with no valid Turnstile token must fail after protection is enabled.
- The same operation with a valid token must succeed.

### Recovery
- Request password reset.
- Open the recovery link.
- The new-password modal must open.
- Change the password.
- The recovery session must be logged out globally after the change.
- Old password must fail; new password must succeed.

### Regression
- Existing confirmed users can still log in after completing Turnstile.
- Existing marketplace, avatar and blog image flows remain functional.
- Production data counts and Auth/Profile integrity remain valid.
