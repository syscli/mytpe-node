# Changelog

## [0.2.0] - 2026-10-10

### Fixed

- The API key and secret no longer show up when the client is logged with
  `console.log`, `util.inspect`, or `JSON.stringify`.
- Multipart updates (identifications, brands, instances) go as POST with a
  `_method=PUT` field, since PHP does not parse a multipart body on PUT.
- The request timeout now covers reading the response body.
- A 400 or 409 raises `BusinessError`, as documented; other 4xx raise
  `RequestError`.
- A caller abort raises `AbortError` and a timeout raises `TimeoutError`, both
  `MytpeError`s with the original error as `cause`.
- The abort listener is removed from the caller's signal once a request ends.
- An empty, `.`, or `..` id is rejected before a request is built.
- `regenerateSecret` throws when the API returns no secret instead of returning
  an empty string.
- Client-side validation errors use the `VALIDATION_ERROR` code, like the API.
- Webhook verification accepts any of several `v1` hashes in one header and
  refuses an empty secret.
- The webhook example no longer needs an API key to start.

### Changed

- Reads are retried on a 429 as well, honour `Retry-After` up to 60 seconds,
  and back off with jitter. The wait between attempts stops when the caller
  aborts.
- `list`, `paginate`, and `webhooks.deliveries` accept an `AbortSignal`, which
  later pages reuse.
- `forms.updateSection` and `forms.updateField` take partial input.
- Webhook verification takes the header as Node provides it: a string, an
  array, or undefined.
- `VERSION` is read from package.json at build time, and requests carry a
  `User-Agent` of `mytpe-node/<version>`.
- `npm run typecheck` also checks the tests and examples, and CI smoke tests
  the packed tarball under CommonJS and ESM.

## [0.1.0] - 2026-06-27

First release. A typed client for the MyTPE Pay API, server-side, with no runtime
dependencies.

- `Mytpe` client with resources for the account, KYC (identifications, brands,
  bank accounts), payment instances, payment links, forms, and webhooks.
- Webhook signature verification: `webhooks.constructEvent` and `verify`, plus
  the standalone `constructWebhookEvent` and `verifyWebhookSignature`, with
  constant-time comparison and a timestamp tolerance.
- File uploads from a path, raw bytes, or a Blob, with `fileFromPath` and automatic
  multipart bodies for the KYC and instance endpoints.
- Client-side checks: the payment link conditional rules, a 20-digit RIB, and the
  options a selection field needs, all raised as a `ValidationError` before a
  request leaves.
- Paginated lists with a `Page` object and an async iterator over every page.
- Error hierarchy mapped from the API, including the 422 field map, and read-only
  retry on 5xx and network failures.
