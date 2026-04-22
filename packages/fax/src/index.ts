import { createPublicKey, verify } from "node:crypto";
import { readEnv } from "@repo/config";
import { faxRequestSchema, faxWebhookSchema, log, repositories } from "@repo/shared";

export interface FaxService {
  send(payload: unknown): Promise<{ id: string; status: "queued" | "sending" }>;
  handleWebhook(payload: unknown): Promise<{ ok: boolean }>;
  verifyWebhook(body: string, signature: string, timestamp: string): boolean;
}

export class TelnyxFaxService implements FaxService {
  private env = readEnv();

  async send(payload: unknown) {
    const parsed = faxRequestSchema.parse(payload);
    const response = await fetch("https://api.telnyx.com/v2/faxes", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.env.TELNYX_API_KEY ?? ""}` },
      body: JSON.stringify(parsed)
    });
    if (!response.ok) throw new Error(`fax send failed: ${response.status}`);
    const body = await response.json() as { data?: { id?: string; status?: string } };
    const id = body.data?.id ?? crypto.randomUUID();
    const status: "queued" | "sending" = body.data?.status?.includes("send") ? "sending" : "queued";
    const decodedState = parsed.client_state ? Buffer.from(parsed.client_state, "base64").toString("utf8") : "";
    const [documentId = "", transactionId = ""] = decodedState.split(":");
    repositories.faxJobs.save({ id, status, documentId, transactionId });
    return { id, status };
  }

  verifyWebhook(body: string, signature: string, timestamp: string) {
    const fiveMinutes = 60 * 5;
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > fiveMinutes) return false;

    const keyMaterial = this.env.TELNYX_WEBHOOK_PUBLIC_KEY ?? this.env.TELNYX_FAX_WEBHOOK_SECRET;
    if (!keyMaterial || !signature) return false;

    try {
      const message = Buffer.from(`${timestamp}|${body}`);
      const signatureBuffer = Buffer.from(signature, "base64");
      const key = createPublicKey(keyMaterial);
      return verify(null, message, key, signatureBuffer);
    } catch {
      return false;
    }
  }

  async handleWebhook(payload: unknown) {
    const parsed = faxWebhookSchema.parse(payload);
    const faxId = parsed.data?.id ?? parsed.data?.payload?.fax_id;
    if (!faxId) return { ok: false };
    const job = repositories.faxJobs.get(faxId);
    if (!job) return { ok: false };

    const rawStatus = `${parsed.event_type ?? ""} ${parsed.data?.status ?? ""} ${parsed.data?.payload?.status ?? ""}`.toLowerCase();
    const status = rawStatus.includes("deliver") ? "success" : rawStatus.includes("fail") ? "failed" : "sending";
    repositories.faxJobs.save({ ...job, status });
    log("info", "fax webhook processed", { faxId, status });
    return { ok: true };
  }
}
