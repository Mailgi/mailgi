# Changelog — `@mailgi/mailgi`

Release tags are `ts-sdk-vX.Y.Z`. Entries before 0.2.0 live in the git history.

## Unreleased

Free tier (API live since 2026-11-04): until a wallet's first top-up, sends
are free to up to 50 never-seen recipients per UTC day, with a "Sent by
mailgi.xyz" footer.

- `BillingNotice.status` adds `'unfunded'` (sends only; message "Fund this
  mailbox to remove ads.", with `topupPage`).
- `PaymentRequiredDetails.reason` adds `'free_tier_limit'`, with
  `newRecipientsPerDay` and `newRecipientsUsedToday`.
- `PaymentRequiredError.freeTierLimit` getter.
- `BillingInfo.freeTier` (`FreeTier`: `active`, `newRecipientsPerDay`,
  `newRecipientsUsedToday`); `FreeTier` is exported.
- CLI: `mailgi billing` prints the free-tier count while it is active.
- `spec/openapi.json` re-captured from the live API.
