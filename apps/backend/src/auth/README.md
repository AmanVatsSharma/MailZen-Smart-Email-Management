# Backend Auth (JWT + OAuth + Alias Onboarding)

MailZen backend auth is implemented with JWT access tokens, refresh sessions, and Google OAuth.
Web sessions are persisted with an HttpOnly `token` cookie.

## Core components

- `apps/backend/src/auth/auth.service.ts` (token issue/verify, refresh, OTP, verification tokens)
- `apps/backend/src/auth/session-cookie.service.ts` (central cookie set/clear)
- `apps/backend/src/auth/auth.resolver.ts` (GraphQL auth mutations + `authMe`)
- `apps/backend/src/auth/oauth.controller.ts` (Google login start/callback)
- `apps/backend/src/auth/guards/jwt-auth.guard.ts` and `apps/backend/src/auth/guards/admin.guard.ts`

## Environment requirements

- `JWT_SECRET` is mandatory and validated at bootstrap.
- Session cookie tuning:
  - `MAILZEN_SESSION_COOKIE_SAMESITE` (`lax|strict|none`, default `lax`)
  - `MAILZEN_SESSION_COOKIE_SECURE` (optional override; defaults to `true` in prod)
  - `MAILZEN_SESSION_COOKIE_DOMAIN` (optional; useful for shared parent domains)
  - `MAILZEN_SESSION_COOKIE_PATH` (default `/`)
- Google OAuth requires:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- Recommended:
  - `OAUTH_STATE_SECRET`
  - `GOOGLE_OAUTH_SCOPES` (defaults include identity + Gmail access for auto-connect)
  - SMS OTP delivery settings (used by signup phone verification):
    - `MAILZEN_SMS_PROVIDER` (`CONSOLE` | `WEBHOOK` | `TWILIO` | `DISABLED`)
    - `MAILZEN_SMS_FALLBACK_PROVIDER` (`CONSOLE` | `WEBHOOK` | `TWILIO`)
    - `MAILZEN_SMS_STRICT_DELIVERY`
    - `MAILZEN_SMS_WEBHOOK_URL`
    - `MAILZEN_SMS_WEBHOOK_TOKEN`
    - `MAILZEN_SMS_WEBHOOK_TIMEOUT_MS`
    - `MAILZEN_SMS_WEBHOOK_SIGNING_KEY`
    - `MAILZEN_SMS_TWILIO_ACCOUNT_SID`
    - `MAILZEN_SMS_TWILIO_AUTH_TOKEN`
    - `MAILZEN_SMS_TWILIO_FROM_NUMBER`
    - `MAILZEN_SMS_TWILIO_API_BASE_URL`
    - `MAILZEN_SMS_TWILIO_TIMEOUT_MS`
    - `MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL`
  - CSRF origin protection for cookie-authenticated requests:
    - `GLOBAL_CSRF_PROTECTION_ENABLED` (default `true`)
    - `GLOBAL_CSRF_TRUSTED_ORIGINS` (default `FRONTEND_URL`)
    - `GLOBAL_CSRF_EXCLUDED_PATHS` (default empty)
    - `GLOBAL_CSRF_ENFORCED_METHODS` (default `POST,PUT,PATCH,DELETE`)

## Auth response contract

`AuthResponse` now includes onboarding metadata:

- `requiresAliasSetup`
- `hasMailzenAlias`
- `nextStep`

`authMe` returns current user + alias onboarding status, allowing frontend to gate dashboard access safely.

## Auth service structured observability

`AuthService` emits structured JSON logs for token/session and OTP lifecycles:

- refresh token lifecycle:
  - `auth_refresh_token_generate_start`
  - `auth_refresh_token_generate_completed`
  - `auth_refresh_token_rotate_start`
  - `auth_refresh_token_rotate_invalid_session`
  - `auth_refresh_token_rotate_user_missing`
  - `auth_refresh_token_rotate_old_session_revoked`
  - `auth_refresh_token_rotate_completed`
- logout lifecycle:
  - `auth_logout_start`
  - `auth_logout_session_missing`
  - `auth_logout_completed`
- verification token lifecycle:
  - `auth_verification_token_create_start`
  - `auth_verification_token_create_completed`
  - `auth_verification_token_consume_start`
  - `auth_verification_token_consume_invalid`
  - `auth_verification_token_consume_completed`
- signup OTP lifecycle:
  - `auth_signup_otp_create_start`
  - `auth_signup_otp_persisted`
  - `auth_signup_otp_delivery_completed`
  - `auth_signup_otp_delivery_failed`
  - `auth_signup_otp_verify_start`
  - `auth_signup_otp_verify_invalid_or_expired`
  - `auth_signup_otp_verify_code_mismatch`
  - `auth_signup_otp_verify_completed`

PII-sensitive identifiers such as phone numbers are logged as irreversible
fingerprints, not raw values.

## Google OAuth flow (hardened)

1. Frontend redirects to `GET /auth/google/start`.
2. Backend signs OAuth state and redirects to Google.
3. Callback validates state, exchanges code, verifies `id_token`, and upserts user.
4. Backend sets HttpOnly `token` cookie (no token in query string).
5. Backend auto-connects Gmail provider and triggers initial sync.
6. Backend checks alias onboarding state:
   - no alias -> redirect `/auth/alias-select`
   - alias exists -> redirect `/auth/oauth-success` (or signed redirect override)

## Alias onboarding enforcement

- New users and existing users without a mailbox receive `requiresAliasSetup=true`.
- Frontend must route these users to alias selection before dashboard.

## Changelog

- Added `authMe` query for authenticated onboarding readiness checks.
- Extended `AuthResponse` with alias onboarding fields.
- Moved guard source of truth into `auth/guards`.
- Hardened Google OAuth callback to cookie-based session delivery.
- Added Google OAuth auto-connect for Gmail provider plus initial sync trigger.
- Added backend tests for OAuth state validation, admin guard role checks, and mailbox alias validation.
- Added global CSRF origin protection middleware for cookie-authenticated
  state-changing requests.
- Hardened session cookie management with env-configurable SameSite/secure/domain/path options.
- Added structured auth lifecycle logs with phone-number fingerprinting for OTP flow.
