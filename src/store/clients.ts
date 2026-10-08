import type { EfaasClient } from "../types.ts";
import { settings } from "./settings.ts";

/** Scopes every eFaas client gets by default (spec v2.2, "eFaas Scopes"). */
const DEFAULT_SCOPES = ["openid", "efaas.profile"];
const CLIENT_TYPES = ["server_side", "non_server_side"];

export const DEFAULT_CLIENT: EfaasClient = {
  client_id: "mock-efaas-client",
  client_secret: "mock-efaas-secret",
  client_type: "server_side",
  redirect_uris: [
    "http://localhost:3000/callback",
    "http://localhost:8000/callback",
  ],
  post_logout_redirect_uris: ["http://localhost:3000", "http://localhost:8000"],
  backchannel_logout_uri: null,
  frontchannel_logout_uri: null,
  allowed_scopes: [
    "openid",
    "efaas.profile",
    "efaas.email",
    "efaas.mobile",
    "efaas.birthdate",
    "efaas.photo",
    "efaas.work_permit_status",
    "efaas.passport_number",
    "efaas.country",
    "efaas.permanent_address",
    "efaas.current_address",
    "offline_access",
    "profile",
  ],
  allowed_grant_types: ["authorization_code", "refresh_token"],
  allow_offline_access: true,
};

/** Validates an untrusted client definition and fills in defaults. Throws with a readable message. */
export function parseClient(input: unknown): EfaasClient {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Client must be a JSON object");
  }
  const c = input as Record<string, unknown>;

  const str = (key: string): string | null => {
    const v = c[key];
    if (v === undefined || v === null || v === "") return null;
    if (typeof v !== "string") throw new Error(`${key} must be a string`);
    return v.trim();
  };
  const url = (key: string): string | null => {
    const v = str(key);
    if (v && !URL.canParse(v))
      throw new Error(`${key} is not a valid URL: ${v}`);
    return v;
  };
  const list = (key: string, fallback: string[], urls = false): string[] => {
    const v = c[key];
    if (v === undefined || v === null) return fallback;
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
      throw new Error(`${key} must be an array of strings`);
    }
    const items = v.map((x) => x.trim()).filter(Boolean);
    const bad = urls && items.find((x) => !URL.canParse(x));
    if (bad) throw new Error(`${key} contains an invalid URL: ${bad}`);
    return items;
  };

  const clientId = str("client_id");
  if (!clientId) throw new Error("client_id is required");

  const clientType = str("client_type") ?? "server_side";
  if (!CLIENT_TYPES.includes(clientType)) {
    throw new Error(`client_type must be one of: ${CLIENT_TYPES.join(", ")}`);
  }

  const clientSecret = str("client_secret");
  if (clientType === "server_side" && !clientSecret) {
    throw new Error("client_secret is required for server_side clients");
  }

  const redirectUris = list("redirect_uris", [], true);
  if (redirectUris.length === 0) {
    throw new Error("redirect_uris needs at least one URI");
  }

  return {
    client_id: clientId,
    client_secret: clientType === "server_side" ? clientSecret : null,
    client_type: clientType as EfaasClient["client_type"],
    redirect_uris: redirectUris,
    post_logout_redirect_uris: list("post_logout_redirect_uris", [], true),
    backchannel_logout_uri: url("backchannel_logout_uri"),
    frontchannel_logout_uri: url("frontchannel_logout_uri"),
    allowed_scopes: [
      ...new Set([...DEFAULT_SCOPES, ...list("allowed_scopes", [])]),
    ],
    allowed_grant_types: list("allowed_grant_types", ["authorization_code"]),
    allow_offline_access: c.allow_offline_access === true,
  };
}

export const clients = new Map<string, EfaasClient>();

export function replaceClients(list: EfaasClient[]): void {
  clients.clear();
  for (const c of list) clients.set(c.client_id, structuredClone(c));
}

export function findClient(clientId: string): EfaasClient | undefined {
  return clients.get(clientId);
}

export function addClient(client: EfaasClient): void {
  clients.set(client.client_id, client);
}

export function removeClient(clientId: string): boolean {
  return clients.delete(clientId);
}

/**
 * Resolves the client for a request. Registered clients are always returned
 * (and then validated by the caller). Unknown ones are rejected only in
 * strict mode; otherwise `client` is null and checks are skipped.
 */
export function checkClient(clientId: string | undefined): {
  client: EfaasClient | null;
  error?: string;
} {
  const client = clientId ? clients.get(clientId) : undefined;
  if (client) return { client };
  if (settings().strictClients) {
    return {
      client: null,
      error: clientId
        ? `Unknown client_id "${clientId}". Register it on the neFaas home page or via POST /mock/clients.`
        : "client_id is required",
    };
  }
  return { client: null };
}

/** Whether a client may request a scope. `profile` is the legacy alias of `efaas.profile`. */
export function clientAllowsScope(client: EfaasClient, scope: string): boolean {
  if (scope === "offline_access") return client.allow_offline_access;
  if (scope === "profile") {
    return (
      client.allowed_scopes.includes("profile") ||
      client.allowed_scopes.includes("efaas.profile")
    );
  }
  return client.allowed_scopes.includes(scope);
}
