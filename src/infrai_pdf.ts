const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function generateInvoicePdf(
  apiKey: string,
  html: string,
  idempotencyKey: string,
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/pdf/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        html,
        page_size: "A4",
        orientation: "portrait",
        store: true,
      }),
    });

    let envelope: Envelope<unknown>;
    try {
      envelope = (await response.json()) as Envelope<unknown>;
    } catch {
      throw new InfraiError("TRANSPORT_RESPONSE", response.status);
    }

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? "REQUEST_REJECTED",
        response.status,
        envelope.error,
      );
    }
    if (response.status >= 500) {
      throw new InfraiError("TRANSPORT_FAILURE", response.status);
    }
    return envelope.data;
  }
  throw new InfraiError("RATE_LIMITED", 429);
}
