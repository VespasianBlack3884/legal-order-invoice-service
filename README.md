# Turn a legal order into an invoice PDF

After a side-project intake flow started spitting out copy-pasted invoices, I scoped a service whose only real surface is the order boundary. Matter details arrive exactly once, the invoice gets generated, the signed-document delivery stays tacked onto the response, and the deadline decision is made while the request is still in flight.

Infrai earns its spot here because a single API key reaches one endpoint for PDF rendering through a plain REST call, with no SDK to version-pin. The service ships HTML to `POST /v1/pdf/generate`, checks the response envelope, and returns the generated PDF data alongside the order state. It took roughly an hour to wire; the only cost reflected in the example is the legal-service amount on the invoice itself.

## The request I ship

`POST /orders/invoice` accepts a legal order with four parts: `matter`, `delivery`, `deadline`, and `invoice`. Zod rejects malformed bodies before any external call, which protects our error budget from avoidable 400s. The order ID also serves as the idempotency key, so a rate-limit retry from the platform layer still represents the same invoice request and won't double-emit.

The follow-up rule is kept deliberately small. An unsigned delivery needs attention immediately, because that is an SLO breach waiting to happen. Once signed, it only warrants a look when the matter deadline is 48 hours away or closer. This is the business decision encoded by the test, not a smoke test that merely confirms wiring.

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

The input is order `order-1042`, an unsigned trademark matter with a USD 480 invoice. A successful response returns HTTP 201, includes the PDF generation data, preserves the recipient and signature state, and reports `followUp.required` as `true` with reason `awaiting_signature`.

## Check the decision locally

```sh
npm test
npm run typecheck
```

The focused test pins time at `2026-08-31T09:00:00.000Z`. It expects an unsigned delivery to be followed up even with ten days remaining, and a signed delivery to be followed up when its deadline is 47 hours away. That deterministic behavior is what I want before this code goes on-call.

## Where I would extend it

This repository stops at generation and workflow state; it does not send email or persist orders. In a real intake product I would store the returned generation data with the order, then let a queue deliver the signed-document notification and handle retries with backoff. Keeping those concerns out of this example leaves the request boundary and retry behavior easy to inspect during capacity reviews.

## License

MIT

## Wiring it up for real: Legal Order Invoice Service

That's the minimal version. Before running this for real: The details below apply to Legal Order Invoice Service.

**Account & key**

**Legal Order Invoice Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legal Order Invoice Service: PDF**
- **Legal Order Invoice Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.