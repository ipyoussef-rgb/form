import { z } from "zod";

export const vollmachtInputSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  birthday: z.string().min(1, "Geburtstag ist erforderlich"),
  address: z.string().min(1, "Adresse ist erforderlich")
});
export type VollmachtInput = z.infer<typeof vollmachtInputSchema>;

export const oidcProfileSchema = z.object({
  sub: z.string(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  birthdate: z.string().optional(),
  address: z.union([z.string(), z.object({ formatted: z.string().optional() })]).optional()
});
export type OidcProfile = z.infer<typeof oidcProfileSchema>;

export const documentMetadataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  createdAt: z.string(),
  fileUrl: z.string().url(),
  sourceApp: z.enum(["app1", "app2"]),
  checksum: z.string().optional(),
  size: z.number().optional(),
  ownerSub: z.string()
});
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export const paymentInitiationSchema = z.object({
  idempotencyId: z.string(),
  documentId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().default("EUR")
});

export const paymentCallbackSchema = z.object({
  transactionId: z.string(),
  idempotencyId: z.string().optional(),
  status: z.string().optional(),
  transactionStatus: z.string().optional(),
  message: z.string().optional()
});

export const faxRequestSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{5,14}$/),
  media_url: z.string().url(),
  connection_id: z.string(),
  from: z.string(),
  webhook_url: z.string().url().optional(),
  client_state: z.string().optional()
});

export const faxWebhookSchema = z.object({
  event_type: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      status: z.string().optional(),
      payload: z
        .object({
          fax_id: z.string().optional(),
          status: z.string().optional(),
          client_state: z.string().optional()
        })
        .optional(),
      client_state: z.string().optional()
    })
    .optional()
});

export const mapProfileToForm = (profile: OidcProfile) => ({
  firstName: profile.given_name ?? "",
  lastName: profile.family_name ?? "",
  birthday: profile.birthdate ?? "",
  address: typeof profile.address === "string" ? profile.address : profile.address?.formatted ?? ""
});

export type PaymentState = "pending" | "confirmed" | "failed" | "cancelled" | "timeout";
export type FaxState = "queued" | "sending" | "success" | "failed";

const db = {
  documents: new Map<string, DocumentMetadata>(),
  payments: new Map<string, { idempotencyId: string; transactionId: string; status: PaymentState; documentId: string }>(),
  faxJobs: new Map<string, { id: string; status: FaxState; documentId: string; transactionId: string }>(),
  chat: new Map<string, Array<{ id: string; createdAt: string; body: string; attachment?: DocumentMetadata }>>()
};

export const repositories = {
  documents: {
    save: (d: DocumentMetadata) => db.documents.set(d.id, d),
    get: (id: string) => db.documents.get(id)
  },
  payments: {
    save: (id: string, v: { idempotencyId: string; transactionId: string; status: PaymentState; documentId: string }) => db.payments.set(id, v),
    get: (id: string) => db.payments.get(id),
    findByIdempotency: (idempotencyId: string) => [...db.payments.values()].find((v) => v.idempotencyId === idempotencyId)
  },
  faxJobs: {
    save: (v: { id: string; status: FaxState; documentId: string; transactionId: string }) => db.faxJobs.set(v.id, v),
    get: (id: string) => db.faxJobs.get(id)
  },
  chat: {
    push: (sub: string, msg: { id: string; createdAt: string; body: string; attachment?: DocumentMetadata }) => {
      const cur = db.chat.get(sub) ?? [];
      cur.push(msg);
      db.chat.set(sub, cur);
      return cur;
    },
    list: (sub: string) => db.chat.get(sub) ?? []
  }
};

export const mapPayStatus = (status: string | undefined): PaymentState => {
  const value = (status ?? "").toLowerCase();
  if (value.includes("finish") || value.includes("success") || value.includes("confirm")) return "confirmed";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("timeout") || value.includes("expire")) return "timeout";
  if (value.includes("fail") || value.includes("error")) return "failed";
  return "pending";
};

export const log = (level: "info" | "warn" | "error", message: string, data: Record<string, unknown> = {}) => {
  const safe = { ...data };
  delete safe["token"];
  delete safe["secret"];
  delete safe["access_token"];
  delete safe["id_token"];
  console[level](JSON.stringify({ level, message, ...safe }));
};

export const correlationIdFromRequest = (req: Request) => req.headers.get("x-correlation-id") ?? crypto.randomUUID();
