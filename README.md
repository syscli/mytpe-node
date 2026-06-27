# mytpe

A typed client for the [MyTPE Pay](https://mytpe.app) API. It covers what an
Algerian payment integration needs: virtual terminals, payment links, checkout
forms, and the webhooks that tell you when a card payment goes through.

It is meant for servers. Your API key and secret authorize money movement, so
they must never reach the browser.

Published as `@syscli/mytpe`. It needs Node 18 or newer, uses the global `fetch`,
and ships no runtime dependencies.

## Install

```sh
npm install @syscli/mytpe
```

This is an early scaffold. The client surface lands over the next releases. See
[CHANGELOG](./CHANGELOG.md).

## License

MIT. See [LICENSE](./LICENSE).
