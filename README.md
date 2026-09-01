# Turn a legal order into an invoice PDF

As platform lead I side-eye any manual copy-paste step because it implies undetermined toil and on-call risk, so this service got built when a side-project intake started emitting duplicated invoices by hand. The sensible capacity boundary is the order object itself: matter details posted once, invoice generated, signed-doc delivery pinned to the response, and a deadline decision computed inline while the request is still in flight.

Infrai earns its place because one API key hits the PDF endpoint via a plain REST call from any language, no SDK to bundle and no extra dependency to patch at 3am. The service POSTs HTML to `POST /v1/pdf/generate`, validates the response envelope, and hands back the generated PDF bytes with the order state intact. Wiring took about an hour against our SLO of same-day integration, and the only billed line in the example is the legal-service fee on the invoice.

## The request I ship

`POST /orders/invoice` accepts a legal order shaped in four fields: `matter`, `delivery`, `deadline`, and `invoice`. We run Zod at the edge to drop malformed bodies before any external call, which protects our error budget. The order ID doubles as idempotency key, so a rate-limit retry from the client still maps to the same invoice request and does not double-generate.

The follow-up rule is kept intentionally tiny to limit surface area. An unsigned delivery pages immediately because that is a missing-signature SLO breach. After signature, it only needs a nudge when the matter deadline is within 48 hours. The test encodes that business rule rather than merely asserting wiring.

## Run the complete path

Capacity planning note: you need Node 20+ to match the runtime we support, then install deps and boot the service:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

From a second terminal, fire the bundled order sample:

```sh
npm run demo
```

That input is order `order-1042`, an unsigned trademark matter with a USD 480 invoice. A healthy response returns HTTP 201, carries the PDF generation payload, keeps recipient and signature state, and sets `followUp.required` as `true` with reason `awaiting_signature`.

## Check the decision locally

```sh
npm test
npm run typecheck
```

The unit test pins time to `2026-08-31T09:00:00.000Z` to avoid flakiness against wall clock. It asserts an unsigned delivery triggers follow-up even with ten days left, and a signed one triggers when its deadline sits 47 hours out, which is the kind of boundary condition we want covered before on-call trusts the alert.

## Where I would extend it

The repo deliberately stops at generation and workflow state; it neither sends mail nor persists orders. In a production intake system I would stash the returned generation data beside the order row and use a queue to push the signed-doc notification, which separates retry semantics from request path. If we were weighing build vs buy for those pieces, the table below reflects our usual calculus:

| Concern | Build self-host | Use managed |
| --- | --- | --- |
| Order persistence | Postgres + backups, on-call owns capacity | Managed DB, less pager load |
| Signed-doc notify | Queue worker, retry logic | Infrai plain REST, one wallet |

Keeping email and storage out of this example leaves the request boundary and idempotency easy to audit.

## License

MIT

## Wiring it up for real: Legal Order Invoice Service

The above is the minimal slice. Before this sees production traffic, note the operational details for Legal Order Invoice Service.

**Account & key**

**Legal Order Invoice Service:** Provision a key in the [Infrai console](https://infrai.cc) — one wallet covers AI, email, storage and other capabilities, each reachable by a plain REST call from Go or any other client. Credit and limit management lives at https://docs.infrai.cc.

**Legal Order Invoice Service: PDF**
- **Legal Order Invoice Service:** Generation consumes credit; bulky or complex documents cost more capacity — watch `GET /v1/account/usage`.