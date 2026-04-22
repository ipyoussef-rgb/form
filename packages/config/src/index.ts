import { z } from "zod";

const envSchema = z.object({
  KOBIL_TENANT_NAME: z.string().min(1),
  KOBIL_IDP_WELL_KNOWN: z.string().url(),
  KOBIL_PAY_BASE_URL: z.string().url(),
  KOBIL_PAYMENT_MERCHANT_NAME: z.string().min(1),
  KOBIL_CHAT_BASE_URL: z.string().url(),
  KOBIL_PAYMENT_MERCHANT_ID: z.string().optional(),
  KOBIL_PAYMENT_SERVICE_UUID: z.string().optional(),
  AUTH_SECRET: z.string().min(16),
  APP2_INGEST_SHARED_SECRET: z.string().min(8),
  APP1_KOBIL_CLIENT_ID: z.string().optional(),
  APP1_KOBIL_CLIENT_SECRET: z.string().optional(),
  APP1_BASE_URL: z.string().url().optional(),
  APP2_KOBIL_CLIENT_ID: z.string().optional(),
  APP2_KOBIL_CLIENT_SECRET: z.string().optional(),
  APP2_BASE_URL: z.string().url().optional(),
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_FAX_CONNECTION_ID: z.string().optional(),
  TELNYX_FAX_FROM_NUMBER: z.string().optional(),
  TELNYX_FAX_WEBHOOK_SECRET: z.string().optional(),
  TELNYX_WEBHOOK_PUBLIC_KEY: z.string().optional(),
  TELNYX_PUBLIC_BASE_URL: z.string().url().optional()
});

export type Env = z.infer<typeof envSchema>;

export const readEnv = () => envSchema.parse(process.env);
