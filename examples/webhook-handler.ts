// A minimal webhook receiver that verifies the signature before acting.
//
//   MYTPE_WEBHOOK_SECRET=whsec_... npx tsx examples/webhook-handler.ts
//
// Point a MyTPE webhook at http://your-host:8080/mytpe/webhook. The raw body
// matters: read the bytes as they arrive and do not re-serialize them. No API
// key is needed here; verification only uses the webhook's signing secret.

import { createServer } from "node:http";
import { constructWebhookEvent } from "../src";

const secret = process.env.MYTPE_WEBHOOK_SECRET;
if (!secret) {
  console.error("Set MYTPE_WEBHOOK_SECRET to the secret the webhook was created with.");
  process.exit(1);
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/mytpe/webhook") {
    res.statusCode = 404;
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");

    try {
      const event = constructWebhookEvent(
        rawBody,
        req.headers["x-mytpe-signature"],
        secret,
      );

      if (event.event === "transaction.paid") {
        console.log(`Paid: ${event.data.amount} ${event.data.currency}`);
      }
      res.statusCode = 200;
      res.end("ok");
    } catch {
      // The signature did not verify. Reject and do not act on the payload.
      res.statusCode = 400;
      res.end("bad signature");
    }
  });
});

server.listen(8080, () => console.log("Listening on http://localhost:8080"));
