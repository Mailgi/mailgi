# mailgi (Python) — planned

Python client for the Mailgi API, to be published to PyPI as `mailgi`, with the
same surface as the TypeScript SDK in `../typescript`.

Not yet implemented. This directory reserves the slot and the layout.

## Notes for whoever picks this up

- The contract is [`spec/openapi.json`](../../spec/openapi.json). Strongly
  consider **generating** the client from it rather than hand-writing one — a
  second hand-written SDK doubles the surface that can drift from the API.
- The npm workspaces list in the root `package.json` is explicit rather than a
  `packages/*` glob, precisely so this directory doesn't need a `package.json`.
  Adding Python tooling here has no effect on the Node build.
- Release tags are namespaced by package (`py-sdk-v0.1.0`), since the two SDKs
  version independently.
