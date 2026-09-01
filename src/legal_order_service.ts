import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { decideFollowUp } from "./deadline_followup.js";
import { generateInvoicePdf, InfraiError } from "./infrai_pdf.js";

export const legalOrderSchema = z.object({
  orderId: z.string().min(1),
  matter: z.object({
    reference: z.string().min(1),
    clientName: z.string().min(1),
    description: z.string().min(1),
  }),
  delivery: z.object({
    recipientEmail: z.string().email(),
    signedAt: z.string().datetime().optional(),
  }),
  deadline: z.string().datetime(),
  invoice: z.object({
    currency: z.string().length(3),
    amount: z.number().positive(),
  }),
});

type LegalOrder = z.infer<typeof legalOrderSchema>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] as string);
}

export function renderInvoice(order: LegalOrder): string {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.invoice.currency,
  }).format(order.invoice.amount);
  return `<!doctype html><html><head><style>body{font-family:Arial;padding:40px;color:#17202a}h1{border-bottom:2px solid #17202a;padding-bottom:12px}dt{font-weight:bold;margin-top:16px}</style></head><body><h1>Legal services invoice</h1><dl><dt>Order</dt><dd>${escapeHtml(order.orderId)}</dd><dt>Matter</dt><dd>${escapeHtml(order.matter.reference)} — ${escapeHtml(order.matter.description)}</dd><dt>Client</dt><dd>${escapeHtml(order.matter.clientName)}</dd><dt>Amount due</dt><dd>${escapeHtml(amount)}</dd></dl></body></html>`;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<unknown>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function startService(port = 3000) {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/orders/invoice") {
      send(response, 404, { error: "Route not found" });
      return;
    }
    try {
      const order = legalOrderSchema.parse(await readJson(request));
      const pdf = await generateInvoicePdf(apiKey, renderInvoice(order), order.orderId);
      send(response, 201, {
        orderId: order.orderId,
        pdf,
        delivery: { recipientEmail: order.delivery.recipientEmail, signedAt: order.delivery.signedAt },
        followUp: decideFollowUp(order.delivery.signedAt, order.deadline, new Date()),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        send(response, 400, { error: "Invalid legal order", details: error.flatten() });
      } else if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        send(response, status, { error: error.code, message: error.message });
      } else {
        send(response, 500, { error: "Invoice request could not be processed" });
      }
    }
  }).listen(port, () => console.log(`Legal order service listening on http://localhost:${port}`));
}

if (import.meta.url === `file://${process.argv[1]}`) startService(Number(process.env.PORT ?? 3000));
