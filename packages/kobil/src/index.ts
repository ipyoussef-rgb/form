import { createRemoteJWKSet, jwtVerify } from "jose";
import { readEnv } from "@repo/config";
import { documentMetadataSchema, log, mapPayStatus, paymentCallbackSchema, paymentInitiationSchema, repositories } from "@repo/shared";

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  issuer: string;
  jwks_uri: string;
};

type AuthCodeTokens = {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
};

export interface IdentityService {
  getDiscovery(): Promise<Discovery>;
  buildAuthorizeUrl(args: { app: "app1" | "app2"; state: string; nonce: string; codeChallenge: string }): Promise<string>;
  exchangeCode(args: { app: "app1" | "app2"; code: string; codeVerifier: string; redirectUri: string }): Promise<AuthCodeTokens>;
  validateIdToken(args: { app: "app1" | "app2"; idToken: string; nonce: string }): Promise<Record<string, unknown>>;
  userinfo(token: string): Promise<any>;
  getClientCredentialsToken(app: "app1" | "app2"): Promise<string>;
}

export class OidcIdentityService implements IdentityService {
  private env = readEnv();

  async getDiscovery() {
    const r = await fetch(this.env.KOBIL_IDP_WELL_KNOWN, { cache: "no-store" });
    if (!r.ok) throw new Error("OIDC discovery failed");
    return r.json() as Promise<Discovery>;
  }

  async buildAuthorizeUrl(args: { app: "app1" | "app2"; state: string; nonce: string; codeChallenge: string }) {
    const cfg = await this.getDiscovery();
    const clientId = args.app === "app1" ? this.env.APP1_KOBIL_CLIENT_ID : this.env.APP2_KOBIL_CLIENT_ID;
    const redirectUri = `${args.app === "app1" ? this.env.APP1_BASE_URL : this.env.APP2_BASE_URL}/api/auth/callback`;
    const url = new URL(cfg.authorization_endpoint);
    url.searchParams.set("client_id", clientId ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", args.state);
    url.searchParams.set("nonce", args.nonce);
    url.searchParams.set("code_challenge", args.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(args: { app: "app1" | "app2"; code: string; codeVerifier: string; redirectUri: string }) {
    const cfg = await this.getDiscovery();
    const clientId = args.app === "app1" ? this.env.APP1_KOBIL_CLIENT_ID : this.env.APP2_KOBIL_CLIENT_ID;
    const clientSecret = args.app === "app1" ? this.env.APP1_KOBIL_CLIENT_SECRET : this.env.APP2_KOBIL_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      code_verifier: args.codeVerifier
    });
    const r = await fetch(cfg.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!r.ok) throw new Error("token exchange failed");
    return r.json() as Promise<AuthCodeTokens>;
  }

  async validateIdToken(args: { app: "app1" | "app2"; idToken: string; nonce: string }) {
    const cfg = await this.getDiscovery();
    const clientId = args.app === "app1" ? this.env.APP1_KOBIL_CLIENT_ID : this.env.APP2_KOBIL_CLIENT_ID;
    const jwks = createRemoteJWKSet(new URL(cfg.jwks_uri));
    const verified = await jwtVerify(args.idToken, jwks, { issuer: cfg.issuer, audience: clientId });
    if (verified.payload.nonce !== args.nonce) {
      throw new Error("invalid nonce");
    }
    return verified.payload as Record<string, unknown>;
  }

  async userinfo(token: string) {
    const cfg = await this.getDiscovery();
    const r = await fetch(cfg.userinfo_endpoint, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) throw new Error("userinfo failed");
    return r.json();
  }

  async getClientCredentialsToken(app: "app1" | "app2") {
    const cfg = await this.getDiscovery();
    const clientId = app === "app1" ? this.env.APP1_KOBIL_CLIENT_ID : this.env.APP2_KOBIL_CLIENT_ID;
    const clientSecret = app === "app1" ? this.env.APP1_KOBIL_CLIENT_SECRET : this.env.APP2_KOBIL_CLIENT_SECRET;
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId ?? "", client_secret: clientSecret ?? "" });
    const r = await fetch(cfg.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!r.ok) throw new Error("client_credentials failed");
    const json = await r.json() as { access_token: string };
    return json.access_token;
  }
}

export interface ChatService {
  ingest(sub: string, payload: unknown): Promise<void>;
}

export class KobilChatService implements ChatService {
  private env = readEnv();

