# mytpe

A typed client for the [MyTPE Pay](https://mytpe.app) API. It covers what an
Algerian payment integration needs end to end: the KYC onboarding chain, the
virtual terminals that accept cards, payment links and checkout forms, and the
webhooks that tell you when a payment lands.

Two things make it pleasant to live with. Webhook signatures are verified for
you, in constant time, with the replay window enforced, so you can trust an event
before you act on it. And the file uploads that onboarding needs are handled from
a path, a Buffer, or a Blob, without you assembling multipart bodies by hand.

It is meant for servers. The key and secret authorize money movement and must
never reach the browser.

Published as `@syscli/mytpe`. It needs Node 18 or newer, uses the global `fetch`,
and ships no runtime dependencies.

## Install

```sh
npm install @syscli/mytpe
```

## Quick start

```ts
import { Mytpe } from "@syscli/mytpe";

const mytpe = new Mytpe({
  key: process.env.MYTPE_API_KEY!,
  secret: process.env.MYTPE_API_SECRET!,
});

const me = await mytpe.me();
console.log(me.onboarding_status); // e.g. "kyc_approved"

const link = await mytpe.links.create({
  payment_instance_id: instanceId,
  title: "Commande 1043",
  amount_mode: "fixed",
  amount: 4500,
  usage_mode: "one_shot",
});

console.log(link.slug, link.status); // share the link, watch the status
```

## Keys

Authenticate with the key and secret from your dashboard, under Settings,
Developers, API keys. They go over the wire as `X-Api-Key` and `X-Api-Secret`.
The secret is shown once, so store it server-side. A wrong pair returns a
`AuthError`.

## Onboarding, in order

A terminal cannot accept payments until its paperwork is in place. The chain is
identification, then brand and bank account, then the instance that ties them
together:

```ts
const id = await mytpe.identifications.create({
  name: "Boutique Batna",
  establishment_type_id: establishmentTypeId,
  authorization_type_id: authorizationTypeId,
  identification_file: await fileFromPath("./registre-commerce.pdf"),
});

const brand = await mytpe.brands.create({
  name: "Boutique Batna",
  identification_id: id.id,
  logo: await fileFromPath("./logo.png"),
  file: await fileFromPath("./enseigne.png"),
});

const bank = await mytpe.bankAccounts.create({
  account_number: "00799999000123456789", // 20-digit RIB
  identification_id: id.id,
});

// Request activation. This returns the licence-fee transaction to pay.
const activation = await mytpe.instances.requestActivation({
  title: "Caisse Batna",
  identification_id: id.id,
  brand_id: brand.id,
  bank_account_id: bank.id,
  payment_method: "online",
});

console.log(activation.form_url); // pay the licence fee here
```

Each piece carries its own review `status` (`pending`, `accepted`, `refused`),
and the instance carries an `acceptance_status` that reaches `ready` once the
licence is approved.

## File uploads

Anywhere a file is needed, pass a Blob, raw bytes with a name, or read it from
disk with `fileFromPath`. The client builds the multipart request:

```ts
import { fileFromPath } from "@syscli/mytpe";

await mytpe.identifications.create({
  name: "Boutique Batna",
  establishment_type_id,
  authorization_type_id,
  identification_file: await fileFromPath("./rc.pdf", "application/pdf"),
});
```

## Payment links

Create a link, then publish, pause, resume, and archive it. The conditional rules
are checked before the request leaves, so a fixed link with no amount, or a timed
link with no window, fails as a `ValidationError` rather than a 422:

```ts
const link = await mytpe.links.create({
  payment_instance_id,
  title: "Abonnement mensuel",
  amount_mode: "open",
  min_amount: 1000,
  max_amount: 20000,
  usage_mode: "reusable",
  form_id, // optional checkout form
});

await mytpe.links.publish(link.id);
await mytpe.links.pause(link.id);
await mytpe.links.archive(link.id);
```

## Forms

Build a checkout form from sections and fields, then publish it so a link can use
it. Selection fields need options, which is checked for you:

```ts
const form = await mytpe.forms.create({ name: "Livraison" });
const section = await mytpe.forms.addSection(form.id, { title: "Adresse" });

await mytpe.forms.addField(form.id, {
  input_name: "wilaya",
  label: "Wilaya",
  data_type: "select",
  is_required: true,
  options: [
    { value: "05", label: "Batna" },
    { value: "16", label: "Alger" },
  ],
  form_section_id: section.id,
});

await mytpe.forms.publish(form.id);
```

## Webhooks

Create a subscription and store the `secret` it returns once. Then verify each
incoming request before you trust it. `constructEvent` checks the signature and
the timestamp and parses the body in one step:

```ts
const hook = await mytpe.webhooks.create({
  url: "https://shop.example.dz/mytpe/webhook",
  events: ["transaction.paid", "transaction.failed"],
});
// store hook.secret

// In your handler, pass the raw request body, exactly as it arrived:
app.post("/mytpe/webhook", (req, res) => {
  try {
    const event = mytpe.webhooks.constructEvent(
      req.rawBody,
      req.headers["x-mytpe-signature"],
      storedSecret,
    );
    if (event.event === "transaction.paid") fulfil(event.data);
    res.sendStatus(200);
  } catch {
    res.sendStatus(400); // bad signature, drop it
  }
});
```

Pass the body untouched. Re-serializing parsed JSON changes the bytes and the
signature will not match. `verify` returns a boolean if you would rather branch
yourself, and the same functions are exported standalone as
`constructWebhookEvent` and `verifyWebhookSignature` for handlers that do not
hold a client.

## Pagination

List endpoints return a `Page` with `data`, `links`, and `meta`. Step through it
with `next()`, or let an iterator walk every page:

```ts
const page = await mytpe.links.list({ status: "active", per_page: 50 });
console.log(page.data, page.meta.total, page.hasMore);

for await (const link of mytpe.links.paginate({ status: "active" })) {
  console.log(link.slug, link.total_collected);
}
```

## Errors

Every failure is a `MytpeError`, so you can catch one type and branch on it. A
422 is a `ValidationError` whose `fieldErrors` maps each field to its messages,
ready to show inline:

```ts
import { ValidationError, AuthError, NotFoundError } from "@syscli/mytpe";

try {
  await mytpe.links.create(input);
} catch (error) {
  if (error instanceof ValidationError) {
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      console.warn(field, messages.join(", "));
    }
  }
}
```

`AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404),
`ValidationError` (422 or client-side), `BusinessError`, and `ServiceError` (5xx)
all carry `status`, the API's `code`, and the parsed `body`.

## Limitations

- **Server only.** The key and secret authorize money movement. There is no
  browser build, on purpose.
- **Onboarding is sequential.** A brand and a bank account each need an
  identification, and an instance needs all three accepted, before it can take
  payments. The client will not skip steps the API enforces.
- **Money is decimal strings.** Amounts come back as strings like `"4500.00"` to
  avoid float rounding. Compare and total them as strings or with a decimal
  library, not as numbers.

## Development

```sh
npm install
npm test        # vitest
npm run build   # tsup, dual ESM and CJS plus types
```

A small set of live tests run against the real API when `MYTPE_API_KEY` and
`MYTPE_API_SECRET` are set, and are skipped otherwise.

## License

MIT. See [LICENSE](./LICENSE).
