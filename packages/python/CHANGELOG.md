# Changelog — `mailgi` (Python)

Release tags are `py-sdk-vX.Y.Z`. Entries before 0.1.0 live in the git history.

## 0.2.0 — 2026-11-04

Free tier (API live since 2026-11-04): until a wallet's first top-up, sends
are free to up to 50 never-seen recipients per UTC day, with Mailgi branding
on sent mail.

- `BillingNotice["status"]` adds `"unfunded"` (sends only; message "Fund this
  mailbox to remove ads.", with `topupPage`).
- `PaymentRequiredDetails["reason"]` adds `"free_tier_limit"`, with
  `newRecipientsPerDay` and `newRecipientsUsedToday`.
- `PaymentRequiredError.free_tier_limit` property.
- `BillingInfo["freeTier"]` (`FreeTier`: `active`, `newRecipientsPerDay`,
  `newRecipientsUsedToday`); `FreeTier` is exported.