  async ingest(sub: string, payload: unknown) {
    const document = documentMetadataSchema.parse(payload);
    const identity = new OidcIdentityService();
    const token = await identity.getClientCredentialsToken("app2");

    const chatBody = {
      serviceUuid: this.env.APP2_KOBIL_CLIENT_ID,
      messageType: "processChatMessage",
      version: 3,
      messageContent: {
        messageText: `Neues Dokument aus App1: ${document.filename} (${document.mimeType})\n${document.fileUrl}`
      }
    };

    try {
      const endpoint = `${this.env.KOBIL_CHAT_BASE_URL.replace(/\/$/, "")}/mpower/v1/users/${encodeURIComponent(sub)}/message`;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(chatBody)
      });
      if (!resp.ok) {
        log("warn", "kobil chat api returned non-2xx", { status: resp.status });
      }
    } catch (error) {
      log("warn", "kobil chat api call failed; keeping local message", { error: error instanceof Error ? error.message : "unknown" });
    }

    repositories.chat.push(sub, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), body: "Dokument eingegangen", attachment: document });
  }
}

export interface PayService {
  createTransaction(input: unknown): Promise<{ transactionId: string; checkoutUrl: string; status: "pending" }>;
  processCallback(payload: unknown): Promise<{ ok: boolean }>;
  refreshTransactionStatus(transactionId: string): Promise<{ transactionId: string; status: string }>;
}

export class KobilPayService implements PayService {
  private env = readEnv();

  private callbackUrl() {
    return `${this.env.APP2_BASE_URL}/api/pay/callback`;
  }

  async createTransaction(input: unknown) {
    const parsed = paymentInitiationSchema.parse(input);
    const existing = repositories.payments.findByIdempotency(parsed.idempotencyId);
    if (existing) {
      return { transactionId: existing.transactionId, checkoutUrl: `${this.env.KOBIL_PAY_BASE_URL}/pay/${existing.transactionId}`, status: "pending" as const };
    }

    const merchantId = this.env.KOBIL_PAYMENT_MERCHANT_ID ?? this.env.APP2_KOBIL_CLIENT_ID ?? "";
    const merchantServiceUUID = this.env.KOBIL_PAYMENT_SERVICE_UUID ?? this.env.APP2_KOBIL_CLIENT_ID ?? "";

    const requestBody = {
      version: 1,
      idempotencyId: parsed.idempotencyId,
      userId: "superapp-user",
      merchantId,
      merchantServiceUUID,
      merchantName: this.env.KOBIL_PAYMENT_MERCHANT_NAME,
      merchantCallback: this.callbackUrl(),
      transactionTimeout: 10,
      tenantId: this.env.KOBIL_TENANT_NAME,
      amount: parsed.amountCents,
      currency: parsed.currency
    };

    let transactionId: string = crypto.randomUUID();
    let checkoutUrl = `${this.env.KOBIL_PAY_BASE_URL}/pay/${transactionId}`;

    try {
      const response = await fetch(`${this.env.KOBIL_PAY_BASE_URL.replace(/\/$/, "")}/mpay-merchant/create/transaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      if (response.ok) {
        const body = await response.json() as { transactionId?: string; nextAction?: string };
        transactionId = body.transactionId ?? transactionId;
        checkoutUrl = body.nextAction ?? checkoutUrl;
      } else {
        log("warn", "kobil pay create transaction non-2xx", { status: response.status });
      }
    } catch (error) {
      log("warn", "kobil pay create transaction failed; using local fallback", { error: error instanceof Error ? error.message : "unknown" });
    }

    repositories.payments.save(transactionId, { idempotencyId: parsed.idempotencyId, transactionId, status: "pending", documentId: parsed.documentId });
    log("info", "payment created", { transactionId, idempotencyId: parsed.idempotencyId });
    return { transactionId, checkoutUrl, status: "pending" as const };
  }

  async processCallback(payload: unknown) {
    const parsed = paymentCallbackSchema.parse(payload);
    const transactionId = parsed.transactionId;
    const current = repositories.payments.get(transactionId);
    if (!current) return { ok: false };
    const status = mapPayStatus(parsed.transactionStatus ?? parsed.status);
    repositories.payments.save(transactionId, { ...current, status });
    return { ok: true };
  }

  async refreshTransactionStatus(transactionId: string) {
    const current = repositories.payments.get(transactionId);
    if (!current) {
      return { transactionId, status: "unknown" };
    }

    const merchantId = this.env.KOBIL_PAYMENT_MERCHANT_ID ?? this.env.APP2_KOBIL_CLIENT_ID ?? "";
    const reqBody = { merchantId, merchantCallback: this.callbackUrl(), transactionId };

    try {
      const response = await fetch(`${this.env.KOBIL_PAY_BASE_URL.replace(/\/$/, "")}/mpay-merchant/create/transaction/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody)
      });
      if (response.ok) {
        const data = await response.json() as { transactionStatus?: string; status?: string };
        const mapped = mapPayStatus(data.transactionStatus ?? data.status);
        repositories.payments.save(transactionId, { ...current, status: mapped });
        return { transactionId, status: mapped };
      }
    } catch (error) {
      log("warn", "kobil pay status call failed", { error: error instanceof Error ? error.message : "unknown" });
    }

    return { transactionId, status: current.status };
  }
}
