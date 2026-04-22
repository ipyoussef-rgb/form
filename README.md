# KOBIL OIDC + Fax Monorepo (Vercel-ready MVP)

Monorepo with two Next.js (App Router) apps:

- `apps/app1`: German Vollmacht form, OIDC auto-login, profile prefill, PDF creation, handoff to App2.
- `apps/app2`: Chat-style UI, receives document attachment, payment flow, fax sending.

## Stack

- Next.js 15+, App Router, TypeScript strict
- Tailwind CSS
- Zod validation
- React Hook Form for the editable App1 form
- `pdf-lib` for selectable text PDF generation
- Vercel-compatible route handlers (no custom Node server)

## Monorepo structure

- `apps/app1`
- `apps/app2`
- `packages/config` – environment schema
- `packages/shared` – DTOs/schemas/repositories/logging
- `packages/kobil` – Identity/Chat/Pay integrations
- `packages/pdf` – Vollmacht PDF generation
- `packages/fax` – Telnyx Fax integration

## Setup

1. Copy `.env.example` to `.env` and fill secrets.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run both apps:
   ```bash
   npm run dev
   ```
4. Open:
   - App1: `http://localhost:3001`
   - App2: `http://localhost:3002`

## Required env vars

Use exact names from `.env.example`:

- Shared KOBIL: `KOBIL_TENANT_NAME`, `KOBIL_IDP_WELL_KNOWN`, `KOBIL_PAY_BASE_URL`, `KOBIL_PAYMENT_MERCHANT_NAME`, `KOBIL_CHAT_BASE_URL`
- App1 credentials/base URL
- App2 credentials/base URL
- Inter-app secret
- `AUTH_SECRET`
- Telnyx keys and webhook verification values (`TELNYX_WEBHOOK_PUBLIC_KEY` preferred for v2)

## Provider mapping (docs vs code)

- **KOBIL Identity**: Uses OIDC discovery, auth-code + PKCE, token exchange, ID token nonce/signature/issuer/audience validation and userinfo fetch.
- **KOBIL Chat**: Ingest route sends message to KOBIL Chat API endpoint (`/mpower/v1/users/{userId}/message`) with server-side bearer token, while still storing local chat history for UI rendering.
- **KOBIL Pay**: Creates transactions against `.../mpay-merchant/create/transaction`, consumes merchant callback at `/api/pay/callback`, and can query status via `.../mpay-merchant/create/transaction/status`.
- **Telnyx Fax**: Sends via `POST https://api.telnyx.com/v2/faxes` with `media_url`, `connection_id`, `to`, `from`, `client_state`, and webhook URL; webhook verification uses Ed25519 signature (`telnyx-signature-ed25519` + `telnyx-timestamp`).

## Core flow

1. User opens App1, middleware enforces auth cookie and redirects to `/login`.
2. `/login` builds OIDC authorize URL from discovery (`KOBIL_IDP_WELL_KNOWN`) with PKCE + nonce.
3. Callback exchanges code server-side, validates ID token, stores signed session cookie, fetches userinfo.
4. App1 form is prefilled from claims: `given_name`, `family_name`, `birthdate`, `address`.
5. User edits and submits form -> Zod validation -> PDF generation (`Vollmacht` metadata, `de-DE`, selectable text).
6. PDF is stored in demo in-memory store + metadata repository.
7. App1 sends metadata to App2 ingest endpoint using shared secret.
8. App2 stores chat attachment locally and forwards message to KOBIL Chat API.
9. App2 starts KOBIL Pay transaction and opens checkout URL.
10. KOBIL Pay callback updates local payment state; optional status polling route reconciles transaction state.
11. App2 sends fax via Telnyx only after confirmed payment status.
12. Telnyx webhook updates fax status.

## Security notes

- Secrets are server-side only.
- OIDC token exchange and validation are server-side.
- Telnyx webhook signature validation includes timestamp tolerance.
- DTOs are validated with Zod.
- Structured logging removes token/secret values.
- Demo in-memory repositories are pluggable and should be replaced by persistent storage (e.g. Redis/Postgres) for production.

## Assumptions

- KOBIL tenant-specific payload fields may differ slightly; merchant IDs can be passed via optional env vars.
- KOBIL Chat message payload can vary by installed service template; this MVP sends a standards-compatible text payload with document metadata.
- Telnyx webhook public key should be configured in PEM form for Ed25519 verification.
