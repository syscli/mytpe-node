// Create a fixed-amount payment link on an existing instance, publish it, and
// print the URL slug to share.
//
//   MYTPE_API_KEY=... MYTPE_API_SECRET=... MYTPE_INSTANCE_ID=... \
//     npx tsx examples/payment-link.ts

import { Mytpe, ValidationError } from "../src";

const mytpe = new Mytpe({
  key: process.env.MYTPE_API_KEY ?? "",
  secret: process.env.MYTPE_API_SECRET ?? "",
});

async function main() {
  const instanceId = process.env.MYTPE_INSTANCE_ID;
  if (!instanceId) {
    console.error("Set MYTPE_INSTANCE_ID to a ready payment instance.");
    return;
  }

  try {
    const link = await mytpe.links.create({
      payment_instance_id: instanceId,
      title: "Commande 1043",
      description: "Casque audio, livraison Batna",
      amount_mode: "fixed",
      amount: 4500,
      usage_mode: "one_shot",
    });

    const published = await mytpe.links.publish(link.id);
    console.log(`Link ${published.slug} is ${published.status}.`);
  } catch (error) {
    if (error instanceof ValidationError) {
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        console.error(`${field}: ${messages.join(", ")}`);
      }
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
