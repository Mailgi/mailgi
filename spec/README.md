# API contract

`openapi.json` is the OpenAPI 3.0 description of the Mailgi REST API. Every SDK
in this repo targets **this file**, not a reading of the server source.

Captured from the live API:

```bash
curl -sL https://api.mailgi.xyz/openapi.json | python3 -m json.tool > spec/openapi.json
```

Interactive docs: https://api.mailgi.xyz/docs

## Keeping it current

Today this is a manual snapshot, so it can drift from the deployed API. The
intended end state is for the private `mailgi-platform` repo to export the spec
on deploy and commit it here, making drift a CI failure rather than a surprise.
Tracked in that repo's roadmap under *OpenAPI — publish spec to the public repo*.
