# Deploying the dashboard

Live at **https://app.mailgi.xyz** (pending DNS — see below), also reachable
at the Railway-assigned `mailgi-dashboard-production.up.railway.app`.

## Where it runs

Railway service `mailgi-dashboard` in the `Mailgi` project, alongside
`agentmailbox-api` and `Redis`. Built from `apps/ui/Dockerfile.prod`, whose
build context is the **repo root** (`railway.json` points at it) — needed so
npm workspaces can resolve `@mailgi/mailgi` during the build.

The image runs `vite build` then serves the static `dist/` output with
`serve`. No SPA routing config: this app has no client-side router, so every
real request is for `/` or a static asset.

## Required DNS — one CNAME, not yet added

`app.mailgi.xyz` is registered on the Railway service but **not yet
verified**, because the DNS record does not exist yet:

| Type | Name | Value |
|---|---|---|
| CNAME | `app` | `looc7srk.up.railway.app` |

Until this is published, `https://app.mailgi.xyz` will not resolve. The
Railway-assigned URL works today without it.

## Why the custom domain isn't optional — the cookie design depends on it

The session cookie is `SameSite=Lax` (see `mailgi-platform`'s
`plugins/session.ts`), which browsers do **not** attach to cross-site
`fetch()` calls — only to top-level navigations. The dashboard
(`dashboardClient.ts`) talks to the API entirely via `fetch(..., {credentials:
"include"})`, which is exactly the case Lax cookies don't cover across sites.

`app.mailgi.xyz` and `api.mailgi.xyz` are siblings under one registrable
domain (`mailgi.xyz`) — same-site, so Lax cookies work normally.
`mailgi-dashboard-production.up.railway.app` and `api.mailgi.xyz` are
different sites entirely — the cookie would never be sent, and login would
appear to loop back to the Login screen forever with no visible error.

**So: until the CNAME above is published, sign-in on the Railway URL will not
actually work**, even once OAuth providers are configured. This is not yet
possible to test end-to-end for that reason — tracked as an open item
alongside OAuth app registration.

## Build-time vs runtime configuration

`VITE_API_BASE_URL` is a **build-time** value — Vite inlines it into the JS
bundle, so changing it requires a rebuild (`railway redeploy` after updating
the variable), not just a restart.

## Corresponding platform-API variables (already set)

| Variable | Value |
|---|---|
| `DASHBOARD_URL` | `https://app.mailgi.xyz` |
| `PUBLIC_API_URL` | `https://api.mailgi.xyz` |
| `SESSION_COOKIE_DOMAIN` | `.mailgi.xyz` |

These control the OAuth `redirect_uri`, the CORS credentialed-origin
allowlist, and the cookie's `Domain` attribute respectively. All three were
unset in production before this deploy (silently defaulting to `localhost`),
so OAuth login and dashboard CORS were broken regardless of hosting.
