# SMS Dispatcher Utility

## Goal

Provide resilient OTP delivery with provider-level failover behavior and strict/non-strict delivery modes.

## Supported providers

- `CONSOLE` (default local-development logger provider)
- `WEBHOOK` (generic outbound HTTP webhook provider)
- `TWILIO` (direct Twilio REST API provider)
- `DISABLED` (explicit no-delivery mode)

## Environment variables

- `MAILZEN_SMS_PROVIDER` (`CONSOLE|WEBHOOK|TWILIO|DISABLED`)
- `MAILZEN_SMS_STRICT_DELIVERY`
  - production default: strict (`true`)
  - non-production default: non-strict (`false`)
- Webhook provider:
  - `MAILZEN_SMS_WEBHOOK_URL`
  - `MAILZEN_SMS_WEBHOOK_TOKEN` (optional bearer)
  - `MAILZEN_SMS_WEBHOOK_TIMEOUT_MS` (default `5000`)
  - `MAILZEN_SMS_WEBHOOK_SIGNING_KEY` (optional HMAC signing key)
- Twilio provider:
  - `MAILZEN_SMS_TWILIO_ACCOUNT_SID`
  - `MAILZEN_SMS_TWILIO_AUTH_TOKEN`
  - `MAILZEN_SMS_TWILIO_FROM_NUMBER`
  - `MAILZEN_SMS_TWILIO_API_BASE_URL` (default `https://api.twilio.com`)
  - `MAILZEN_SMS_TWILIO_TIMEOUT_MS` (default `5000`)
  - `MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL` (optional)

## Webhook signing contract

When `MAILZEN_SMS_WEBHOOK_SIGNING_KEY` is configured:

- Header `x-mailzen-sms-timestamp` is added with current epoch ms.
- Header `x-mailzen-sms-signature` is added with:
  - `hex(HMAC_SHA256(signingKey, "<timestamp>.<payloadJson>"))`

Payload JSON:

```json
{
  "phoneNumber": "+15550000000",
  "code": "123456",
  "purpose": "SIGNUP_OTP"
}
```

## Delivery flow

```mermaid
flowchart TD
  Service[Auth/Phone service] --> Dispatcher[dispatchSmsOtp]
  Dispatcher --> Provider{MAILZEN_SMS_PROVIDER}
  Provider -->|CONSOLE| Console[Log OTP]
  Provider -->|WEBHOOK| Webhook[POST webhook]
  Provider -->|TWILIO| Twilio[POST Twilio Messages API]
  Provider -->|DISABLED| Disabled[Return non-delivered]
  Webhook --> Strict{Strict delivery?}
  Twilio --> Strict
  Strict -->|yes + failure| Throw[Throw delivery error]
  Strict -->|no + failure| Warn[Warn and return failure result]
  Console --> Success[Delivered=true]
  Webhook --> Success
  Twilio --> Success
```

## Operational notes

- Strict mode should be enabled in production to prevent unverifiable OTP issuance.
- Non-strict mode is useful for local/dev/staging bring-up when SMS infrastructure is not yet available.
- Webhook integrations should verify signing headers before accepting OTP dispatch payloads.
