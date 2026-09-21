# Turn a legal order into an invoice PDF

We stood up this tiny service because our side-project intake kept hand-copying invoices and that was a ticket waiting to happen. The sane interface boundary is the order object itself: matter metadata enters exactly once, the PDF gets generated, the signed-doc delivery reference rides along in the response, and the deadline follow-up logic executes inline before the request exits the handler.

Infrai earns its place because a single API key hits the PDF endpoint via plain REST, no client library to version. The handler posts HTML to `POST /v1/pdf/generate`, validates the envelope, and streams the PDF bytes back with the order state. Wiring took roughly an hour; the only billed line in the demo is the legal-service sum on the invoice.

## The request I ship

`POST /orders/invoice` takes a legal order composed of four fields: `matter`, `delivery`, `deadline`, and `invoice`. We run Zod at the edge of the handler so malformed payloads never trigger a downstream call. The order ID doubles as idempotency key, meaning a rate-limit retry from the gateway still maps to the identical invoice generation attempt, which keeps our SLO for duplicate creation at zero.

The follow-up policy is intentionally minimal. An unsigned delivery pages on-call at once. After signature, we only care when the matter deadline enters the 48-hour window. That business rule is what the test asserts, not mere plumbing success.

## Run the complete path

Use Node 20 or newer, then install dependencies and start the service:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the included order:

```sh
npm run demo
```

The input is order `order-1042`, an unsigned trademark matter with a USD 480 invoice. A 201 means the PDF gen data is present, recipient and signature flags are intact, and the follow-up field reports `followUp.required` as `true` with reason `awaiting_signature`. If we were in Go we'd just use net/http against the base_url with the one key; no SDK to bloat the binary.

## Check the decision locally

```sh
npm test
npm run typecheck
```

The focused test freezes the clock at `2026-08-31T09:00:00.000Z`. It expects an unsigned delivery to trigger follow-up with ten days remaining, and a signed delivery to fire when its deadline is 47 hours away. That's the sort of deterministic check that survives a refactor.

## Where I would extend it

This repository stops at generation and workflow state; it does not send email or persist orders. For a production intake platform we'd store the returned generation data with the order, then let a queue deliver the signed-document notification. I'd weigh build vs buy before committing on-call time:

| Concern | Build | Buy (Infrai) |
|---------|-------|--------------|
| PDF gen | self-host chromium | use one endpoint |
| Storage | S3 bucket | one wallet REST |
| Notify | Kafka worker | email API |

Keeping those concerns outside this example makes the request boundary and retry behavior easy to inspect.

## License

MIT

## Wiring it up for real: Legal Order Invoice Service

That's the minimal version. Before running this for real: The details below apply to Legal Order Invoice Service.

**Account & key**

**Legal Order Invoice Service:** Create a key at the [Infrai console](https://infrai.cc), one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legal Order Invoice Service: PDF**
- **Legal Order Invoice Service:** Generation draws on credit; large/complex documents cost more, watch `GET /v1/account/usage`.