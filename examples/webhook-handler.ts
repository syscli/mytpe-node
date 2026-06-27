// A minimal webhook receiver that verifies the signature before acting.
//
//   MYTPE_WEBHOOK_SECRET=whsec_... npx tsx examples/webhook-handler.ts
//
// Point a MyTPE webhook at http://your-host:8080/mytpe/webhook. The raw body
// matters: read the bytes as they arrive and do not re-serialize them.

import { createServer } from "node:http";
import { Mytpe } from "../src";

const secret = process.env.MYTPE_WEBHOOK_SECRET ?? "";
const mytpe = new Mytpe({
  key: process.env.MYTPE_API_KEY ?? "",
  secret: process.env.MYTPE_API_SECRET ?? "",
});

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
    const signature = req.headers["x-mytpe-signature"];

    try {
      const event = mytpe.webhooks.constructEvent(
        rawBody,
        Array.isArray(signature) ? signature[0]! : signature ?? "",
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
