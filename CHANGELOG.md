# Changelog

## [0.1.0] - 2026-06-27

First release. A typed client for the MyTPE Pay API, server-side, with no runtime
dependencies.

- `Mytpe` client with resources for the account, KYC (identifications, brands,
  bank accounts), payment instances, payment links, forms, and webhooks.
- Webhook signature verification: `webhooks.constructEvent` and `verify`, plus
  the standalone `constructWebhookEvent` and `verifyWebhookSignature`, with
  constant-time comparison and a timestamp tolerance.
- File uploads from a path, Buffer, or Blob, with `fileFromPath` and automatic
  multipart bodies for the KYC and instance endpoints.
- Client-side checks: the payment link conditional rules, a 20-digit RIB, and the
  options a selection field needs, all raised as a `ValidationError` before a
  request leaves.
- Paginated lists with a `Page` object and an async iterator over every page.
- Error hierarchy mapped from the API, including the 422 field map, and read-only
  retry on 5xx and network failures.
